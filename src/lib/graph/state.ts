import { Annotation } from "@langchain/langgraph";
import type { FeedbackItem, Theme, Recommendation } from "@/lib/db/schema";
import type { ExtractedItem } from "@/lib/llm/schemas";
import type { ClusterResult } from "@/lib/analysis/clustering";

export interface EmbeddedInsight {
  id: string;
  feedbackItemId: string;
  kind: "pain_point" | "feature_request";
  text: string;
  severity: number | null;
  embedding: number[];
  themeId?: string | null;
}

export const AnalysisGraphAnnotation = Annotation.Root({
  projectId: Annotation<string>,
  runId: Annotation<string>,
  rawItems: Annotation<FeedbackItem[]>({
    reducer: (_x, y) => y,
    default: () => [],
  }),
  extractedItems: Annotation<ExtractedItem[]>({
    reducer: (x, y) => (y ? [...x, ...y] : x),
    default: () => [],
  }),
  embeddedInsights: Annotation<EmbeddedInsight[]>({
    reducer: (x, y) => (y ? [...x, ...y] : x),
    default: () => [],
  }),
  clusters: Annotation<Array<ClusterResult<any>>>({
    reducer: (_x, y) => y,
    default: () => [],
  }),
  themes: Annotation<Theme[]>({
    reducer: (_x, y) => y,
    default: () => [],
  }),
  recommendations: Annotation<Recommendation[]>({
    reducer: (_x, y) => y,
    default: () => [],
  }),
  stage: Annotation<string>({
    reducer: (_x, y) => y,
    default: () => "queued",
  }),
  progress: Annotation<number>({
    reducer: (_x, y) => y,
    default: () => 0,
  }),
  error: Annotation<string | null>({
    reducer: (_x, y) => y,
    default: () => null,
  }),
  tokenUsage: Annotation<{ promptTokens: number; completionTokens: number; totalTokens: number }>({
    reducer: (x, y) => ({
      promptTokens: (x?.promptTokens || 0) + (y?.promptTokens || 0),
      completionTokens: (x?.completionTokens || 0) + (y?.completionTokens || 0),
      totalTokens: (x?.totalTokens || 0) + (y?.totalTokens || 0),
    }),
    default: () => ({ promptTokens: 0, completionTokens: 0, totalTokens: 0 }),
  }),
});

export type AnalysisGraphState = typeof AnalysisGraphAnnotation.State;
