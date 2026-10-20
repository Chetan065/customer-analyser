import type {
  ChatFeedbackItem,
  ChatThemeItem,
  QueryUnderstanding,
  SubsetMetrics,
} from "./state";

export function buildQueryUnderstandingPrompt(
  message: string,
  history: Array<{ role: string; content: string }>
): string {
  const historyText = history.slice(-4).map((h) => `${h.role.toUpperCase()}: ${h.content}`).join("\n");

  return `You are a product intelligence query parser. Your job is to extract structured filters and search intent from user questions about customer feedback.

USER QUERY:
"${message}"

${historyText ? `RECENT CONVERSATION HISTORY:\n${historyText}\n` : ""}

Extract:
1. intent: "sentiment_reasons" | "feature_requests" | "comparison" | "churn_analysis" | "general_query"
2. targetSegment: "repeat" if asking about repeat / existing / loyal / long-term / enterprise customers, "new" if asking about new / trial / starter customers, or "all" / specific segment string.
3. isRepeatCustomer: true if repeat customers are requested, false if new customers are requested, or null if neutral/all.
4. sentiment: "negative" | "positive" | "neutral" | null (e.g. if asking for negative reasons / complaints / issues, set "negative")
5. aspects: relevant product aspects mentioned (e.g. ["pricing", "onboarding", "export", "performance", "mobile", "sync", "slack"])
6. semanticQuery: concise keywords for semantic vector similarity search
7. minRating / maxRating: if specific rating bounds are requested (e.g. 1-2 stars -> maxRating: 2)

Return ONLY valid JSON matching this schema:
{
  "intent": "sentiment_reasons",
  "targetSegment": "repeat" | "new" | "all" | string | null,
  "isRepeatCustomer": boolean | null,
  "sentiment": "negative" | "positive" | "neutral" | null,
  "aspects": string[],
  "semanticQuery": string,
  "minRating": number | null,
  "maxRating": number | null
}`;
}

export function buildSynthesisPrompt(
  userMessage: string,
  understanding: QueryUnderstanding,
  items: ChatFeedbackItem[],
  themes: ChatThemeItem[],
  metrics: SubsetMetrics,
  segmentDataAvailable: boolean
): string {
  // Serialize top items with their text and metadata
  const itemsContext = items.slice(0, 45).map((it, idx) => {
    return `[Item #${idx + 1} | ID: ${it.id} | Rating: ${it.rating ?? "N/A"}★ | Segment: ${it.customerSegment || (it.isRepeatCustomer ? "repeat" : "new")} | Repeat: ${it.isRepeatCustomer ? "Yes" : "No"} | Source: ${it.source || "Web"}]
"${it.text}"
(Pain Points: ${it.painPoints?.join(", ") || "None"} | Aspects: ${it.aspects?.map((a: any) => typeof a === "string" ? a : a.aspect).join(", ") || "General"})`;
  }).join("\n\n");

  const themesContext = themes.slice(0, 8).map((t) => {
    return `- ${t.name} (${t.kind}, Priority Score: ${t.priorityScore.toFixed(1)}, Mentions: ${t.mentions}, Severity: ${t.severityLabel})`;
  }).join("\n");

  return `You are PulseIQ's Lead Product Intelligence Assistant.
You provide executive-level, strictly evidence-based product insights from customer feedback.

USER QUESTION:
"${userMessage}"

QUERY INTENT & FILTERS:
- Target Segment: ${understanding.targetSegment || "All"} (Repeat: ${understanding.isRepeatCustomer ?? "All"})
- Sentiment Filter: ${understanding.sentiment || "All"}
- Aspects: ${understanding.aspects?.join(", ") || "General"}

DATA SUBSET METRICS (DETERMINISTIC):
- Total Items Retrieved: ${metrics.totalRetrieved}
- Sentiment Breakdown: Positive: ${metrics.sentimentCounts.positive}, Neutral: ${metrics.sentimentCounts.neutral}, Negative: ${metrics.sentimentCounts.negative}
- Average Rating: ${metrics.averageRating ? metrics.averageRating.toFixed(2) + " / 5.0" : "N/A"}
- Repeat Customers in Subset: ${metrics.repeatCustomerCount}
- New Customers in Subset: ${metrics.newCustomerCount}
${!segmentDataAvailable ? "⚠️ NOTE: Customer segment metadata is sparse in this project.\n" : ""}

EXISTING DETECTED THEMES:
${themesContext || "No themes detected yet."}

RETRIEVED CUSTOMER FEEDBACK EVIDENCE:
${itemsContext || "No feedback items matched the filter."}

CRITICAL RULES:
1. STRICT GROUNDING: Every quote in "supportingComments" MUST BE A VERBATIM, EXACT SUBSTRING of one of the feedback items provided above. Do NOT rewrite, paraphrase, or hallucinate quotes. If quoting, copy the exact words.
2. ACCURATE NUMBERS: Use the exact metrics provided above. Never invent counts or statistics.
3. EXECUTIVE QUALITY: Provide actionable, prioritized takeaways with clear rationale.
4. SPECIFICITY: Mention concrete features and failure modes (e.g. renewal price jumps, 10-seat minimums, CSV crashes with > 100 tasks, onboarding wizard steps).

Respond with a JSON object matching this structure:
{
  "headline": "A crisp, 1-2 sentence executive takeaway answering the question directly.",
  "keyIssues": [
    {
      "title": "Clear issue title",
      "description": "Specific explanation with details on why it happens and how customers react.",
      "severity": "critical" | "high" | "medium" | "low",
      "frequencyCount": 12,
      "affectedSegment": "Repeat Enterprise Customers"
    }
  ],
  "supportingComments": [
    {
      "quote": "EXACT verbatim quote copied word-for-word from one of the retrieved items above.",
      "customerSegment": "repeat" | "enterprise" | "new" | "trial"
    }
  ],
  "recommendedActions": [
    {
      "title": "Action to fix or build",
      "rationale": "Why this will reduce churn or improve NPS based on the feedback evidence.",
      "urgency": "immediate" | "near-term" | "backlog",
      "expectedImpact": "High - Prevents enterprise account churn"
    }
  ],
  "caveats": [
    "Any sample size or metadata limitations to keep in mind."
  ],
  "followUpQuestions": [
    "3 insightful follow-up questions the PM might want to explore next."
  ]
}`;
}
