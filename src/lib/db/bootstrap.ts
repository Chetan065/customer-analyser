import { neon } from "@neondatabase/serverless";
import { env } from "@/lib/env";

let isInitialized = false;
let initPromise: Promise<boolean> | null = null;

const SCHEMA_BOOTSTRAP_SQL = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);

CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "analysis_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"stage" text DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"summary_stats" jsonb
);

CREATE TABLE IF NOT EXISTS "feedback_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
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
	"aspects" jsonb
);

CREATE TABLE IF NOT EXISTS "themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
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
);

CREATE TABLE IF NOT EXISTS "insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"feedback_item_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"severity" integer,
	"embedding" vector(768),
	"theme_id" uuid
);

CREATE TABLE IF NOT EXISTS "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"rationale" text NOT NULL,
	"impact" text NOT NULL,
	"effort" text NOT NULL,
	"theme_ids" jsonb NOT NULL,
	"evidence_quotes" jsonb NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL
);

-- Foreign Key Constraints (added safely if not already present)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_user_id_users_id_fk') THEN
    ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_user_id_users_id_fk') THEN
    ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'analysis_runs_project_id_projects_id_fk') THEN
    ALTER TABLE "analysis_runs" ADD CONSTRAINT "analysis_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feedback_items_project_id_projects_id_fk') THEN
    ALTER TABLE "feedback_items" ADD CONSTRAINT "feedback_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'insights_project_id_projects_id_fk') THEN
    ALTER TABLE "insights" ADD CONSTRAINT "insights_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'insights_feedback_item_id_feedback_items_id_fk') THEN
    ALTER TABLE "insights" ADD CONSTRAINT "insights_feedback_item_id_feedback_items_id_fk" FOREIGN KEY ("feedback_item_id") REFERENCES "public"."feedback_items"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'insights_theme_id_themes_id_fk') THEN
    ALTER TABLE "insights" ADD CONSTRAINT "insights_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recommendations_run_id_analysis_runs_id_fk') THEN
    ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recommendations_project_id_projects_id_fk') THEN
    ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'themes_run_id_analysis_runs_id_fk') THEN
    ALTER TABLE "themes" ADD CONSTRAINT "themes_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'themes_project_id_projects_id_fk') THEN
    ALTER TABLE "themes" ADD CONSTRAINT "themes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

-- Indexes (Safe)
CREATE INDEX IF NOT EXISTS "sessions_token_idx" ON "sessions" USING btree ("token");
CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "analysis_runs_project_idx" ON "analysis_runs" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "feedback_project_idx" ON "feedback_items" USING btree ("project_id");
CREATE UNIQUE INDEX IF NOT EXISTS "feedback_project_hash_idx" ON "feedback_items" USING btree ("project_id","text_hash");
CREATE INDEX IF NOT EXISTS "insights_project_kind_idx" ON "insights" USING btree ("project_id","kind");
CREATE INDEX IF NOT EXISTS "insights_feedback_item_idx" ON "insights" USING btree ("feedback_item_id");
CREATE INDEX IF NOT EXISTS "insights_theme_idx" ON "insights" USING btree ("theme_id");
CREATE INDEX IF NOT EXISTS "recommendations_run_rank_idx" ON "recommendations" USING btree ("run_id","rank");
CREATE INDEX IF NOT EXISTS "recommendations_project_idx" ON "recommendations" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "themes_run_priority_idx" ON "themes" USING btree ("run_id","priority_score");
CREATE INDEX IF NOT EXISTS "themes_project_idx" ON "themes" USING btree ("project_id");
`;

/**
 * Automatically creates all tables, foreign keys, vector extensions, and indexes
 * in Neon Postgres if they do not already exist.
 * Completely idempotent and safe to run on every worker boot.
 */
export async function ensureDatabaseSchema(): Promise<boolean> {
  if (isInitialized) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (!env.DATABASE_URL || env.DATABASE_URL.includes("localhost:5432/mock")) {
        return false;
      }

      const sql = neon(env.DATABASE_URL);
      // Run bootstrap SQL statements using unsafe for raw multi-statement DDL
      // @ts-ignore neon unsafe method
      if (typeof sql.unsafe === "function") {
        await sql.unsafe(SCHEMA_BOOTSTRAP_SQL);
      } else {
        await (sql as any)(SCHEMA_BOOTSTRAP_SQL);
      }
      isInitialized = true;
      console.log("✅ Neon Postgres database schema verified and initialized.");
      return true;
    } catch (err) {
      console.error("Failed to auto-initialize database schema:", err);
      // Reset so future calls can retry
      initPromise = null;
      return false;
    }
  })();

  return initPromise;
}
