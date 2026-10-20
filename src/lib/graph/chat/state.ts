import { Annotation } from "@langchain/langgraph";

export interface ChatFeedbackItem {
  id: string;
  text: string;
  rating: number | null;
  sentiment: string | null;
  sentimentScore: number | null;
  aspects: Array<{ aspect: string; sentiment: "positive" | "neutral" | "negative" }> | null;
  painPoints?: string[] | null;
  featureRequests?: string[] | null;
  isChurnRisk: boolean | null;
  isRepeatCustomer: boolean | null;
  customerSegment: string | null;
  customerId: string | null;
  orderCount: number | null;
  source: string | null;
  product: string | null;
  occurredAt: Date | null;
}

export interface ChatThemeItem {
  id: string;
  name: string;
  kind: string;
  priorityScore: number;
  severityLabel: string;
  mentions: number;
  summary?: string;
}

export interface QueryUnderstanding {
  intent: "sentiment_reasons" | "feature_requests" | "comparison" | "churn_analysis" | "general_query";
  targetSegment?: "repeat" | "new" | "all" | string | null;
  customerSegment?: string | null;
  isRepeatCustomer?: boolean | null;
  sentiment?: "positive" | "neutral" | "negative" | null;
  aspects?: string[];
  semanticQuery?: string;
  product?: string | null;
  region?: string | null;
  minRating?: number | null;
  maxRating?: number | null;
}

export interface SubsetMetrics {
  totalRetrieved: number;
  sentimentCounts: { positive: number; neutral: number; negative: number };
  averageRating: number | null;
  topPainPoints: Array<{ name: string; count: number }>;
  topAspects: Array<{ name: string; count: number }>;
  segmentBreakdown: Record<string, number>;
  repeatCustomerCount: number;
  newCustomerCount: number;
}

export interface KeyIssue {
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  frequencyCount?: number;
  affectedSegment?: string;
  quoteIds?: string[];
}

export interface SupportingComment {
  quote: string;
  feedbackId?: string;
  rating?: number;
  customerSegment?: string;
  source?: string;
  isRepeatCustomer?: boolean;
  grounded: boolean;
}

export interface RecommendedAction {
  title: string;
  rationale: string;
  urgency: "immediate" | "near-term" | "backlog";
  expectedImpact: string;
}

export interface ChatStructuredPayload {
  headline: string;
  keyIssues: KeyIssue[];
  supportingComments: SupportingComment[];
  recommendedActions: RecommendedAction[];
  caveats: string[];
  followUpQuestions: string[];
  metrics: {
    totalAnalyzed: number;
    positiveCount: number;
    neutralCount: number;
    negativeCount: number;
    averageRating: number | null;
    topSegment?: string;
  };
}

export const ChatGraphAnnotation = Annotation.Root({
  projectId: Annotation<string>,
  threadId: Annotation<string>({
    reducer: (_x, y) => y,
    default: () => "",
  }),
  userMessage: Annotation<string>,
  manualFilters: Annotation<{
    customerSegment?: string | null;
    isRepeatCustomer?: boolean | null;
    sentiment?: "positive" | "neutral" | "negative" | null;
  }>({
    reducer: (_x, y) => y,
    default: () => ({}),
  }),
  history: Annotation<Array<{ role: "user" | "assistant"; content: string }>>({
    reducer: (_x, y) => y,
    default: () => [],
  }),
  understanding: Annotation<QueryUnderstanding>({
    reducer: (_x, y) => y,
    default: () => ({ intent: "general_query" }),
  }),
  segmentDataAvailable: Annotation<boolean>({
    reducer: (_x, y) => y,
    default: () => true,
  }),
  retrievedItems: Annotation<ChatFeedbackItem[]>({
    reducer: (_x, y) => y,
    default: () => [],
  }),
  retrievedThemes: Annotation<ChatThemeItem[]>({
    reducer: (_x, y) => y,
    default: () => [],
  }),
  subsetMetrics: Annotation<SubsetMetrics>({
    reducer: (_x, y) => y,
    default: () => ({
      totalRetrieved: 0,
      sentimentCounts: { positive: 0, neutral: 0, negative: 0 },
      averageRating: null,
      topPainPoints: [],
      topAspects: [],
      segmentBreakdown: {},
      repeatCustomerCount: 0,
      newCustomerCount: 0,
    }),
  }),
  rawPayload: Annotation<Partial<ChatStructuredPayload>>({
    reducer: (_x, y) => y,
    default: () => ({}),
  }),
  finalPayload: Annotation<ChatStructuredPayload>({
    reducer: (_x, y) => y,
    default: () => ({
      headline: "",
      keyIssues: [],
      supportingComments: [],
      recommendedActions: [],
      caveats: [],
      followUpQuestions: [],
      metrics: {
        totalAnalyzed: 0,
        positiveCount: 0,
        neutralCount: 0,
        negativeCount: 0,
        averageRating: null,
      },
    }),
  }),
  stage: Annotation<string>({
    reducer: (_x, y) => y,
    default: () => "queued",
  }),
  error: Annotation<string | null>({
    reducer: (_x, y) => y,
    default: () => null,
  }),
});

export type ChatGraphState = typeof ChatGraphAnnotation.State;
