CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "analysis_runs" (
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
--> statement-breakpoint
CREATE TABLE "feedback_items" (
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
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"feedback_item_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"severity" integer,
	"embedding" vector(1536),
	"theme_id" uuid
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
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
--> statement-breakpoint
CREATE TABLE "themes" (
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
--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD CONSTRAINT "analysis_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_items" ADD CONSTRAINT "feedback_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_feedback_item_id_feedback_items_id_fk" FOREIGN KEY ("feedback_item_id") REFERENCES "public"."feedback_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analysis_runs_project_idx" ON "analysis_runs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "feedback_project_idx" ON "feedback_items" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_project_hash_idx" ON "feedback_items" USING btree ("project_id","text_hash");--> statement-breakpoint
CREATE INDEX "insights_project_kind_idx" ON "insights" USING btree ("project_id","kind");--> statement-breakpoint
CREATE INDEX "insights_feedback_item_idx" ON "insights" USING btree ("feedback_item_id");--> statement-breakpoint
CREATE INDEX "insights_theme_idx" ON "insights" USING btree ("theme_id");--> statement-breakpoint
CREATE INDEX "recommendations_run_rank_idx" ON "recommendations" USING btree ("run_id","rank");--> statement-breakpoint
CREATE INDEX "recommendations_project_idx" ON "recommendations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "themes_run_priority_idx" ON "themes" USING btree ("run_id","priority_score");--> statement-breakpoint
CREATE INDEX "themes_project_idx" ON "themes" USING btree ("project_id");