# PulseIQ System Architecture & UI Sizing Audit (Phase 0)

**Date**: October 20, 2026  
**Auditor**: PulseIQ Full-Stack Engineering Team  
**Scope**: Codebase Architecture, Data Model Audit, UI Responsive Sizing (360px – 1536px), and Conversational Insights Integration Risks.

---

## 1. Architecture Map

### 1.1 Directory Structure
```
src/
├── app/
│   ├── api/
│   │   ├── auth/            # Native authentication (login, register, logout, me, isolated demo)
│   │   ├── init/            # Neon Postgres schema bootstrap verification
│   │   ├── projects/        # Project CRUD, overview stats, feedback, export, themes, recs
│   │   ├── runs/            # Resumable pipeline step execution (/api/runs/[runId]/step)
│   │   └── sample-data/     # Bundled review ingestion
│   ├── login/               # Authentication UI (email/password + one-click isolated demo)
│   ├── register/            # Account registration
│   ├── projects/            # Project workspace (App Router)
│   │   └── [id]/
│   │       ├── feedback/    # Paginated searchable feedback explorer
│   │       ├── themes/      # Priority-matrix ranked theme clusters
│   │       ├── recommendations/ # Strategic initiative cards with evidence
│   │       ├── settings/    # Project configuration and token/cost analytics
│   │       ├── layout.tsx   # Project workspace shell (sidebar + content area)
│   │       └── page.tsx     # Primary executive dashboard
│   ├── layout.tsx           # Global root layout (ThemeProvider, Toaster, Geist fonts)
│   ├── page.tsx             # Project selection / creation home screen
│   └── globals.css          # Tailwind CSS v4 styling & theme variables
├── components/
│   ├── analysis/            # AnalysisRunnerDialog (stepper & polling pipeline runner)
│   ├── charts/              # Recharts components (SentimentOverview, AspectSentimentChart)
│   ├── dashboard/           # SummaryHeader, PriorityMatrix, PainVsFeatures
│   ├── feedback/            # FeedbackTable, ImportModal (CSV, paste, sample)
│   ├── layout/              # Sidebar, Header, UserMenu
│   ├── projects/            # NewProjectDialog
│   ├── recommendations/     # RecommendationCards (Markdown export, quote chips)
│   ├── themes/              # ThemesTable, ThemeDrawer
│   └── ui/                  # Radix UI primitives (Dialog, Popover, Select, Badge, Table, etc.)
├── data/                    # sample-reviews.csv (157 SaaS customer reviews)
├── lib/
│   ├── analysis/            # Deterministic scoring formula & TypeScript agglomerative clustering
│   ├── auth/                # PBKDF2 native password crypto, session management & cookies
│   ├── db/                  # Neon serverless client, Drizzle schema, bootstrap DDL, queries
│   ├── graph/               # LangGraph pipeline definition, step runner, prompts, schemas
│   ├── ingest/              # CSV parsing, column mapping detector, SHA-256 deduplication
│   ├── llm/                 # Model factory & Zod output schemas
│   └── env.ts               # Strict Zod environment variable validation
└── middleware.ts            # Route protection for projects & API endpoints
```

### 1.2 Analysis Pipeline (LangGraph JS)
The feedback analysis pipeline is orchestrated via `@langchain/langgraph` (`src/lib/graph/graph.ts`) and executed as a **chunked resumable step runner** (`src/lib/graph/pipeline-steps.ts` via `POST /api/runs/[runId]/step`) to avoid Vercel serverless function timeouts:

1. **`normalizeInput`**: Filters empty text, cleans whitespace, validates UTF-8.
2. **`extractInsights`**: Batched LLM structured extraction (15 items per batch) via `ChatGoogleGenerativeAI` / `withStructuredOutput` producing sentiment, score (-1 to +1), primary emotion, aspects, atomic pain points, feature requests, churn risk flags, and summary.
3. **`embedItems`**: Batched vector embeddings via `GoogleGenerativeAIEmbeddings` (`text-embedding-004`, 768 dimensions) stored in Neon Postgres `vector(768)` in the `insights` table.
4. **`clusterThemes`**: TypeScript-native agglomerative clustering using cosine similarity ($\ge 0.78$) grouping pain points and feature requests separately.
5. **`labelThemes`**: LLM synthesizes concrete titles ($\le 6$ words) and summaries per cluster.
6. **`scorePriority`**: Deterministic mathematical formula computing `priorityScore` (0–100) using frequency (40%), severity (30%), negativity (15%), churn risk (10%), and recency velocity (5%).
7. **`generateRecommendations`**: Formulates 5–8 strategic roadmap initiatives grounded in top themes with verbatim evidence quotes.

### 1.3 Database Schema (Neon Postgres + pgvector)
- **`users`**: `id` (UUID PK), `email` (unique), `password_hash`, `name`, `created_at`.
- **`sessions`**: `id` (UUID PK), `user_id` (FK users), `token` (unique), `expires_at`, `created_at`.
- **`projects`**: `id` (UUID PK), `user_id` (FK users, cascade), `name`, `description`, `created_at`.
- **`feedback_items`**: `id` (UUID PK), `project_id` (FK projects), `text`, `text_hash` (deduping unique index with project_id), `rating` (1–5), `source`, `product_version`, `occurred_at`, `created_at`, `analysis_status` (`pending` | `done` | `failed`), `sentiment` (`positive` | `neutral` | `negative`), `sentiment_score` (-1.0 to 1.0), `confidence`, `emotion`, `is_churn_risk`, `summary`, `aspects` (JSONB).
- **`insights`**: `id` (UUID PK), `project_id` (FK projects), `feedback_item_id` (FK feedback_items), `kind` (`pain_point` | `feature_request`), `text`, `severity` (1–5), `embedding` (`vector(768)`), `theme_id` (FK themes, nullable).
- **`themes`**: `id` (UUID PK), `run_id` (FK analysis_runs), `project_id` (FK projects), `kind` (`pain_point` | `feature_request`), `name`, `summary`, `mentions`, `avg_sentiment`, `severity_score`, `severity_label` (`Low` | `Medium` | `High` | `Critical`), `priority_score` (0–100), `churn_share`, `recency_share`.
- **`recommendations`**: `id` (UUID PK), `run_id` (FK analysis_runs), `project_id` (FK projects), `title`, `rationale`, `impact` (`low` | `medium` | `high`), `effort` (`S` | `M` | `L`), `theme_ids` (JSONB array), `evidence_quotes` (JSONB array), `rank`.
- **`analysis_runs`**: `id` (UUID PK), `project_id` (FK projects), `status` (`queued` | `running` | `completed` | `failed`), `stage`, `progress` (0–100), `total_items`, `started_at`, `finished_at`, `summary_stats` (JSONB).

### 1.4 API Conventions & Environment Validation
- Standardized response helpers in `src/lib/api-response.ts`: `successResponse(data, status)` and `errorResponse(message, status)` returning `{ success: boolean, data?: T, error?: { message: string } }`.
- Environment validation in `src/lib/env.ts` with Zod parsing `process.env`.
- LLM and embeddings currently instantiated via `@langchain/google-genai` in `src/lib/llm/models.ts`.

---

## 2. Data Audit: Customer Identity & Segments

### 2.1 Existing Feedback Item Fields
| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `project_id` | UUID | Owning project |
| `text` | Text | Raw verbatim customer review |
| `text_hash` | Text | SHA-256 hash for deduplication |
| `rating` | Integer | Star rating (1 to 5) |
| `source` | Text | G2, Capterra, App Store, Zendesk, NPS |
| `product_version` | Text | e.g. "v2.5.2" |
| `occurred_at` | Timestamp | Timestamp of feedback |
| `sentiment` | Text | positive / neutral / negative |
| `sentiment_score` | Real | -1.0 to +1.0 |
| `confidence` | Real | Extraction confidence |
| `emotion` | Text | frustrated, delighted, satisfied, etc. |
| `is_churn_risk` | Boolean | True if threat to cancel / churn |
| `summary` | Text | 1-sentence summary |
| `aspects` | JSONB | Array of `{ aspect, sentiment }` |

### 2.2 Customer Identity / Segment Gap Analysis
**Finding**: There is currently **NO customer identity or customer segment field** anywhere in the database schema or ingestion pipeline. Specifically:
- No `customer_id` or user identifier.
- No `order_count` or transaction history.
- No `is_repeat_customer` flag.
- No `customer_segment` (e.g. "new", "repeat", "VIP", "enterprise", "freemium").
- No `region` or geographic categorization.
- No multi-product discriminator (`product`).

**Impact on Phase 2 & Chatbot**: Queries like *"What are the biggest reasons for negative sentiment among repeat customers?"* cannot be answered accurately without guessing or hallucinating customer identity. We must add these fields to `feedback_items`, update column mapping during ingestion, auto-derive `is_repeat_customer` (`order_count > 1` or duplicate `customer_id`), and enrich `sample-reviews.csv`.

---

## 3. UI Sizing & Responsive Layout Audit

We tested the application at the 5 target breakpoints in light and dark mode:
- **360px** (Mobile portrait: iPhone SE / Android compact)
- **768px** (Tablet portrait: iPad Mini / 7"–8" tablets)
- **1024px** (Tablet landscape / Small laptop)
- **1280px** (Standard Desktop)
- **1536px** (Wide desktop / 2K monitor)

### 3.1 Defect Log

| # | Breakpoint | Component / File | Issue Description | Proposed Fix |
|---|---|---|---|---|
| **D1** | 360px, 768px | `src/app/projects/[id]/layout.tsx`, `src/components/layout/sidebar.tsx` | **Desktop sidebar is not hidden on mobile**: `<Sidebar>` has a fixed `w-64` (256px) and sits next to `<div className="flex-1">` in a horizontal flex layout without a responsive breakpoint. On 360px, the sidebar occupies 71% of the screen, squishing the page content into 104px. | Wrap Sidebar with `hidden md:flex`. Provide a responsive mobile header with a slide-over sheet / drawer to open navigation on mobile screens. |
| **D2** | All (especially mobile) | `src/components/layout/sidebar.tsx` | **`h-screen` viewport bug**: Sidebar uses `h-screen` instead of dynamic viewport units. On iOS Safari and Chrome Android, the bottom user menu is concealed behind the browser bottom bar. | Change `h-screen` to `h-[100dvh]`. |
| **D3** | 360px, 768px | `src/components/layout/header.tsx` | **Excessive header padding & horizontal overflow**: `px-8` consumes 64px of horizontal space on 360px screen. When the project name is long or action buttons are present, content clips without wrapping or truncating. | Change to `px-4 sm:px-6 lg:px-8`, add `min-w-0 truncate` to title containers. |
| **D4** | 360px, 768px | `src/app/projects/[id]/page.tsx`, `src/app/projects/[id]/feedback/page.tsx`, `src/app/projects/[id]/themes/page.tsx` | **Inconsistent & excessive main padding**: Pages hardcode `p-8` (64px total margin), leaving less than 296px for charts and tables on mobile. | Standardize shared page padding scale: `p-4 sm:p-6 lg:p-8`. |
| **D5** | 360px | `src/components/dashboard/summary-header.tsx` | **Header action buttons overflow**: "How Scores Work", "Export", and "Analyze Feedback" are inside `flex items-center gap-2.5` without wrap, breaking outside the viewport on 360px. Metric cards in `grid-cols-2` text wraps uncomfortably. | Add `flex-wrap gap-2` to actions container; reduce metric card padding on mobile (`p-3 sm:p-4`), tune font scale (`text-xl sm:text-2xl`), add `min-w-0` to cards. |
| **D6** | 360px, 768px | `src/components/themes/themes-table.tsx` | **Themes table horizontal overflow**: The 8-column table with text summaries and badges causes awkward table squishing or unstyled overflow on mobile. | Ensure table container has explicit `overflow-x-auto min-w-0` with styled scrollbars, and optimize column widths for mobile readability. |
| **D7** | 360px, 768px | `src/components/feedback/feedback-table.tsx` | **Filter controls stack poorly**: Search input and 3 select dropdowns (`sentiment`, `rating`, `source`) overflow on narrow screens. | Replace cramped flex layout with responsive grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5`. |
| **D8** | 360px, 768px | `src/components/charts/aspect-sentiment-chart.tsx` | **XAxis label collision**: Aspect names (e.g., "Integrations", "Reliability", "Onboarding") collide or overlap when screen width drops below 768px. | Rotate X-axis labels at `-25` degrees with `interval={0}`, `textAnchor="end"`, and `height={60}` when under `md`. |
| **D9** | 360px | `src/components/charts/sentiment-overview.tsx` | **Donut legend wrapping**: Pie chart legend items (`Positive`, `Neutral`, `Negative`) wrap rigidly on 360px. | Use `flex-wrap justify-center gap-2 sm:gap-4` on legend container. |
| **D10** | 360px, 768px | `src/components/ui/dialog.tsx`, `src/components/themes/theme-drawer.tsx`, `src/components/feedback/import-modal.tsx` | **Dialog viewport clipping**: `DialogContent` hardcodes `max-h-[90vh]` which cuts off bottom buttons on mobile devices with visible address bars. | Use `max-h-[90dvh]` and responsive margin padding (`w-[calc(100%-2rem)] max-w-lg sm:max-w-2xl`). |
| **D11** | 1536px | `src/app/page.tsx`, `src/app/projects/[id]/page.tsx` | **Ultra-wide content stretching**: On 1536px+ displays, tables and cards stretch across the entire screen without an upper bound, making wide rows hard to scan. | Ensure consistent `max-w-7xl mx-auto` or `2xl:max-w-[1600px] w-full` wrapper. |

---

## 4. Integration Risks for Conversational Chatbot

1. **LLM Provider Hardcoding**:
   - `src/lib/llm/models.ts` currently directly imports `@langchain/google-genai`. To fulfill Phase 3.2, we must introduce a clean model factory supporting `LLM_PROVIDER=openai|google` without disturbing existing 768-dim embeddings in Neon Postgres.
2. **Missing Database Indexes**:
   - Conversational retrieval requires filtering by segment, sentiment, and date concurrently with vector similarity. Neon queries without composite indexes on `(project_id, is_repeat_customer)`, `(project_id, customer_segment)`, and `(project_id, sentiment)` will suffer high latency under serverless concurrency.
3. **Serverless Execution Limits & Streaming**:
   - Next.js API routes on Vercel default to 15s (or 60s maxDuration). A multi-stage chat pipeline (`understandQuery` -> hybrid vector search -> stats analysis -> synthesis -> quote verification) must execute within 5–10 seconds. We must stream progress events via Server-Sent Events (SSE) so the user gets immediate feedback (`understanding`, `retrieving`, `analysing`, `writing`).
4. **Hallucination & Quote Fabrication**:
   - Standard LLM summaries frequently invent supportive feedback quotes or cite incorrect percentages. The pipeline must incorporate a mandatory deterministic verification node (`verifyGrounding`) that checks quote substrings against retrieved database items and replaces synthetic numbers with computed aggregations.

---

## 5. Phase 0 & Phase 1 Execution Summary

All 11 defects (D1 through D11) have been addressed and resolved in Phase 1 across shared layouts, charts, tables, dialogs, and navigation.

### 6. Before / After Verification Matrix (Tested at 360, 768, 1024, 1280, 1536 px)

| Breakpoint | Mode | Component Area | Before (Defect) | After (Verified Solution) | Status |
|---|---|---|---|---|---|
| **360px** | Light / Dark | Sidebar & Navigation | Fixed 256px sidebar occupied 71% of screen; main dashboard squished to 104px. | Sidebar hidden on mobile (`hidden md:flex`). Added mobile hamburger button in `Header` triggering accessible slide-out `ProjectShell` drawer with `100dvh`. | ✅ Verified |
| **360px** | Light / Dark | Header & Title | `px-8` consumed 64px; actions clipped horizontally; text clipped without truncation. | `px-4 sm:px-6 lg:px-8`, responsive title with `min-w-0 truncate`, buttons wrap cleanly. | ✅ Verified |
| **360px** | Light / Dark | Summary Metrics | Metric cards in `grid-cols-2` text wrapped into 4 lines with cramped values. | Card padding reduced to `p-3 sm:p-4`, font scaled to `text-xl sm:text-2xl`, responsive action button wrap. | ✅ Verified |
| **360px** | Light / Dark | Themes & Feedback Tables | 8-column table caused horizontal page blowouts and column collisions. | Tables wrapped in `overflow-x-auto min-w-0` with `min-w-[720px]` inner container for smooth swipe scrolling. | ✅ Verified |
| **360px** | Light / Dark | Aspect Sentiment Chart | Aspect text labels overlapped each other completely. | Adjusted label rotation to `-25` degrees with `interval={0}`, `textAnchor="end"`, and `height={55}` inside explicit `h-72` container. | ✅ Verified |
| **360px** | Light / Dark | Modals & Drawers | `max-h-[90vh]` cut off action buttons under iOS/Android browser bars. | Switched to `w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-xl` with safe padding. | ✅ Verified |
| **768px** | Light / Dark | Tablet Dashboard | Cramped `p-8` side margins; side-by-side pain vs feature cards wrapped tightly. | Standardized responsive padding scale (`p-4 sm:p-6 lg:p-8`), added `min-w-0 truncate` to theme titles and summaries. | ✅ Verified |
| **1024px** | Light / Dark | Charts & Matrices | Donut chart and area chart ratio transitioned abruptly without explicit height. | Donut chart in `h-48` and area chart in `h-56` with flexible legend wrapping. | ✅ Verified |
| **1280px** | Light / Dark | Standard Desktop | Table and card padding varied across pages. | Unified padding and card spacing using `max-w-7xl mx-auto w-full`. | ✅ Verified |
| **1536px** | Light / Dark | Ultra-Wide Monitor | Content stretched uncomfortably across 1536px+ width. | Bounded within `max-w-7xl mx-auto w-full` with balanced typography. | ✅ Verified |

