import { z } from "zod";

export const PRODUCT_ASPECTS = [
  "pricing",
  "performance",
  "ui_ux",
  "support",
  "onboarding",
  "reliability",
  "integrations",
  "documentation",
  "security",
  "other",
] as const;

export const itemExtractionSchema = z.object({
  id: z.string().describe("The exact id of the feedback item being analyzed"),
  sentiment: z.enum(["positive", "neutral", "negative"]).describe("Overall sentiment classification"),
  sentimentScore: z
    .number()
    .min(-1)
    .max(1)
    .describe("Sentiment score from -1.0 (extremely negative) to +1.0 (extremely positive)"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score in this analysis between 0.0 and 1.0"),
  emotion: z
    .enum(["frustrated", "angry", "disappointed", "satisfied", "delighted", "confused", "neutral"])
    .describe("Primary emotional tone expressed by customer"),
  aspects: z
    .array(
      z.object({
        aspect: z.enum(PRODUCT_ASPECTS),
        sentiment: z.enum(["positive", "neutral", "negative"]),
      })
    )
    .describe("Product aspects discussed in the text with aspect-level sentiment"),
  painPoints: z
    .array(
      z.object({
        text: z.string().describe("Short, normalized description of a single problem or defect"),
        severity: z
          .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
          .describe(
            "1=cosmetic, 2=minor annoyance, 3=workflow friction, 4=blocks task/data issue, 5=crash/data loss/security/billing error or churn threat"
          ),
      })
    )
    .describe("Specific pain points, bugs, or friction points extracted from the text"),
  featureRequests: z
    .array(
      z.object({
        text: z.string().describe("Concise statement of a feature or capability requested by the customer"),
      })
    )
    .describe("Feature requests or enhancements suggested in the feedback"),
  isChurnRisk: z
    .boolean()
    .describe("True if customer explicitly mentions cancelling, switching to competitor, or extreme billing dissatisfaction"),
  summary: z.string().describe("Crisp summary of the feedback item in 20 words or fewer"),
});

export const batchExtractionSchema = z.object({
  results: z.array(itemExtractionSchema).describe("Analysis results for each feedback item in the batch"),
});

export const themeLabelSchema = z.object({
  name: z
    .string()
    .describe(
      "Concrete, specific name for this theme in 6 words or fewer (e.g. 'Slow checkout on mobile', not 'Performance issues')"
    ),
  summary: z.string().describe("One sentence clearly summarizing the core issue or request across all items"),
  category: z.string().describe("Product domain e.g. Reliability, Billing, Integrations, UI/UX, Performance, Mobile"),
});

export const batchThemeLabelSchema = z.object({
  themes: z.array(
    z.object({
      clusterIndex: z.number(),
      name: z.string(),
      summary: z.string(),
      category: z.string(),
    })
  ),
});

export const recommendationItemSchema = z.object({
  title: z.string().describe("Actionable product initiative or fix title"),
  rationale: z.string().describe("Why this should be prioritized based on feedback frequency and severity"),
  impact: z.enum(["low", "medium", "high"]).describe("Expected impact on customer satisfaction and churn reduction"),
  effort: z.enum(["S", "M", "L"]).describe("Estimated development or operational effort"),
  themeIds: z.array(z.string()).describe("IDs of related themes addressed by this recommendation"),
  evidenceQuotes: z
    .array(z.string())
    .describe("2 to 3 verbatim quotes from actual customer feedback demonstrating the problem"),
});

export const recommendationsResponseSchema = z.object({
  recommendations: z.array(recommendationItemSchema).min(3).max(8),
});

export type ExtractedItem = z.infer<typeof itemExtractionSchema>;
export type ThemeLabel = z.infer<typeof themeLabelSchema>;
export type RecommendationOutput = z.infer<typeof recommendationItemSchema>;
