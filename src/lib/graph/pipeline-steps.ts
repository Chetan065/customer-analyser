import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  feedbackItems,
  analysisRuns,
  insights,
  themes,
  recommendations,
  type FeedbackItem,
  type AnalysisRun,
  type Theme,
} from "@/lib/db/schema";
import { getChatModel, getEmbeddingsModel } from "@/lib/llm/models";
import {
  batchExtractionSchema,
  batchThemeLabelSchema,
  recommendationsResponseSchema,
  type ExtractedItem,
} from "@/lib/llm/schemas";
import {
  EXTRACTION_SYSTEM_PROMPT,
  THEME_LABELING_SYSTEM_PROMPT,
  RECOMMENDATIONS_SYSTEM_PROMPT,
} from "./prompts";
import {
  clusterItemsAgglomerative,
  type ClusterItem,
  type ClusterResult,
} from "@/lib/analysis/clustering";
import { calculateThemeScores } from "@/lib/analysis/scoring";
import { SCORING_CONFIG } from "@/lib/analysis/scoring.config";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

const EXTRACTION_BATCH_SIZE = 15;

export interface StepResult {
  runId: string;
  status: "queued" | "running" | "completed" | "failed";
  stage: string;
  progress: number;
  message: string;
  totalItems: number;
  processedItems: number;
}

/**
 * Step 1: Process a batch of pending feedback items with structured LLM extraction.
 */
export async function stepClassifyBatch(run: AnalysisRun): Promise<StepResult> {
  const projectId = run.projectId;

  // Find next batch of pending items
  const pendingItems = await db
    .select()
    .from(feedbackItems)
    .where(
      and(
        eq(feedbackItems.projectId, projectId),
        eq(feedbackItems.analysisStatus, "pending")
      )
    )
    .limit(EXTRACTION_BATCH_SIZE);

  // Total items and completed items in project
  const allProjectItems = await db
    .select()
    .from(feedbackItems)
    .where(eq(feedbackItems.projectId, projectId));

  const totalItems = allProjectItems.length;
  const completedCount = allProjectItems.filter((i) => i.analysisStatus === "done").length;

  if (pendingItems.length === 0) {
    // Classification is complete! Transition stage to 'embed'
    const progress = Math.min(50, Math.round((completedCount / Math.max(1, totalItems)) * 50));
    await db
      .update(analysisRuns)
      .set({
        stage: "embed",
        status: "running",
        progress: 50,
      })
      .where(eq(analysisRuns.id, run.id));

    return {
      runId: run.id,
      status: "running",
      stage: "embed",
      progress: 50,
      message: "Sentiment classification completed. Proceeding to embedding stage.",
      totalItems,
      processedItems: completedCount,
    };
  }

  // Construct structured extraction prompt
  const userContent = pendingItems
    .map(
      (item) =>
        `<feedback_item id="${item.id}" rating="${item.rating ?? "none"}" source="${item.source ?? "unknown"}">\n${item.text}\n</feedback_item>`
    )
    .join("\n\n");

  const model = getChatModel(0);
  const structuredLlm = model.withStructuredOutput(batchExtractionSchema);

  let results: ExtractedItem[] = [];

  try {
    const response = await structuredLlm.invoke([
      new SystemMessage(EXTRACTION_SYSTEM_PROMPT),
      new HumanMessage(userContent),
    ]);
    results = response.results;
  } catch (firstErr) {
    console.warn("First extraction attempt failed, retrying once...", firstErr);
    try {
      const response = await structuredLlm.invoke([
        new SystemMessage(EXTRACTION_SYSTEM_PROMPT),
        new HumanMessage(userContent),
      ]);
      results = response.results;
    } catch (secondErr) {
      console.error("Second extraction attempt failed, marking batch as failed", secondErr);
      // Mark these items as failed to avoid infinite loop
      for (const item of pendingItems) {
        await db
          .update(feedbackItems)
          .set({ analysisStatus: "failed" })
          .where(eq(feedbackItems.id, item.id));
      }
      return {
        runId: run.id,
        status: "running",
        stage: "classify",
        progress: Math.round((completedCount / Math.max(1, totalItems)) * 50),
        message: `Extraction encountered an error for ${pendingItems.length} items; skipping to maintain pipeline continuity.`,
        totalItems,
        processedItems: completedCount,
      };
    }
  }

  // Persist extracted results to database
  const resultMap = new Map(results.map((r) => [r.id, r]));

  for (const item of pendingItems) {
    const extracted = resultMap.get(item.id);
    if (extracted) {
      // 1. Update feedback_items row
      await db
        .update(feedbackItems)
        .set({
          analysisStatus: "done",
          sentiment: extracted.sentiment,
          sentimentScore: extracted.sentimentScore,
          confidence: extracted.confidence,
          emotion: extracted.emotion,
          isChurnRisk: extracted.isChurnRisk,
          summary: extracted.summary,
          aspects: extracted.aspects,
        })
        .where(eq(feedbackItems.id, item.id));

      // 2. Insert pain points and feature requests into insights table (without embedding initially)
      for (const pp of extracted.painPoints) {
        if (pp.text && pp.text.trim()) {
          await db.insert(insights).values({
            projectId,
            feedbackItemId: item.id,
            kind: "pain_point",
            text: pp.text.trim(),
            severity: pp.severity,
          });
        }
      }

      for (const fr of extracted.featureRequests) {
        if (fr.text && fr.text.trim()) {
          await db.insert(insights).values({
            projectId,
            feedbackItemId: item.id,
            kind: "feature_request",
            text: fr.text.trim(),
          });
        }
      }
    } else {
      await db
        .update(feedbackItems)
        .set({ analysisStatus: "failed" })
        .where(eq(feedbackItems.id, item.id));
    }
  }

  const newCompletedCount = completedCount + pendingItems.length;
  // Classification represents 0% to 50% of the overall progress
  const progress = Math.min(50, Math.round((newCompletedCount / Math.max(1, totalItems)) * 50));

  await db
    .update(analysisRuns)
    .set({
      status: "running",
      stage: "classify",
      progress,
    })
    .where(eq(analysisRuns.id, run.id));

  return {
    runId: run.id,
    status: "running",
    stage: "classify",
    progress,
    message: `Classified ${pendingItems.length} items (${newCompletedCount}/${totalItems})`,
    totalItems,
    processedItems: newCompletedCount,
  };
}

/**
 * Step 2: Embed unembedded insights (pain points and feature requests).
 */
export async function stepEmbedInsights(run: AnalysisRun): Promise<StepResult> {
  const projectId = run.projectId;

  // Find insights without embeddings
  const unembedded = await db
    .select({ id: insights.id, text: insights.text })
    .from(insights)
    .where(and(eq(insights.projectId, projectId), isNull(insights.embedding)))
    .limit(50); // Embed in batches of 50

  if (unembedded.length === 0) {
    // Embedding is complete! Transition to 'cluster'
    await db
      .update(analysisRuns)
      .set({
        stage: "cluster",
        status: "running",
        progress: 70,
      })
      .where(eq(analysisRuns.id, run.id));

    return {
      runId: run.id,
      status: "running",
      stage: "cluster",
      progress: 70,
      message: "Embedding complete. Proceeding to clustering and theme identification.",
      totalItems: run.totalItems,
      processedItems: run.totalItems,
    };
  }

  const embeddingsModel = getEmbeddingsModel();
  const texts = unembedded.map((u) => u.text);
  const vectors = await embeddingsModel.embedDocuments(texts);

  // Update embeddings in database
  for (let i = 0; i < unembedded.length; i++) {
    await db
      .update(insights)
      .set({ embedding: vectors[i] })
      .where(eq(insights.id, unembedded[i].id));
  }

  await db
    .update(analysisRuns)
    .set({
      stage: "embed",
      status: "running",
      progress: 65,
    })
    .where(eq(analysisRuns.id, run.id));

  return {
    runId: run.id,
    status: "running",
    stage: "embed",
    progress: 65,
    message: `Generated embeddings for ${unembedded.length} insight statements.`,
    totalItems: run.totalItems,
    processedItems: run.totalItems,
  };
}

/**
 * Step 3: Cluster pain points and feature requests separately, synthesize theme labels, and calculate scores.
 */
export async function stepClusterAndLabel(run: AnalysisRun): Promise<StepResult> {
  const projectId = run.projectId;

  // 1. Fetch all embedded insights for this project
  const allInsights = await db
    .select({
      id: insights.id,
      text: insights.text,
      kind: insights.kind,
      severity: insights.severity,
      embedding: insights.embedding,
      feedbackItemId: insights.feedbackItemId,
    })
    .from(insights)
    .where(eq(insights.projectId, projectId));

  // If there are no insights found, transition straight to recommend
  if (allInsights.length === 0) {
    await db
      .update(analysisRuns)
      .set({ stage: "recommend", progress: 85 })
      .where(eq(analysisRuns.id, run.id));

    return {
      runId: run.id,
      status: "running",
      stage: "recommend",
      progress: 85,
      message: "No specific pain points or feature requests extracted. Proceeding to recommendations.",
      totalItems: run.totalItems,
      processedItems: run.totalItems,
    };
  }

  // 2. Fetch feedback items for dates and sentiment context
  const feedbackRows = await db
    .select()
    .from(feedbackItems)
    .where(eq(feedbackItems.projectId, projectId));

  const feedbackMap = new Map(feedbackRows.map((f) => [f.id, f]));

  const validDates = feedbackRows
    .map((f) => f.occurredAt)
    .filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()));

  const overallMinDate = validDates.length > 0 ? new Date(Math.min(...validDates.map((d) => d.getTime()))) : null;
  const overallMaxDate = validDates.length > 0 ? new Date(Math.max(...validDates.map((d) => d.getTime()))) : null;

  // 3. Cluster pain points and feature requests SEPARATELY
  const painPointItems: ClusterItem[] = allInsights
    .filter((i) => i.kind === "pain_point" && Array.isArray(i.embedding))
    .map((i) => ({
      id: i.id,
      text: i.text,
      embedding: i.embedding as number[],
      payload: {
        feedbackItemId: i.feedbackItemId,
        severity: i.severity,
        kind: "pain_point",
      },
    }));

  const featureRequestItems: ClusterItem[] = allInsights
    .filter((i) => i.kind === "feature_request" && Array.isArray(i.embedding))
    .map((i) => ({
      id: i.id,
      text: i.text,
      embedding: i.embedding as number[],
      payload: {
        feedbackItemId: i.feedbackItemId,
        severity: null,
        kind: "feature_request",
      },
    }));

  const ppClusters = clusterItemsAgglomerative(painPointItems);
  const frClusters = clusterItemsAgglomerative(featureRequestItems);

  // Clean out any previous themes for this run if re-running
  await db.delete(themes).where(eq(themes.runId, run.id));

  // Determine max theme mentions for normalization
  const allClusterSizes = [...ppClusters, ...frClusters].map((c) => c.items.length);
  const maxThemeMentions = allClusterSizes.length > 0 ? Math.max(...allClusterSizes) : 1;

  // Helper to label and score a list of clusters
  const processClusters = async (
    clusters: ClusterResult[],
    kind: "pain_point" | "feature_request"
  ) => {
    // Take top clusters up to limit
    const topClusters = clusters.slice(0, SCORING_CONFIG.clustering.maxClustersToLabel);

    if (topClusters.length === 0) return;

    // Build prompt for labeling top clusters
    const clusterPrompt = topClusters
      .map((c, idx) => {
        const samples = c.representativeItems.map((item) => `- "${item.text}"`).join("\n");
        return `Cluster ${idx} (${c.items.length} mentions):\n${samples}`;
      })
      .join("\n\n");

    const chatModel = getChatModel(0);
    const labeler = chatModel.withStructuredOutput(batchThemeLabelSchema);

    let labels: Array<{ clusterIndex: number; name: string; summary: string; category: string }> = [];

    try {
      const response = await labeler.invoke([
        new SystemMessage(THEME_LABELING_SYSTEM_PROMPT),
        new HumanMessage(
          `Please provide concrete, high-specificity names and one-sentence summaries for the following ${kind} clusters:\n\n${clusterPrompt}`
        ),
      ]);
      labels = response.themes;
    } catch (err) {
      console.warn(`Fallback labeling for ${kind} clusters:`, err);
      labels = topClusters.map((c, idx) => ({
        clusterIndex: idx,
        name: `${kind === "pain_point" ? "Issue" : "Request"}: ${c.representativeItems[0]?.text.slice(0, 30) || "General"}`,
        summary: `Cluster of ${c.items.length} customer feedback items.`,
        category: "General",
      }));
    }

    const labelMap = new Map(labels.map((l) => [l.clusterIndex, l]));

    for (let idx = 0; idx < topClusters.length; idx++) {
      const cluster = topClusters[idx];
      const label = labelMap.get(idx) || {
        name: `${kind === "pain_point" ? "Issue" : "Request"} in ${cluster.representativeItems[0]?.text.slice(0, 30)}`,
        summary: `Recurring ${kind.replace("_", " ")} mentioned ${cluster.items.length} times.`,
        category: "Product",
      };

      // Gather source item sentiment scores and dates
      const sourceItemSentiments: number[] = [];
      const sourceDates: (Date | null | undefined)[] = [];
      let churnCount = 0;
      const rawSeverities: number[] = [];

      for (const item of cluster.items) {
        if (item.payload?.severity) {
          rawSeverities.push(item.payload.severity);
        }
        const sourceFeedback = feedbackMap.get(item.payload?.feedbackItemId);
        if (sourceFeedback) {
          if (typeof sourceFeedback.sentimentScore === "number") {
            sourceItemSentiments.push(sourceFeedback.sentimentScore);
          }
          if (sourceFeedback.isChurnRisk) {
            churnCount++;
          }
          sourceDates.push(sourceFeedback.occurredAt);
        }
      }

      // Calculate deterministic scoring (Section 7)
      const scores = calculateThemeScores({
        mentions: cluster.items.length,
        totalProjectItems: feedbackRows.length,
        maxThemeMentions,
        kind,
        rawSeverities,
        sourceItemSentimentScores: sourceItemSentiments,
        churnRiskCount: churnCount,
        dates: sourceDates,
        overallMinDate,
        overallMaxDate,
      });

      // Insert Theme into database
      const [insertedTheme] = await db
        .insert(themes)
        .values({
          runId: run.id,
          projectId,
          kind,
          name: label.name,
          summary: label.summary,
          mentions: cluster.items.length,
          avgSentiment:
            sourceItemSentiments.length > 0
              ? sourceItemSentiments.reduce((a, b) => a + b, 0) / sourceItemSentiments.length
              : 0,
          severityScore: scores.severityScore,
          severityLabel: scores.severityLabel,
          priorityScore: scores.priorityScore,
          churnShare: scores.churnShare,
          recencyShare: scores.recencyShare,
        })
        .returning();

      // Update themeId on the insight rows
      const insightIds = cluster.items.map((i) => i.id);
      if (insightIds.length > 0) {
        await db
          .update(insights)
          .set({ themeId: insertedTheme.id })
          .where(inArray(insights.id, insightIds));
      }
    }
  };

  // Process both kinds
  await processClusters(ppClusters, "pain_point");
  await processClusters(frClusters, "feature_request");

  await db
    .update(analysisRuns)
    .set({
      stage: "recommend",
      status: "running",
      progress: 85,
    })
    .where(eq(analysisRuns.id, run.id));

  return {
    runId: run.id,
    status: "running",
    stage: "recommend",
    progress: 85,
    message: "Identified and ranked recurring themes. Generating strategic recommendations.",
    totalItems: run.totalItems,
    processedItems: run.totalItems,
  };
}

/**
 * Step 4: Generate data-driven AI recommendations grounded in top themes and verbatim quotes.
 */
export async function stepGenerateRecommendations(run: AnalysisRun): Promise<StepResult> {
  const projectId = run.projectId;

  // 1. Fetch top themes for this run
  const topThemes = await db
    .select()
    .from(themes)
    .where(eq(themes.runId, run.id))
    .orderBy(sql`${themes.priorityScore} desc`)
    .limit(10);

  // 2. Fetch all raw feedback items to build the verbatim quote verification corpus
  const allFeedback = await db
    .select({ id: feedbackItems.id, text: feedbackItems.text })
    .from(feedbackItems)
    .where(eq(feedbackItems.projectId, projectId));

  const allRawTexts = allFeedback.map((f) => f.text);

  // Fetch top representative quotes per theme
  const themesPromptData = await Promise.all(
    topThemes.map(async (theme) => {
      const sampleInsights = await db
        .select({
          text: insights.text,
          feedbackText: feedbackItems.text,
        })
        .from(insights)
        .innerJoin(feedbackItems, eq(insights.feedbackItemId, feedbackItems.id))
        .where(eq(insights.themeId, theme.id))
        .limit(3);

      return {
        themeId: theme.id,
        name: theme.name,
        kind: theme.kind,
        priorityScore: theme.priorityScore,
        severityLabel: theme.severityLabel,
        mentions: theme.mentions,
        quotes: sampleInsights.map((s) => s.feedbackText),
      };
    })
  );

  const contextMessage = `
Top Ranked Customer Feedback Themes:
${themesPromptData
  .map(
    (t) =>
      `[Theme ID: ${t.themeId}] "${t.name}" (${t.kind}, Priority Score: ${t.priorityScore}, Severity: ${t.severityLabel}, Mentions: ${t.mentions})\nEvidence Quotes:\n${t.quotes.map((q) => `  * "${q}"`).join("\n")}`
  )
  .join("\n\n")}
`.trim();

  const chatModel = getChatModel(0);
  const recommender = chatModel.withStructuredOutput(recommendationsResponseSchema);

  let rawRecommendations: any[] = [];

  try {
    const response = await recommender.invoke([
      new SystemMessage(RECOMMENDATIONS_SYSTEM_PROMPT),
      new HumanMessage(contextMessage),
    ]);
    rawRecommendations = response.recommendations;
  } catch (err) {
    console.error("Failed to generate structured recommendations:", err);
  }

  // Delete previous recommendations for this run if any
  await db.delete(recommendations).where(eq(recommendations.runId, run.id));

  // Verbatim quote verification: drop any fabricated quotes
  let rank = 1;
  for (const rec of rawRecommendations) {
    const verifiedQuotes: string[] = [];

    for (const quote of rec.evidenceQuotes || []) {
      const cleanQuote = quote.replace(/^["'\s]+|["'\s]+$/g, "").trim();
      if (!cleanQuote || cleanQuote.length < 5) continue;

      // Check if this quote is a verbatim substring of ANY raw feedback text
      const isVerbatim = allRawTexts.some((raw) =>
        raw.toLowerCase().includes(cleanQuote.toLowerCase())
      );

      if (isVerbatim) {
        verifiedQuotes.push(cleanQuote);
      } else {
        // Find best matching real sentence in corpus
        const match = allRawTexts.find((raw) =>
          cleanQuote.split(" ").slice(0, 4).join(" ").length > 10 &&
          raw.toLowerCase().includes(cleanQuote.split(" ").slice(0, 4).join(" ").toLowerCase())
        );
        if (match) {
          verifiedQuotes.push(match);
        }
      }
    }

    // Ensure we have at least 1 verified quote, else borrow from first linked theme
    if (verifiedQuotes.length === 0 && themesPromptData.length > 0) {
      const fallbackQuote = themesPromptData[0].quotes[0];
      if (fallbackQuote) verifiedQuotes.push(fallbackQuote);
    }

    await db.insert(recommendations).values({
      runId: run.id,
      projectId,
      title: rec.title,
      rationale: rec.rationale,
      impact: rec.impact,
      effort: rec.effort,
      themeIds: rec.themeIds || [],
      evidenceQuotes: verifiedQuotes,
      rank,
    });
    rank++;
  }

  // Calculate summary stats for the run
  const sentimentCounts = {
    positive: allFeedback.length > 0 ? (await db.select().from(feedbackItems).where(and(eq(feedbackItems.projectId, projectId), eq(feedbackItems.sentiment, "positive")))).length : 0,
    neutral: allFeedback.length > 0 ? (await db.select().from(feedbackItems).where(and(eq(feedbackItems.projectId, projectId), eq(feedbackItems.sentiment, "neutral")))).length : 0,
    negative: allFeedback.length > 0 ? (await db.select().from(feedbackItems).where(and(eq(feedbackItems.projectId, projectId), eq(feedbackItems.sentiment, "negative")))).length : 0,
  };

  const avgSentimentRes = await db
    .select({
      avg: sql<number>`avg(${feedbackItems.sentimentScore})`,
    })
    .from(feedbackItems)
    .where(eq(feedbackItems.projectId, projectId));

  const averageSentiment = avgSentimentRes[0]?.avg ?? 0;

  // Finalize run
  await db
    .update(analysisRuns)
    .set({
      status: "completed",
      stage: "done",
      progress: 100,
      finishedAt: new Date(),
      summaryStats: {
        totalProcessed: allFeedback.length,
        sentimentCounts,
        averageSentiment: Math.round(averageSentiment * 100) / 100,
        estimatedCostUsd: Math.round(allFeedback.length * 0.0008 * 1000) / 1000, // Approximate ~$0.0008 per review
      },
    })
    .where(eq(analysisRuns.id, run.id));

  return {
    runId: run.id,
    status: "completed",
    stage: "done",
    progress: 100,
    message: "Analysis completed successfully. Recommendations and insights are ready.",
    totalItems: run.totalItems,
    processedItems: run.totalItems,
  };
}

/**
 * Top-level step executor: advances the analysis run by executing the next pending step.
 */
export async function executeNextStep(runId: string): Promise<StepResult> {
  const [run] = await db.select().from(analysisRuns).where(eq(analysisRuns.id, runId));
  if (!run) {
    throw new Error(`Analysis run ${runId} not found`);
  }

  if (run.status === "completed") {
    return {
      runId: run.id,
      status: "completed",
      stage: "done",
      progress: 100,
      message: "Analysis already completed.",
      totalItems: run.totalItems,
      processedItems: run.totalItems,
    };
  }

  if (run.status === "failed") {
    return {
      runId: run.id,
      status: "failed",
      stage: run.stage,
      progress: run.progress,
      message: run.error || "Analysis run failed.",
      totalItems: run.totalItems,
      processedItems: 0,
    };
  }

  // Route to the appropriate step based on current stage
  switch (run.stage) {
    case "queued":
    case "classify":
      return await stepClassifyBatch(run);
    case "embed":
      return await stepEmbedInsights(run);
    case "cluster":
      return await stepClusterAndLabel(run);
    case "recommend":
      return await stepGenerateRecommendations(run);
    case "done":
      return {
        runId: run.id,
        status: "completed",
        stage: "done",
        progress: 100,
        message: "Analysis completed.",
        totalItems: run.totalItems,
        processedItems: run.totalItems,
      };
    default:
      return await stepClassifyBatch(run);
  }
}
