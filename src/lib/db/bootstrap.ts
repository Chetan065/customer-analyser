import { neon } from "@neondatabase/serverless";
import { env } from "@/lib/env";

let isInitialized = false;
let initPromise: Promise<boolean> | null = null;

const DDL_STATEMENTS: string[] = [
  // 1. Vector extension
  `CREATE EXTENSION IF NOT EXISTS vector;`,

  // 2. Users table (for native zero-package auth)
  `CREATE TABLE IF NOT EXISTS "users" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "email" text NOT NULL,
    "password_hash" text NOT NULL,
    "name" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "users_email_unique" UNIQUE("email")
  );`,

  // 3. Sessions table
  `CREATE TABLE IF NOT EXISTS "sessions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "token" text NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "sessions_token_unique" UNIQUE("token")
  );`,

  // 4. Projects table
  `CREATE TABLE IF NOT EXISTS "projects" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
    "name" text NOT NULL,
    "description" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,

  // 5. Analysis Runs table
  `CREATE TABLE IF NOT EXISTS "analysis_runs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
    "status" text DEFAULT 'queued' NOT NULL,
    "stage" text DEFAULT 'queued' NOT NULL,
    "progress" integer DEFAULT 0 NOT NULL,
    "total_items" integer DEFAULT 0 NOT NULL,
    "error" text,
    "started_at" timestamp with time zone DEFAULT now() NOT NULL,
    "finished_at" timestamp with time zone,
    "summary_stats" jsonb
  );`,

  // 6. Feedback Items table
  `CREATE TABLE IF NOT EXISTS "feedback_items" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
    "text" text NOT NULL,
    "text_hash" text NOT NULL,
    "rating" integer,
    "source" text,
    "product_version" text,
    "occurred_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "analysis_status" text DEFAULT 'pending' NOT NULL,
    "sentiment" text,
    "sentiment_score" real,
    "confidence" real,
    "emotion" text,
    "is_churn_risk" boolean DEFAULT false NOT NULL,
    "summary" text,
    "aspects" jsonb,
    "customer_id" text,
    "order_count" integer,
    "is_repeat_customer" boolean DEFAULT false,
    "customer_segment" text,
    "region" text,
    "product" text
  );`,

  // 7. Themes table
  `CREATE TABLE IF NOT EXISTS "themes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "run_id" uuid NOT NULL REFERENCES "analysis_runs"("id") ON DELETE CASCADE,
    "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
    "kind" text NOT NULL,
    "name" text NOT NULL,
    "summary" text NOT NULL,
    "mentions" integer DEFAULT 0 NOT NULL,
    "avg_sentiment" real DEFAULT 0 NOT NULL,
    "severity_score" real DEFAULT 0 NOT NULL,
    "severity_label" text DEFAULT 'Low' NOT NULL,
    "priority_score" real DEFAULT 0 NOT NULL,
    "churn_share" real DEFAULT 0 NOT NULL,
    "recency_share" real DEFAULT 0 NOT NULL
  );`,

  // 8. Insights table (with 768-dim Google Gemini embeddings)
  `CREATE TABLE IF NOT EXISTS "insights" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
    "feedback_item_id" uuid NOT NULL REFERENCES "feedback_items"("id") ON DELETE CASCADE,
    "kind" text NOT NULL,
    "text" text NOT NULL,
    "severity" integer,
    "embedding" vector(768),
    "theme_id" uuid REFERENCES "themes"("id") ON DELETE SET NULL
  );`,

  // 9. Recommendations table
  `CREATE TABLE IF NOT EXISTS "recommendations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "run_id" uuid NOT NULL REFERENCES "analysis_runs"("id") ON DELETE CASCADE,
    "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
    "title" text NOT NULL,
    "rationale" text NOT NULL,
    "impact" text NOT NULL,
    "effort" text NOT NULL,
    "theme_ids" jsonb NOT NULL,
    "evidence_quotes" jsonb NOT NULL,
    "rank" integer DEFAULT 0 NOT NULL
  );`,

  // 10. Chat Threads table
  `CREATE TABLE IF NOT EXISTS "chat_threads" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
    "title" text DEFAULT 'New Conversation' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,

  // 11. Chat Messages table
  `CREATE TABLE IF NOT EXISTS "chat_messages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "thread_id" uuid NOT NULL REFERENCES "chat_threads"("id") ON DELETE CASCADE,
    "role" text NOT NULL,
    "content" text NOT NULL,
    "structured_payload" jsonb,
    "filters" jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`,

  // Migration patches in case tables were partially created before
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE;`,
  `ALTER TABLE "insights" ALTER COLUMN "embedding" SET DATA TYPE vector(768);`,
  `ALTER TABLE "feedback_items" ADD COLUMN IF NOT EXISTS "customer_id" text;`,
  `ALTER TABLE "feedback_items" ADD COLUMN IF NOT EXISTS "order_count" integer;`,
  `ALTER TABLE "feedback_items" ADD COLUMN IF NOT EXISTS "is_repeat_customer" boolean DEFAULT false;`,
  `ALTER TABLE "feedback_items" ADD COLUMN IF NOT EXISTS "customer_segment" text;`,
  `ALTER TABLE "feedback_items" ADD COLUMN IF NOT EXISTS "region" text;`,
  `ALTER TABLE "feedback_items" ADD COLUMN IF NOT EXISTS "product" text;`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS "sessions_token_idx" ON "sessions" USING btree ("token");`,
  `CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" USING btree ("user_id");`,
  `CREATE INDEX IF NOT EXISTS "analysis_runs_project_idx" ON "analysis_runs" USING btree ("project_id");`,
  `CREATE INDEX IF NOT EXISTS "feedback_project_idx" ON "feedback_items" USING btree ("project_id");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "feedback_project_hash_idx" ON "feedback_items" USING btree ("project_id", "text_hash");`,
  `CREATE INDEX IF NOT EXISTS "feedback_project_repeat_idx" ON "feedback_items" USING btree ("project_id", "is_repeat_customer");`,
  `CREATE INDEX IF NOT EXISTS "feedback_project_segment_idx" ON "feedback_items" USING btree ("project_id", "customer_segment");`,
  `CREATE INDEX IF NOT EXISTS "feedback_project_sentiment_idx" ON "feedback_items" USING btree ("project_id", "sentiment");`,
  `CREATE INDEX IF NOT EXISTS "insights_project_kind_idx" ON "insights" USING btree ("project_id", "kind");`,
  `CREATE INDEX IF NOT EXISTS "insights_feedback_item_idx" ON "insights" USING btree ("feedback_item_id");`,
  `CREATE INDEX IF NOT EXISTS "insights_theme_idx" ON "insights" USING btree ("theme_id");`,
  `CREATE INDEX IF NOT EXISTS "recommendations_run_rank_idx" ON "recommendations" USING btree ("run_id", "rank");`,
  `CREATE INDEX IF NOT EXISTS "recommendations_project_idx" ON "recommendations" USING btree ("project_id");`,
  `CREATE INDEX IF NOT EXISTS "themes_run_priority_idx" ON "themes" USING btree ("run_id", "priority_score");`,
  `CREATE INDEX IF NOT EXISTS "themes_project_idx" ON "themes" USING btree ("project_id");`,
  `CREATE INDEX IF NOT EXISTS "chat_threads_project_updated_idx" ON "chat_threads" USING btree ("project_id", "updated_at");`,
  `CREATE INDEX IF NOT EXISTS "chat_messages_thread_created_idx" ON "chat_messages" USING btree ("thread_id", "created_at");`
];

/**
 * Automatically creates all tables, foreign keys, vector extensions, and indexes
 * in Neon Postgres if they do not already exist.
 * Completely idempotent and safe to run on every worker boot.
 */
export async function ensureDatabaseSchema(force = false): Promise<boolean> {
  if (isInitialized && !force) return true;
  if (initPromise && !force) return initPromise;

  initPromise = (async () => {
    try {
      if (!env.DATABASE_URL || env.DATABASE_URL.includes("localhost:5432/mock")) {
        return false;
      }

      const sql = neon(env.DATABASE_URL);

      // Execute each DDL statement individually because Neon HTTP prepared statements
      // do not allow multiple SQL commands in a single query.
      for (const stmt of DDL_STATEMENTS) {
        try {
          await sql.query(stmt);
        } catch (stmtErr: any) {
          // If a constraint or column already exists, continue gracefully
          console.warn("[Bootstrap Notice] DDL statement notice:", stmtErr.message);
        }
      }

      // Verify that tables exist in information_schema
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public';
      `;

      if (tables.length > 0) {
        isInitialized = true;
        console.log(`✅ Neon Postgres database verified with ${tables.length} tables:`, tables.map((t: any) => t.table_name).join(", "));
        return true;
      } else {
        console.error("❌ Neon Postgres database bootstrap completed but 0 tables were found.");
        isInitialized = false;
        initPromise = null;
        return false;
      }
    } catch (err) {
      console.error("Failed to auto-initialize database schema:", err);
      isInitialized = false;
      initPromise = null;
      return false;
    }
  })();

  return initPromise;
}
