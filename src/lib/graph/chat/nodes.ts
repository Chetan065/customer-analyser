import { eq, and, desc, sql, or, ilike, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { feedbackItems, themes, insights } from "@/lib/db/schema";
import { getChatModel, getEmbeddingsModel } from "@/lib/llm/models";
import { buildQueryUnderstandingPrompt, buildSynthesisPrompt } from "./prompts";
import { verifyAndGroundPayload } from "./grounding";
import type {
  ChatGraphState,
  ChatFeedbackItem,
  ChatThemeItem,
  QueryUnderstanding,
  SubsetMetrics,
  ChatStructuredPayload,
} from "./state";

/**
 * 1. Understand Query Node
 * Extracts user intent, target segment, sentiment constraints, aspects, and semantic query text.
 */
export async function nodeUnderstandQuery(state: ChatGraphState): Promise<Partial<ChatGraphState>> {
  try {
    const chatModel = getChatModel(0);
    const prompt = buildQueryUnderstandingPrompt(state.userMessage, state.history);

    const response = await chatModel.invoke(prompt);
    const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);

    // Extract JSON block
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    let parsed: QueryUnderstanding = {
      intent: "general_query",
    };

    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (err) {
        console.warn("Failed to parse query understanding JSON, using defaults:", err);
      }
    }

    // Merge any manual UI filters provided by the client
    if (state.manualFilters.isRepeatCustomer !== undefined && state.manualFilters.isRepeatCustomer !== null) {
      parsed.isRepeatCustomer = state.manualFilters.isRepeatCustomer;
      parsed.targetSegment = state.manualFilters.isRepeatCustomer ? "repeat" : "new";
    }
    if (state.manualFilters.customerSegment) {
      parsed.customerSegment = state.manualFilters.customerSegment;
    }
    if (state.manualFilters.sentiment) {
      parsed.sentiment = state.manualFilters.sentiment;
    }

    // Rule-based heuristic fallbacks if LLM omitted intent/segment
    const lowerMsg = state.userMessage.toLowerCase();
    if (lowerMsg.includes("repeat") || lowerMsg.includes("loyal") || lowerMsg.includes("existing") || lowerMsg.includes("renewal")) {
      parsed.isRepeatCustomer = true;
      parsed.targetSegment = "repeat";
    } else if (lowerMsg.includes("new customer") || lowerMsg.includes("onboard") || lowerMsg.includes("signup") || lowerMsg.includes("sign up") || lowerMsg.includes("trial")) {
      parsed.isRepeatCustomer = false;
      parsed.targetSegment = "new";
    }

    if (lowerMsg.includes("negative") || lowerMsg.includes("complain") || lowerMsg.includes("bug") || lowerMsg.includes("broken") || lowerMsg.includes("hate") || lowerMsg.includes("worst") || lowerMsg.includes("churn")) {
      parsed.sentiment = "negative";
    } else if (lowerMsg.includes("positive") || lowerMsg.includes("love") || lowerMsg.includes("best") || lowerMsg.includes("praise")) {
      parsed.sentiment = "positive";
    }

    return {
      understanding: parsed,
      stage: "understanding",
    };
  } catch (err) {
    console.error("Error in nodeUnderstandQuery:", err);
    // Graceful fallback
    return {
      understanding: {
        intent: "general_query",
        semanticQuery: state.userMessage,
      },
      stage: "understanding",
    };
  }
}

/**
 * 2. Plan Retrieval Node
 * Checks whether customer segment data exists in this project and sets up retrieval flags.
 */
export async function nodePlanRetrieval(state: ChatGraphState): Promise<Partial<ChatGraphState>> {
  try {
    // Check if segment data exists in feedback_items
    const [segmentCheck] = await db
      .select({
        repeatCount: sql<number>`count(*) filter (where is_repeat_customer is true or customer_segment is not null)`,
        totalCount: sql<number>`count(*)`,
      })
      .from(feedbackItems)
      .where(eq(feedbackItems.projectId, state.projectId));

    const total = Number(segmentCheck?.totalCount || 0);
    const withSegments = Number(segmentCheck?.repeatCount || 0);

    const segmentDataAvailable = total > 0 && withSegments > 0;

    return {
      segmentDataAvailable,
      stage: "planning",
    };
  } catch (err) {
    console.error("Error in nodePlanRetrieval:", err);
    return {
      segmentDataAvailable: true,
      stage: "planning",
    };
  }
}

/**
 * 3. Retrieve Node
 * Executes SQL filtering + vector similarity search on feedback items and themes.
 */
export async function nodeRetrieve(state: ChatGraphState): Promise<Partial<ChatGraphState>> {
  try {
    const { understanding, projectId } = state;

    // Build conditions
    const conditions = [eq(feedbackItems.projectId, projectId)];

    // Target Segment filtering
    if (understanding.isRepeatCustomer === true) {
      conditions.push(
        or(
          eq(feedbackItems.isRepeatCustomer, true),
          sql`lower(coalesce(${feedbackItems.customerSegment}, '')) in ('repeat', 'enterprise', 'vip', 'pro_annual')`
        )!
      );
    } else if (understanding.isRepeatCustomer === false) {
      conditions.push(
        or(
          eq(feedbackItems.isRepeatCustomer, false),
          sql`lower(coalesce(${feedbackItems.customerSegment}, '')) in ('new', 'trial', 'starter', 'free')`
        )!
      );
    }

    // Sentiment filtering
    if (understanding.sentiment) {
      conditions.push(
        or(
          eq(feedbackItems.sentiment, understanding.sentiment),
          understanding.sentiment === "negative"
            ? sql`${feedbackItems.rating} <= 2`
            : understanding.sentiment === "positive"
            ? sql`${feedbackItems.rating} >= 4`
            : sql`${feedbackItems.rating} = 3`
        )!
      );
    }

    // Try semantic vector search if insights have embeddings
    let vectorMatchedItemIds: string[] = [];
    if (understanding.semanticQuery) {
      try {
        const embeddingsModel = getEmbeddingsModel();
        const [vector] = await embeddingsModel.embedDocuments([understanding.semanticQuery]);
        if (vector && vector.length === 768) {
          const vectorStr = `[${vector.join(",")}]`;
          const nearest = await db.execute<{ feedback_item_id: string }>(
            sql`SELECT feedback_item_id FROM insights 
                WHERE project_id = ${projectId} AND embedding IS NOT NULL 
                ORDER BY embedding <=> ${vectorStr}::vector 
                LIMIT 35`
          );
          vectorMatchedItemIds = ((nearest.rows as unknown) as Array<{ feedback_item_id: string }>)
            .map((r) => r.feedback_item_id)
            .filter(Boolean);
        }
      } catch (vectorErr) {
        // Embeddings / vector search is optional, fall back seamlessly to SQL
      }
    }

    // Fetch candidate feedback items
    let items = await db
      .select({
        id: feedbackItems.id,
        text: feedbackItems.text,
        rating: feedbackItems.rating,
        sentiment: feedbackItems.sentiment,
        sentimentScore: feedbackItems.sentimentScore,
        aspects: feedbackItems.aspects,
        isChurnRisk: feedbackItems.isChurnRisk,
        isRepeatCustomer: feedbackItems.isRepeatCustomer,
        customerSegment: feedbackItems.customerSegment,
        customerId: feedbackItems.customerId,
        orderCount: feedbackItems.orderCount,
        source: feedbackItems.source,
        product: feedbackItems.product,
        occurredAt: feedbackItems.occurredAt,
      })
      .from(feedbackItems)
      .where(and(...conditions))
      .orderBy(desc(feedbackItems.occurredAt))
      .limit(60);

    // If specific segment filter returned 0 results, fall back to broader project sample
    if (items.length === 0) {
      items = await db
        .select({
          id: feedbackItems.id,
          text: feedbackItems.text,
          rating: feedbackItems.rating,
          sentiment: feedbackItems.sentiment,
          sentimentScore: feedbackItems.sentimentScore,
          aspects: feedbackItems.aspects,
          isChurnRisk: feedbackItems.isChurnRisk,
          isRepeatCustomer: feedbackItems.isRepeatCustomer,
          customerSegment: feedbackItems.customerSegment,
          customerId: feedbackItems.customerId,
          orderCount: feedbackItems.orderCount,
          source: feedbackItems.source,
          product: feedbackItems.product,
          occurredAt: feedbackItems.occurredAt,
        })
        .from(feedbackItems)
        .where(eq(feedbackItems.projectId, projectId))
        .orderBy(desc(feedbackItems.occurredAt))
        .limit(50);
    }

    // Prioritize items that matched vector similarity
    if (vectorMatchedItemIds.length > 0) {
      const vectorSet = new Set(vectorMatchedItemIds);
      items.sort((a, b) => {
        const aHas = vectorSet.has(a.id) ? 1 : 0;
        const bHas = vectorSet.has(b.id) ? 1 : 0;
        return bHas - aHas;
      });
    }

    // Fetch top themes for this project
    const projectThemes = await db
      .select({
        id: themes.id,
        name: themes.name,
        kind: themes.kind,
        priorityScore: themes.priorityScore,
        severityLabel: themes.severityLabel,
        mentions: themes.mentions,
        summary: themes.summary,
      })
      .from(themes)
      .where(eq(themes.projectId, projectId))
      .orderBy(desc(themes.priorityScore))
      .limit(10);

    return {
      retrievedItems: items,
      retrievedThemes: projectThemes,
      stage: "retrieving",
    };
  } catch (err) {
    console.error("Error in nodeRetrieve:", err);
    return {
      retrievedItems: [],
      retrievedThemes: [],
      stage: "retrieving",
      error: String(err),
    };
  }
}

/**
 * 4. Analyze Subset Node
 * Computes deterministic counts, sentiment breakdown, top pain points, and segment stats.
 */
export async function nodeAnalyzeSubset(state: ChatGraphState): Promise<Partial<ChatGraphState>> {
  const items = state.retrievedItems || [];

  let positive = 0;
  let neutral = 0;
  let negative = 0;
  let ratingSum = 0;
  let ratingCount = 0;
  let repeatCount = 0;
  let newCount = 0;

  const painPointFreq: Record<string, number> = {};
  const aspectFreq: Record<string, number> = {};
  const segmentBreakdown: Record<string, number> = {};

  for (const it of items) {
    // Sentiment
    const s = it.sentiment?.toLowerCase();
    if (s === "positive" || (it.rating && it.rating >= 4)) {
      positive++;
    } else if (s === "negative" || (it.rating && it.rating <= 2)) {
      negative++;
    } else {
      neutral++;
    }

    // Rating
    if (it.rating != null) {
      ratingSum += it.rating;
      ratingCount++;
    }

    // Repeat vs New
    if (it.isRepeatCustomer) {
      repeatCount++;
    } else {
      newCount++;
    }

    // Segments
    const seg = it.customerSegment || (it.isRepeatCustomer ? "repeat" : "new");
    segmentBreakdown[seg] = (segmentBreakdown[seg] || 0) + 1;

    // Pain points
    if (Array.isArray(it.painPoints)) {
      for (const p of it.painPoints) {
        if (!p) continue;
        painPointFreq[p] = (painPointFreq[p] || 0) + 1;
      }
    }

    // Aspects
    if (Array.isArray(it.aspects)) {
      for (const a of it.aspects) {
        const name = typeof a === "string" ? a : a?.aspect;
        if (!name) continue;
        aspectFreq[name] = (aspectFreq[name] || 0) + 1;
      }
    }
  }

  const topPainPoints = Object.entries(painPointFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const topAspects = Object.entries(aspectFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const subsetMetrics: SubsetMetrics = {
    totalRetrieved: items.length,
    sentimentCounts: { positive, neutral, negative },
    averageRating: ratingCount > 0 ? Number((ratingSum / ratingCount).toFixed(2)) : null,
    topPainPoints,
    topAspects,
    segmentBreakdown,
    repeatCustomerCount: repeatCount,
    newCustomerCount: newCount,
  };

  return {
    subsetMetrics,
    stage: "analyzing",
  };
}

/**
 * 5. Synthesize Node
 * Generates structured answer with headline, key issues, supporting quotes, actions, caveats, and follow-ups.
 */
export async function nodeSynthesize(state: ChatGraphState): Promise<Partial<ChatGraphState>> {
  try {
    const chatModel = getChatModel(0.1);
    const prompt = buildSynthesisPrompt(
      state.userMessage,
      state.understanding,
      state.retrievedItems,
      state.retrievedThemes,
      state.subsetMetrics,
      state.segmentDataAvailable
    );

    const response = await chatModel.invoke(prompt);
    const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);

    // Extract JSON block
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    let parsedPayload: Partial<ChatStructuredPayload> = {};

    if (jsonMatch) {
      try {
        parsedPayload = JSON.parse(jsonMatch[0]);
      } catch (err) {
        console.warn("Failed to parse synthesized JSON:", err);
      }
    }

    return {
      rawPayload: parsedPayload,
      stage: "synthesizing",
    };
  } catch (err) {
    console.error("Error in nodeSynthesize:", err);
    return {
      rawPayload: {
        headline: "Analysis completed with basic subset findings.",
        keyIssues: [],
        supportingComments: [],
        recommendedActions: [],
        caveats: ["LLM generation encountered an issue; fallback metrics provided."],
        followUpQuestions: ["What are the top customer pain points?"],
      },
      stage: "synthesizing",
      error: String(err),
    };
  }
}

/**
 * 6. Verify Grounding Node
 * Strictly audits quotes against retrieved feedback items to prevent hallucinations.
 */
export async function nodeVerifyGrounding(state: ChatGraphState): Promise<Partial<ChatGraphState>> {
  const verified = verifyAndGroundPayload(
    state.rawPayload || {},
    state.retrievedItems || [],
    state.subsetMetrics,
    state.segmentDataAvailable
  );

  return {
    finalPayload: verified,
    stage: "done",
  };
}
