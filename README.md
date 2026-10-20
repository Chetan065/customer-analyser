# Feedback Analyzer — AI Customer Feedback Intelligence App

[![Next.js](https://img.shields.io/badge/Next.js-16_App_Router-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict_Mode-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash-4285F4?logo=google)](https://aistudio.google.com/)
[![Neon Postgres](https://img.shields.io/badge/Neon_Postgres-pgvector_768d-00E599?logo=postgresql)](https://neon.tech/)
[![LangGraph](https://img.shields.io/badge/LangGraph_JS-Orchestration-orange)](https://github.com/langchain-ai/langgraphjs)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)

**Feedback Analyzer** transforms unstructured customer feedback (reviews, support tickets, survey responses, app store comments) into prioritized, explainable product roadmaps and strategic initiatives. Every recurring theme and AI recommendation is directly traceable to verbatim customer evidence quotes.

---

## Table of Contents

1. [Product Overview & Features](#1-product-overview--features)
2. [Architecture & Pipeline Flow](#2-architecture--pipeline-flow)
3. [Tech Stack](#3-tech-stack)
4. [Getting Started & Setup](#4-getting-started--setup)
   - [Prerequisites](#41-prerequisites)
   - [Database Setup on Neon](#42-database-setup-on-neon)
   - [Environment Variables](#43-environment-variables)
   - [Database Push & Migrations](#44-database-push--migrations)
   - [Running the Dev Server](#45-running-the-dev-server)
5. [Native Authentication (Zero External Packages)](#5-native-authentication-zero-external-packages)
6. [Deterministic Priority Scoring Formula](#6-deterministic-priority-scoring-formula)
7. [TypeScript-Native Agglomerative Clustering](#7-typescript-native-agglomerative-clustering)
8. [Vercel Deployment & Chunked Execution Model](#8-vercel-deployment--chunked-execution-model)
9. [Database Schema](#9-database-schema)
10. [Unit Tests & Verification](#10-unit-tests--verification)
11. [Export Options](#11-export-options)
12. [Known Limitations & Roadmap](#12-known-limitations--roadmap)

---

## 1. Product Overview & Features

### 1.1 Ingestion & Pre-processing
- **CSV Upload (Drag & Drop)**: Automatic header detection for feedback text, numeric star rating (1–5), source platform, product version, and timestamp. Includes a 20-row preview before confirming import.
- **Paste Text**: Ingest feedback directly from text areas, separated by paragraphs or newlines.
- **One-Click Demo Dataset**: Pre-bundled with **157 realistic customer reviews** for *CloudFlow SaaS* (`/src/data/sample-reviews.csv`) covering recurring bugs (CSV export crashes, calendar sync auth token expiration, iOS notifications), pricing/churn complaints, feature requests, and mixed sentiment.
- **Deduplication**: Deterministic SHA-256 hash check prevents duplicate entries within projects. Capped at 2,000 items per import in v1.

### 1.2 Multi-Stage AI Pipeline
1. **Structured Sentiment & Emotion Extraction**: Batched processing (15 items/call) via Google Gemini `gemini-2.5-flash` with strict Zod schemas (`sentimentScore`: -1.0 to +1.0, primary emotion, aspect-level sentiments, churn risk flags).
2. **Granular Vector Embeddings**: Pain points and feature requests are embedded as separate statements using Google Gemini `text-embedding-004` (768 dimensions) and stored in Neon Postgres `vector(768)` columns.
3. **Agglomerative Clustering**: Groups semantically similar pain points and feature requests separately in pure TypeScript with cosine similarity ($\ge 0.78$) and merges isolated singletons.
4. **Concrete Theme Naming**: Synthesizes specific, actionable theme titles ($\le 6$ words, e.g. *"CSV export crash on large boards"*) instead of vague labels (*"Performance issues"*).
5. **Deterministic Priority Scoring**: Ranks themes mathematically based on frequency, severity, negativity, churn risk, and recency velocity.
6. **Data-Driven Strategic Recommendations**: 5–8 prioritized initiative cards with impact, effort (S/M/L), linked themes, and **verbatim-verified evidence quotes**.

### 1.3 Interactive Dashboard
- **Executive Summary Header**: Total items, overall sentiment score (-1 to +1), % pos/neu/neg, churn alerts, and "How Scores Work" popover.
- **Sentiment Overview**: Recharts donut chart of sentiment share + Area chart of customer sentiment velocity over time.
- **Priority Matrix Table**: Ranked themes with type badges, mentions count/% of feedback, severity badges (Low/Medium/High/Critical), and visual priority bars. Clicking any row opens the **Theme Detail Drawer**.
- **Pain Points vs. Feature Requests**: Side-by-side ranked lists of top 10 friction points and top 10 customer requests.
- **Aspect Sentiment Breakdown**: Stacked bar chart of sentiment by product area (Pricing, Performance, UI/UX, Support, Onboarding, Reliability, Integrations, Docs).
- **Recommendation Cards**: Actionable initiatives with "Copy as Markdown" for roadmapping in Jira, Linear, or Notion.
- **Feedback Explorer**: Full search, filtering (by sentiment, rating, source), and individual feedback inspection dialogs.

---

## 2. Architecture & Pipeline Flow

```mermaid
flowchart TD
    User([User Ingests CSV or Pastes Feedback]) --> Ingest[Parse, Clean & SHA-256 Dedupe]
    Ingest --> DB[(Neon Postgres + pgvector)]

    subgraph Serverless Pipeline [Resumable Step Runner — /api/runs/:runId/step]
      direction TB
      Step1[Stage 1: Batch Gemini Classification] -->|Structured Output| Extract[Extract Sentiment, Aspects, Pain Points & Requests]
      Extract --> Step2[Stage 2: Batched Gemini Embeddings]
      Step2 -->|768-dim text-embedding-004| StoreVec[Store in insights table]
      StoreVec --> Step3[Stage 3: TS Agglomerative Clustering]
      Step3 -->|Cosine Sim >= 0.78 & Singleton Merge| Clusters[Group Separate Pain Points & Requests]
      Clusters --> Step4[Stage 4: Gemini Theme Labeling & Math Scoring]
      Step4 -->|Deterministic Priority Formula| Themes[(Ranked Themes)]
      Themes --> Step5[Stage 5: Gemini Strategic Recommendations]
      Step5 -->|Verbatim Substring Validation| Recs[(Recommendations with Real Quotes)]
    end

    DB --> Serverless Pipeline
    Recs --> Dashboard[Interactive Intelligence Dashboard & Theme Drawer]
    Dashboard --> Export[Export CSV / JSON / Markdown Report]
```

---

## 3. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | Server components, API route handlers, Turbopack |
| **Language** | TypeScript (Strict Mode) | End-to-end type safety |
| **LLM & Embeddings** | Google Gemini (`gemini-2.5-flash` + `text-embedding-004`) | High-speed structured inference and 768d vector embeddings |
| **AI Orchestration** | LangChain JS + LangGraph JS | Graph-based pipeline orchestration |
| **Database** | Neon Serverless Postgres (`@neondatabase/serverless`) | HTTP connection pooling for serverless environments |
| **Vector Storage** | `pgvector` (`vector(768)`) | High-dimensional similarity indexing |
| **ORM & Migrations** | Drizzle ORM + `drizzle-kit` | Typed schema and database migrations |
| **Authentication** | Native Node.js `crypto` + HTTP-only cookies | Zero-external-dependency email & password auth |
| **Styling & Components**| Tailwind CSS v4 + Radix UI primitives | Modern responsive UI, accessible dialogs, dark/light mode |
| **Charts** | Recharts | Donut charts, area charts, aspect breakdown bars |
| **Testing** | Vitest | Unit test coverage for scoring, clustering, parsing, and auth |

---

## 4. Getting Started & Setup

### 4.1 Prerequisites
- **Node.js**: `v20.x` or later
- **Package Manager**: `pnpm` (recommended) or `npm`
- **Google Gemini API Key**: Obtainable from [Google AI Studio](https://aistudio.google.com/)
- **Neon Postgres Database**: Free instance from [neon.tech](https://neon.tech)

### 4.2 Database Setup on Neon
1. Log into [Neon](https://neon.tech) and create a new project.
2. The initial migration automatically enables `pgvector` via `CREATE EXTENSION IF NOT EXISTS vector;`.
3. In your Neon dashboard, copy the **Pooled connection string** (`-pooler`).

### 4.3 Environment Variables
Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Populate the configuration:

```env
# Google Gemini API Configuration
GEMINI_API_KEY="AIzaSyYourGeminiApiKeyHere"
GEMINI_MODEL="gemini-2.5-flash"
GEMINI_EMBEDDING_MODEL="text-embedding-004"

# Neon Postgres with pgvector (Pooled connection string)
DATABASE_URL="postgresql://user:password@ep-sample-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Auth Secret for session validation
AUTH_SECRET="your-super-secret-key-change-this-in-production"
```

### 4.4 Database Push & Migrations
Push all tables, indexes, and vector columns directly to your database:

```bash
pnpm db:push
```

*(Optional) To inspect or generate migration SQL files:*
```bash
pnpm db:generate
```

### 4.5 Running the Dev Server
Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Instant Demo**: On the `/login` screen, click **"One-Click Demo Account"** to sign in instantly with a pre-configured account, or create a new account via the register screen.

---

## 5. Native Authentication (Zero External Packages)

To ensure maximum reliability and prevent third-party vendor lock-in or peer dependency conflicts, authentication is built entirely using native Node.js cryptographic primitives:

- **Password Hashing**: Implemented in [`src/lib/auth/password.ts`](file:///Volumes/ssd/f/src/lib/auth/password.ts) using `crypto.pbkdf2Sync` (100,000 iterations, SHA-512) with a unique 16-byte random salt per user.
- **Timing Attack Prevention**: Password comparison is executed via `crypto.timingSafeEqual`.
- **Session Tokens**: 32-byte cryptographically secure random tokens stored in the `sessions` table and delivered via secure `httpOnly`, `sameSite: "lax"` cookies (`fa_session`).
- **Route Protection**: Next.js middleware ([`src/middleware.ts`](file:///Volumes/ssd/f/src/middleware.ts)) guards `/projects/*` routes and redirects unauthenticated users to `/login`.
- **Multi-Tenant Data Scoping**: All projects are linked to the authenticated user's `user_id`.

---

## 6. Deterministic Priority Scoring Formula

Theme priority is calculated deterministically in code ([`src/lib/analysis/scoring.ts`](file:///Volumes/ssd/f/src/lib/analysis/scoring.ts)) rather than relying on LLM guesses:

$$\text{priorityScore} = 100 \times \left(0.40 \cdot \text{normFrequency} + 0.30 \cdot \text{severity} + 0.15 \cdot \text{negativity} + 0.10 \cdot \text{churn} + 0.05 \cdot \text{recency}\right)$$

### Factor Breakdown:
| Factor | Weight | Description |
|---|---|---|
| **`normFrequency`** | **40%** | Mentions scaled relative to the highest-mention theme ($0..1$). |
| **`severity`** | **30%** | For pain points: mean severity (1–5 mapped to $0.2..1.0$). For feature requests: mean $\|sentimentScore\|$ of source items (capped at 0.6). |
| **`negativity`** | **15%** | Measured as $\max(0, -\text{avgSentimentScore})$ ($0..1$). |
| **`churn`** | **10%** | Proportion of mentioning items flagged as churn risks ($0..1$). |
| **`recency`** | **5%** | Share of mentions occurring in the most recent 30% of the project date range (defaults to 0.5 if dates are missing). |

### Severity Label Mapping:
- **Low**: $\text{score} < 0.35$
- **Medium**: $0.35 \le \text{score} < 0.60$
- **High**: $0.60 \le \text{score} < 0.80$
- **Critical**: $\text{score} \ge 0.80$

Weights and thresholds can be tuned in a single file: [`src/lib/analysis/scoring.config.ts`](file:///Volumes/ssd/f/src/lib/analysis/scoring.config.ts).

---

## 7. TypeScript-Native Agglomerative Clustering

Clustering runs in pure TypeScript ([`src/lib/analysis/clustering.ts`](file:///Volumes/ssd/f/src/lib/analysis/clustering.ts)) without requiring Python microservices:
1. **Cosine Similarity**: Vector comparison using dot product normalization across 768 dimensions.
2. **Agglomerative Linking**: Clusters are merged iteratively using average linkage until maximum similarity falls below `0.78`.
3. **Singleton Cluster Merging**: Clusters with only 1 item are merged into the nearest existing cluster if cosine similarity $\ge 0.70$. Remaining singletons are gathered under long-tail themes.
4. **Domain Separation**: Pain points and feature requests are clustered in independent passes to prevent conflating bugs with new feature ideas.

---

## 8. Vercel Deployment & Chunked Execution Model

### The Problem with Monolithic LLM Pipelines
Standard LLM pipelines for 150+ reviews take 60–120+ seconds, which causes **504 Gateway Timeouts** on serverless runtimes (Vercel, AWS Lambda).

### The Solution: Resumable Step Runner
Feedback Analyzer utilizes an **idempotent, chunked execution model**:
1. `POST /api/projects/:id/analyze`: Creates an `analysis_runs` record with status `queued`.
2. `POST /api/runs/:runId/step`: Executes one bounded unit of work (e.g. 15 items for Gemini classification, one embedding batch, or the clustering step) and saves progress to Neon.
3. The client loops calling `/step` with live progress (0% to 100%).
4. If a user refreshes or closes the tab, execution state is preserved in Postgres and resumes seamlessly.

### Deploying to Vercel:
1. Push this repository to GitHub or GitLab.
2. Import the project in the [Vercel Dashboard](https://vercel.com).
3. Set the Environment Variables:
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` (`gemini-2.5-flash`)
   - `GEMINI_EMBEDDING_MODEL` (`text-embedding-004`)
   - `DATABASE_URL` (use your pooled Neon connection string)
   - `AUTH_SECRET`
4. Deploy! All routes build as standard Node.js serverless functions.

---

## 9. Database Schema

The database utilizes 8 relational tables managed via Drizzle ORM:

```
users (id, email, password_hash, name, created_at)
  └── sessions (id, user_id, token, expires_at, created_at)
  └── projects (id, user_id, name, description, created_at)
        ├── feedback_items (id, project_id, text, text_hash, rating, source, product_version, occurred_at, analysis_status, sentiment, sentiment_score, confidence, emotion, is_churn_risk, summary, aspects)
        ├── analysis_runs (id, project_id, status, stage, progress, total_items, error, started_at, finished_at, summary_stats)
        │     ├── themes (id, run_id, project_id, kind, name, summary, mentions, avg_sentiment, severity_score, severity_label, priority_score, churn_share, recency_share)
        │     └── recommendations (id, run_id, project_id, title, rationale, impact, effort, theme_ids, evidence_quotes, rank)
        └── insights (id, project_id, feedback_item_id, kind, text, severity, embedding: vector(768), theme_id)
```

---

## 10. Unit Tests & Verification

The project includes unit tests covering core mathematical and ingestion helpers.

Run the test suite with Vitest:

```bash
pnpm test
```

### Verified Test Suites:
- [`tests/auth.test.ts`](file:///Volumes/ssd/f/tests/auth.test.ts): PBKDF2 password hashing, salt uniqueness, constant-time verification, and malformed hash rejection.
- [`tests/scoring.test.ts`](file:///Volumes/ssd/f/tests/scoring.test.ts): Priority formula calculation, weights, severity label thresholds, and recency share.
- [`tests/clustering.test.ts`](file:///Volumes/ssd/f/tests/clustering.test.ts): Exact cosine similarity, centroid calculations, agglomerative clustering, and singleton merging.
- [`tests/csv.test.ts`](file:///Volumes/ssd/f/tests/csv.test.ts): CSV header auto-detection, text normalization, SHA-256 deduplication hashing, and language detection.

### Production Build Verification:
```bash
pnpm build
```
Compiles with Turbopack with **zero TypeScript errors** across all 27 application routes and middleware.

---

## 11. Export Options

Analysis outputs can be downloaded at any time from the dashboard:
- **Executive Markdown Report (`?format=md`)**: Formatted product memo summarizing the executive breakdown, top ranked themes, and strategic recommendations with customer quotes.
- **Labeled Feedback CSV (`?format=csv`)**: Complete dataset with original reviews, sentiment labels, scores, emotions, and churn risk tags.
- **Full Intelligence JSON (`?format=json`)**: Raw JSON export of all themes, recommendations, insights, and aggregate metrics.

---

## 12. Known Limitations & Roadmap

- **Upload Cap**: Ingestion is capped at 2,000 items per batch in v1 to ensure optimal memory limits in serverless execution.
- **Vector Indexing**: Queries currently leverage indexed theme foreign keys. For datasets exceeding 50,000 feedback items, an HNSW cosine index (`CREATE INDEX ON insights USING hnsw (embedding vector_cosine_ops)`) can be applied.
- **Multi-Tenant Workspaces**: Simple auth supports individual accounts. Shared organization workspaces and role-based access control (Admin/Viewer) can be added on top of the existing `projects` structure.
