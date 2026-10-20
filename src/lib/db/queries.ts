import { eq, desc, asc, and, or, sql, count, inArray, ilike } from "drizzle-orm";
import { db } from "./client";
import {
  projects,
  feedbackItems,
  analysisRuns,
  themes,
  insights,
  recommendations,
  type NewProject,
  type NewFeedbackItem,
  type Project,
  type FeedbackItem,
  type Theme,
  type Recommendation,
  type AnalysisRun,
} from "./schema";

// --- Project Queries ---

export async function listProjects(userId?: string): Promise<Array<Project & { feedbackCount: number; runCount: number }>> {
  const query = db.select().from(projects);
  const allProjects = userId
    ? await query.where(or(eq(projects.userId, userId), sql`${projects.userId} IS NULL`)).orderBy(desc(projects.createdAt))
    : await query.orderBy(desc(projects.createdAt));

  // Get item counts per project
  const results = await Promise.all(
    allProjects.map(async (project) => {
      const [fCount] = await db
        .select({ value: count() })
        .from(feedbackItems)
        .where(eq(feedbackItems.projectId, project.id));

      const [rCount] = await db
        .select({ value: count() })
        .from(analysisRuns)
        .where(eq(analysisRuns.projectId, project.id));

      return {
        ...project,
        feedbackCount: fCount?.value ?? 0,
        runCount: rCount?.value ?? 0,
      };
    })
  );

  return results;
}

export async function createProject(data: NewProject): Promise<Project> {
  const [created] = await db.insert(projects).values(data).returning();
  return created;
}

export async function getProject(id: string): Promise<Project | null> {
  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  return project || null;
}

export async function deleteProject(id: string): Promise<boolean> {
  const result = await db.delete(projects).where(eq(projects.id, id)).returning();
  return result.length > 0;
}

// --- Feedback Queries ---

export interface InsertFeedbackResult {
  insertedCount: number;
  duplicateCount: number;
  totalProvided: number;
}

export async function insertFeedbackBatch(
  projectId: string,
  items: Array<Omit<NewFeedbackItem, "projectId">>
): Promise<InsertFeedbackResult> {
  if (items.length === 0) {
    return { insertedCount: 0, duplicateCount: 0, totalProvided: 0 };
  }

  const valuesToInsert = items.map((item) => ({
    ...item,
    projectId,
  }));

  // Batch insert with onConflictDoNothing on (projectId, textHash)
  // Process in chunks of 100 for efficient SQL batching
  let inserted = 0;
  const chunkSize = 100;

  for (let i = 0; i < valuesToInsert.length; i += chunkSize) {
    const chunk = valuesToInsert.slice(i, i + chunkSize);
    const rows = await db
      .insert(feedbackItems)
      .values(chunk)
      .onConflictDoNothing({
        target: [feedbackItems.projectId, feedbackItems.textHash],
      })
      .returning({ id: feedbackItems.id });

    inserted += rows.length;
  }

  return {
    insertedCount: inserted,
    duplicateCount: items.length - inserted,
    totalProvided: items.length,
  };
}

export interface FeedbackFilterOptions {
  projectId: string;
  sentiment?: "positive" | "neutral" | "negative" | "all";
  rating?: number | "all";
  source?: string | "all";
  q?: string;
  themeId?: string;
  page?: number;
  limit?: number;
}

export async function getFilteredFeedback(options: FeedbackFilterOptions) {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;

  const conditions = [eq(feedbackItems.projectId, options.projectId)];

  if (options.sentiment && options.sentiment !== "all") {
    conditions.push(eq(feedbackItems.sentiment, options.sentiment));
  }

  if (options.rating && options.rating !== "all") {
    conditions.push(eq(feedbackItems.rating, options.rating));
  }

  if (options.source && options.source !== "all") {
    conditions.push(eq(feedbackItems.source, options.source));
  }

  if (options.q && options.q.trim()) {
    conditions.push(ilike(feedbackItems.text, `%${options.q.trim()}%`));
  }

  if (options.themeId) {
    // Subquery on insights referencing this theme
    const linkedFeedback = db
      .select({ feedbackItemId: insights.feedbackItemId })
      .from(insights)
      .where(eq(insights.themeId, options.themeId));

    conditions.push(inArray(feedbackItems.id, linkedFeedback));
  }

  const whereClause = and(...conditions);

  const [totalResult] = await db
    .select({ count: count() })
    .from(feedbackItems)
    .where(whereClause);

  const total = totalResult?.count ?? 0;

  const items = await db
    .select()
    .from(feedbackItems)
    .where(whereClause)
    .orderBy(desc(feedbackItems.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// --- Analysis Runs Queries ---

export async function createAnalysisRun(projectId: string, totalItems: number): Promise<AnalysisRun> {
  const [run] = await db
    .insert(analysisRuns)
    .values({
      projectId,
      status: "queued",
      stage: "queued",
      progress: 0,
      totalItems,
    })
    .returning();

  return run;
}

export async function getAnalysisRun(runId: string): Promise<AnalysisRun | null> {
  const [run] = await db.select().from(analysisRuns).where(eq(analysisRuns.id, runId));
  return run || null;
}

export async function getLatestRunForProject(projectId: string): Promise<AnalysisRun | null> {
  const [run] = await db
    .select()
    .from(analysisRuns)
    .where(eq(analysisRuns.projectId, projectId))
    .orderBy(desc(analysisRuns.startedAt))
    .limit(1);

  return run || null;
}

export async function updateAnalysisRun(
  runId: string,
  updates: Partial<AnalysisRun>
): Promise<AnalysisRun> {
  const [updated] = await db
    .update(analysisRuns)
    .set(updates)
    .where(eq(analysisRuns.id, runId))
    .returning();

  return updated;
}

// --- Themes & Recommendations Queries ---

export async function getThemesForRun(runId: string): Promise<Theme[]> {
  return await db
    .select()
    .from(themes)
    .where(eq(themes.runId, runId))
    .orderBy(desc(themes.priorityScore));
}

export async function getThemeDetail(themeId: string) {
  const [theme] = await db.select().from(themes).where(eq(themes.id, themeId));
  if (!theme) return null;

  // Fetch associated insights and their feedback items
  const linkedInsights = await db
    .select({
      insightId: insights.id,
      text: insights.text,
      kind: insights.kind,
      severity: insights.severity,
      feedbackId: feedbackItems.id,
      feedbackText: feedbackItems.text,
      rating: feedbackItems.rating,
      sentiment: feedbackItems.sentiment,
      sentimentScore: feedbackItems.sentimentScore,
      occurredAt: feedbackItems.occurredAt,
      source: feedbackItems.source,
    })
    .from(insights)
    .innerJoin(feedbackItems, eq(insights.feedbackItemId, feedbackItems.id))
    .where(eq(insights.themeId, themeId))
    .limit(50);

  return {
    theme,
    items: linkedInsights,
  };
}

export async function getRecommendationsForRun(runId: string): Promise<Recommendation[]> {
  return await db
    .select()
    .from(recommendations)
    .where(eq(recommendations.runId, runId))
    .orderBy(asc(recommendations.rank));
}
