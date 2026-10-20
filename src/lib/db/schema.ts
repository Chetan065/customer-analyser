import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  vector,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// 1. Users Table (Simple Email & Password Auth)
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 2. Sessions Table
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sessions_token_idx").on(table.token),
    index("sessions_user_idx").on(table.userId),
  ]
);

// 3. Projects Table
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 4. Feedback Items Table
export const feedbackItems = pgTable(
  "feedback_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    textHash: text("text_hash").notNull(),
    rating: integer("rating"),
    source: text("source"),
    productVersion: text("product_version"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    analysisStatus: text("analysis_status", {
      enum: ["pending", "done", "failed"],
    })
      .notNull()
      .default("pending"),
    sentiment: text("sentiment", {
      enum: ["positive", "neutral", "negative"],
    }),
    sentimentScore: real("sentiment_score"), // -1.0 to 1.0
    confidence: real("confidence"), // 0 to 1
    emotion: text("emotion"),
    isChurnRisk: boolean("is_churn_risk").default(false).notNull(),
    summary: text("summary"),
    aspects: jsonb("aspects").$type<
      Array<{ aspect: string; sentiment: "positive" | "neutral" | "negative" }>
    >(),
    // Customer Segment & Identity Dimensions (Phase 2)
    customerId: text("customer_id"),
    orderCount: integer("order_count"),
    isRepeatCustomer: boolean("is_repeat_customer").default(false),
    customerSegment: text("customer_segment"),
    region: text("region"),
    product: text("product"),
  },
  (table) => [
    index("feedback_project_idx").on(table.projectId),
    uniqueIndex("feedback_project_hash_idx").on(table.projectId, table.textHash),
    index("feedback_project_repeat_idx").on(table.projectId, table.isRepeatCustomer),
    index("feedback_project_segment_idx").on(table.projectId, table.customerSegment),
    index("feedback_project_sentiment_idx").on(table.projectId, table.sentiment),
  ]
);

// 5. Analysis Runs Table
export const analysisRuns = pgTable(
  "analysis_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["queued", "running", "completed", "failed"],
    })
      .notNull()
      .default("queued"),
    stage: text("stage").notNull().default("queued"),
    progress: integer("progress").notNull().default(0), // 0..100
    totalItems: integer("total_items").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    summaryStats: jsonb("summary_stats").$type<{
      totalProcessed?: number;
      tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
      estimatedCostUsd?: number;
      sentimentCounts?: { positive: number; neutral: number; negative: number };
      averageSentiment?: number;
    }>(),
  },
  (table) => [index("analysis_runs_project_idx").on(table.projectId)]
);

// 6. Themes Table
export const themes = pgTable(
  "themes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["pain_point", "feature_request"],
    }).notNull(),
    name: text("name").notNull(),
    summary: text("summary").notNull(),
    mentions: integer("mentions").notNull().default(0),
    avgSentiment: real("avg_sentiment").notNull().default(0),
    severityScore: real("severity_score").notNull().default(0),
    severityLabel: text("severity_label").notNull().default("Low"), // Low, Medium, High, Critical
    priorityScore: real("priority_score").notNull().default(0),
    churnShare: real("churn_share").notNull().default(0),
    recencyShare: real("recency_share").notNull().default(0),
  },
  (table) => [
    index("themes_run_priority_idx").on(table.runId, table.priorityScore),
    index("themes_project_idx").on(table.projectId),
  ]
);

// 7. Insights Table (Pain Points and Feature Requests with 768-dim Google Gemini embeddings)
export const insights = pgTable(
  "insights",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    feedbackItemId: uuid("feedback_item_id")
      .notNull()
      .references(() => feedbackItems.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["pain_point", "feature_request"],
    }).notNull(),
    text: text("text").notNull(),
    severity: integer("severity"), // 1..5 for pain points
    embedding: vector("embedding", { dimensions: 768 }),
    themeId: uuid("theme_id").references(() => themes.id, { onDelete: "set null" }),
  },
  (table) => [
    index("insights_project_kind_idx").on(table.projectId, table.kind),
    index("insights_feedback_item_idx").on(table.feedbackItemId),
    index("insights_theme_idx").on(table.themeId),
  ]
);

// 8. Recommendations Table
export const recommendations = pgTable(
  "recommendations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    rationale: text("rationale").notNull(),
    impact: text("impact", { enum: ["low", "medium", "high"] }).notNull(),
    effort: text("effort", { enum: ["S", "M", "L"] }).notNull(),
    themeIds: jsonb("theme_ids").$type<string[]>().notNull(),
    evidenceQuotes: jsonb("evidence_quotes").$type<string[]>().notNull(),
    rank: integer("rank").notNull().default(0),
  },
  (table) => [
    index("recommendations_run_rank_idx").on(table.runId, table.rank),
    index("recommendations_project_idx").on(table.projectId),
  ]
);

// 9. Chat Threads Table
export const chatThreads = pgTable(
  "chat_threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New Conversation"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("chat_threads_project_updated_idx").on(table.projectId, table.updatedAt),
  ]
);

// 10. Chat Messages Table
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
    content: text("content").notNull(),
    structuredPayload: jsonb("structured_payload").$type<{
      headline?: string;
      keyIssues?: Array<{
        title: string;
        description: string;
        severity: "critical" | "high" | "medium" | "low";
        frequencyCount?: number;
        affectedSegment?: string;
        quoteIds?: string[];
      }>;
      supportingComments?: Array<{
        quote: string;
        feedbackId?: string;
        rating?: number;
        customerSegment?: string;
        source?: string;
        isRepeatCustomer?: boolean;
        grounded?: boolean;
      }>;
      recommendedActions?: Array<{
        title: string;
        rationale: string;
        urgency: "immediate" | "near-term" | "backlog";
        expectedImpact: string;
      }>;
      caveats?: string[];
      followUpQuestions?: string[];
      metrics?: {
        totalAnalyzed: number;
        positiveCount: number;
        neutralCount: number;
        negativeCount: number;
        averageRating?: number | null;
        topSegment?: string;
      };
    }>(),
    filters: jsonb("filters").$type<{
      customerSegment?: string | null;
      isRepeatCustomer?: boolean | null;
      sentiment?: "positive" | "neutral" | "negative" | null;
      aspects?: string[];
      query?: string;
    }>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("chat_messages_thread_created_idx").on(table.threadId, table.createdAt),
  ]
);

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type FeedbackItem = typeof feedbackItems.$inferSelect;
export type NewFeedbackItem = typeof feedbackItems.$inferInsert;

export type AnalysisRun = typeof analysisRuns.$inferSelect;
export type NewAnalysisRun = typeof analysisRuns.$inferInsert;

export type Theme = typeof themes.$inferSelect;
export type NewTheme = typeof themes.$inferInsert;

export type Insight = typeof insights.$inferSelect;
export type NewInsight = typeof insights.$inferInsert;

export type Recommendation = typeof recommendations.$inferSelect;
export type NewRecommendation = typeof recommendations.$inferInsert;

export type ChatThread = typeof chatThreads.$inferSelect;
export type NewChatThread = typeof chatThreads.$inferInsert;

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
