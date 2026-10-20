# Feedback Analyzer — AI Customer Feedback Intelligence

Feedback Analyzer is a production-quality web application that turns unstructured customer reviews, support tickets, survey responses, and app store comments into prioritized, data-driven product insights and strategic initiatives. Every recommendation and recurring theme is traceable to verbatim customer evidence quotes.

---

## 1. Architecture & Pipeline Overview

The system orchestrates multi-stage analysis using **Google Gemini**, **LangGraph JS**, and a **resumable, chunked execution model** designed specifically for serverless deployments on Vercel without function timeouts.

```mermaid
flowchart TD
    START([User Ingests CSV / Pastes Feedback]) --> Upload[Parse & SHA-256 Dedupe]
    Upload --> DB[(Neon Postgres + pgvector)]

    subgraph LangGraph Pipeline [Resumable Step Runner]
      direction TB
      Step1[Stage 1: Batch Gemini Classification] -->|Structured Extraction| Sentiment[Extract Sentiment, Aspects, Pain Points & Requests]
      Sentiment --> Step2[Stage 2: Batched Gemini Embeddings]
      Step2 -->|768-dim text-embedding-004| Vectors[Store in pgvector insights table]
      Vectors --> Step3[Stage 3: TS Agglomerative Clustering]
      Step3 -->|Cosine Sim >= 0.78 & Singleton Merge| Clusters[Group Separate Pain Points & Requests]
      Clusters --> Step4[Stage 4: Gemini Theme Labeling & Deterministic Scoring]
      Step4 -->|Priority Formula| Themes[(Ranked Themes)]
      Themes --> Step5[Stage 5: Gemini Strategic Recommendations]
      Step5 -->|Verbatim Quote Validation| Recs[(Recommendations with Evidence)]
    end

    DB --> LangGraph Pipeline
    Recs --> Dashboard[Interactive Intelligence Dashboard & Theme Drawer]
    Dashboard --> Export[Export CSV / JSON / Markdown Report]
```

---

## 2. Tech Stack

- **Framework**: Next.js App Router (TypeScript strict mode)
- **AI Models**: Google Gemini (`gemini-2.5-flash` / `gemini-1.5-flash`) via `@langchain/google-genai`
- **Embeddings**: Google Gemini `text-embedding-004` (768 dimensions)
- **Orchestration**: LangGraph JS (`@langchain/langgraph`) + LangChain JS
- **Authentication**: Native zero-external-package email & password authentication using Node.js built-in `crypto.pbkdf2Sync` with cryptographic salt and HTTP-only session cookies
- **Styling & UI**: Tailwind CSS v4, shadcn/ui primitives (`@radix-ui`), Lucide icons, `next-themes` (Light/Dark mode)
- **Data Visualization**: Recharts (Donut distribution, Area time-series, Stacked aspect breakdown)
- **Database & Vectors**: Neon Serverless Postgres via `@neondatabase/serverless` + Drizzle ORM (`drizzle-kit`), `pgvector` (`vector(768)`)
- **Validation**: Zod schema validation for all API inputs, LLM structured outputs, and environment variables
- **Testing**: Vitest for deterministic scoring, cosine clustering, CSV normalization, and authentication unit tests

---

## 3. Getting Started & Setup

### 3.1 Prerequisites

- Node.js >= 20
- Package Manager: `pnpm` (or `npm`)
- Google Gemini API Key (from [Google AI Studio](https://aistudio.google.com))
- Neon Postgres Database (Free tier available at [neon.tech](https://neon.tech))

### 3.2 Neon Database Setup

1. Create a project on [Neon](https://neon.tech).
2. Ensure `pgvector` is enabled (our migration automatically executes `CREATE EXTENSION IF NOT EXISTS vector;`).
3. Copy your **Pooled connection string** (`-pooler`) from the Neon dashboard.

### 3.3 Environment Variables

Copy `.env.example` to `.env.local` and populate your secrets:

```bash
cp .env.example .env.local
```

Fill in:
```env
# Google Gemini API
GEMINI_API_KEY="AIzaSy..."
GEMINI_MODEL="gemini-2.5-flash"
GEMINI_EMBEDDING_MODEL="text-embedding-004"

# Neon Postgres with pgvector
DATABASE_URL="postgresql://user:password@ep-sample-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Auth Secret for session signing
AUTH_SECRET="your-super-secret-key-change-this-in-production"
```

### 3.4 Push Schema Migrations

Run drizzle-kit to push the tables, indexes, and vector columns directly to your Neon database:

```bash
pnpm db:push
```

### 3.5 Run the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 4. Native Authentication (Zero External Packages)

The application includes simple, secure email-and-password authentication built completely using Node.js native primitives:
- **Password Hashing**: Node's built-in `crypto.pbkdf2Sync` (100,000 iterations, SHA-512) with a unique 16-byte random salt per user. Timing-safe verification using `crypto.timingSafeEqual` prevents timing attacks.
- **Sessions**: Stored in the `sessions` table in Neon and delivered via `httpOnly`, `sameSite: "lax"`, secure cookie (`fa_session`).
- **Protected Routes**: Protected project routes require active authentication.
- **Instant Demo**: On the `/login` screen, a "One-Click Demo Account" button allows instant testing without having to manually register.

---

## 5. Key Decisions & Architecture Highlights

### 5.1 Resumable, Chunked Serverless Execution Model
Traditional monolithic backend tasks block HTTP requests for 60-120 seconds, leading to 504 Gateway Timeouts on Vercel and serverless functions. Feedback Analyzer solves this via an idempotent, step-driven loop:
- `POST /api/projects/[id]/analyze`: Initializes an `analysis_runs` record in Neon with status `queued`.
- `POST /api/runs/[runId]/step`: Bounded execution node that runs one unit of work (e.g. 15 items for LLM classification, one embedding batch, or the clustering step) and commits progress to the database before returning.
- The browser loops calling `/step`, displaying real-time stepper progress (0% to 100%). If the browser is refreshed or network drops, execution seamlessly resumes from Neon state.

### 5.2 TypeScript Agglomerative Clustering
Rather than relying on external Python microservices or heavy runtime sidecars, clustering is implemented in pure, deterministic TypeScript (`src/lib/analysis/clustering.ts`):
- Computes pairwise cosine similarity between 768-dimensional Google Gemini embeddings.
- Average-linkage agglomerative clustering merges items until maximum similarity drops below the threshold (default: `0.78`).
- Singletons (clusters of size 1) are merged into the closest multi-item cluster if similarity >= `0.70`, otherwise grouped under long-tail themes.
- Pain points and feature requests are clustered **separately** to prevent mixing complaints with requests.

### 5.3 Deterministic Priority Scoring (Section 7)
Theme priority is computed mathematically in code via `src/lib/analysis/scoring.ts`:

$$\text{priorityScore} = 100 \times (0.40 \cdot \text{normFreq} + 0.30 \cdot \text{severity} + 0.15 \cdot \text{negativity} + 0.10 \cdot \text{churn} + 0.05 \cdot \text{recency})$$

Where:
- **`normFreq`**: Mentions scaled against the largest theme's frequency ($0..1$).
- **`severity`**: Mean pain point severity (1 to 5 mapped to $0.2..1.0$) or sentiment proxy for feature requests (capped at 0.6).
- **`negativity`**: $\max(0, -\text{avgSentiment})$.
- **`churn`**: Proportion of source items flagged with churn threat or cancellation signals.
- **`recency`**: Proportion of mentions appearing in the most recent 30% of the date timeline.
- Qualitative labels: `< 0.35` Low, `< 0.60` Medium, `< 0.80` High, `≥ 0.80` Critical.
- All weights and thresholds are consolidated in `src/lib/analysis/scoring.config.ts`.

### 5.4 Verbatim Evidence Verification
In `stepGenerateRecommendations`, every evidence quote generated by the LLM is programmatically verified against the raw feedback database corpus. Any fabricated quote is rejected in code, and replaced with an exact verbatim substring.

---

## 6. Unit Tests

Run the test suite with Vitest:

```bash
pnpm test
```

Tests verify:
- Password hashing, salting, constant-time verification, and invalid hash rejection (`tests/auth.test.ts`)
- Priority formula calculation, weights, and severity thresholds (`tests/scoring.test.ts`)
- Cosine similarity, centroid calculation, and agglomerative clustering with singleton merging (`tests/clustering.test.ts`)
- CSV auto column guessing, text hash deduplication, and parsing (`tests/csv.test.ts`)

---

## 7. Vercel Deployment

1. Import this repository into [Vercel](https://vercel.com).
2. In Project Settings, configure the environment variables:
   - `GEMINI_API_KEY` (or `GOOGLE_API_KEY`)
   - `GEMINI_MODEL` (`gemini-2.5-flash`)
   - `GEMINI_EMBEDDING_MODEL` (`text-embedding-004`)
   - `DATABASE_URL` (use your pooled Neon connection string)
   - `AUTH_SECRET`
3. Deploy! Next.js will build and deploy standard serverless routes.
