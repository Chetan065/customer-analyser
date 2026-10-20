import { NextRequest } from "next/server";
import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  projects,
  feedbackItems,
  analysisRuns,
  themes,
  recommendations,
} from "@/lib/db/schema";
import { getProject, getLatestRunForProject } from "@/lib/db/queries";
import { ensureDatabaseSchema } from "@/lib/db/bootstrap";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseSchema();
    const { id: projectId } = await params;
    const project = await getProject(projectId);
    if (!project) {
      return errorResponse("Project not found", 404);
    }

    const latestRun = await getLatestRunForProject(projectId);

    // Fetch all feedback items
    const allItems = await db
      .select({
        id: feedbackItems.id,
        rating: feedbackItems.rating,
        sentiment: feedbackItems.sentiment,
        sentimentScore: feedbackItems.sentimentScore,
        emotion: feedbackItems.emotion,
        occurredAt: feedbackItems.occurredAt,
        analysisStatus: feedbackItems.analysisStatus,
        aspects: feedbackItems.aspects,
        isChurnRisk: feedbackItems.isChurnRisk,
      })
      .from(feedbackItems)
      .where(eq(feedbackItems.projectId, projectId));

    const totalItems = allItems.length;
    const analyzedItems = allItems.filter((i) => i.analysisStatus === "done");

    // Sentiment breakdown
    let positiveCount = 0;
    let neutralCount = 0;
    let negativeCount = 0;
    let totalScore = 0;
    let churnRiskCount = 0;

    for (const item of analyzedItems) {
      if (item.sentiment === "positive") positiveCount++;
      else if (item.sentiment === "negative") negativeCount++;
      else if (item.sentiment === "neutral") neutralCount++;

      if (typeof item.sentimentScore === "number") {
        totalScore += item.sentimentScore;
      }
      if (item.isChurnRisk) churnRiskCount++;
    }

    const overallSentimentScore =
      analyzedItems.length > 0 ? totalScore / analyzedItems.length : 0;

    // Date range
    const validDates = allItems
      .map((i) => i.occurredAt)
      .filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    const minDate = validDates[0] ? validDates[0].toISOString() : null;
    const maxDate = validDates[validDates.length - 1]
      ? validDates[validDates.length - 1].toISOString()
      : null;

    // Sentiment over time (bucketed by month or week)
    const timeMap = new Map<string, { date: string; positive: number; neutral: number; negative: number; avgScore: number; count: number; totalScore: number }>();

    for (const item of analyzedItems) {
      if (!item.occurredAt) continue;
      const d = new Date(item.occurredAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      const existing = timeMap.get(key) || {
        date: key,
        positive: 0,
        neutral: 0,
        negative: 0,
        avgScore: 0,
        count: 0,
        totalScore: 0,
      };

      if (item.sentiment === "positive") existing.positive++;
      else if (item.sentiment === "negative") existing.negative++;
      else if (item.sentiment === "neutral") existing.neutral++;

      if (typeof item.sentimentScore === "number") {
        existing.totalScore += item.sentimentScore;
      }
      existing.count++;
      existing.avgScore = existing.totalScore / existing.count;

      timeMap.set(key, existing);
    }

    const sentimentOverTime = Array.from(timeMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // Aspect Sentiment aggregation
    const aspectMap = new Map<
      string,
      { aspect: string; positive: number; neutral: number; negative: number; total: number }
    >();

    for (const item of analyzedItems) {
      if (Array.isArray(item.aspects)) {
        for (const asp of item.aspects) {
          const key = asp.aspect;
          const current = aspectMap.get(key) || {
            aspect: key,
            positive: 0,
            neutral: 0,
            negative: 0,
            total: 0,
          };

          if (asp.sentiment === "positive") current.positive++;
          else if (asp.sentiment === "negative") current.negative++;
          else current.neutral++;

          current.total++;
          aspectMap.set(key, current);
        }
      }
    }

    const aspectSentiment = Array.from(aspectMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    // Fetch themes and recommendations if a run exists
    let runThemes: any[] = [];
    let runRecommendations: any[] = [];

    if (latestRun) {
      runThemes = await db
        .select()
        .from(themes)
        .where(eq(themes.runId, latestRun.id))
        .orderBy(desc(themes.priorityScore));

      runRecommendations = await db
        .select()
        .from(recommendations)
        .where(eq(recommendations.runId, latestRun.id))
        .orderBy(recommendations.rank);
    }

    return successResponse({
      project,
      latestRun,
      stats: {
        totalItems,
        analyzedCount: analyzedItems.length,
        overallSentimentScore: Math.round(overallSentimentScore * 100) / 100,
        positiveCount,
        neutralCount,
        negativeCount,
        positivePct: analyzedItems.length > 0 ? Math.round((positiveCount / analyzedItems.length) * 100) : 0,
        neutralPct: analyzedItems.length > 0 ? Math.round((neutralCount / analyzedItems.length) * 100) : 0,
        negativePct: analyzedItems.length > 0 ? Math.round((negativeCount / analyzedItems.length) * 100) : 0,
        churnRiskCount,
        minDate,
        maxDate,
      },
      sentimentDistribution: [
        { name: "Positive", value: positiveCount, color: "#10b981" },
        { name: "Neutral", value: neutralCount, color: "#f59e0b" },
        { name: "Negative", value: negativeCount, color: "#ef4444" },
      ],
      sentimentOverTime,
      aspectSentiment,
      themes: runThemes,
      recommendations: runRecommendations,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
