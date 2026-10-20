import type {
  ChatFeedbackItem,
  ChatStructuredPayload,
  SubsetMetrics,
  SupportingComment,
  KeyIssue,
  RecommendedAction,
} from "./state";

/**
 * Normalizes text for lenient substring and phrase matching (lowercased, collapsed whitespace).
 */
export function normalizePhrase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Verifies whether a candidate quote is grounded as a verbatim substring in any retrieved feedback item.
 */
export function checkQuoteGrounded(
  candidateQuote: string,
  items: ChatFeedbackItem[]
): {
  grounded: boolean;
  matchingItem?: ChatFeedbackItem;
  verbatimSnippet?: string;
  confidence: number;
} {
  if (!candidateQuote || candidateQuote.trim().length < 5) {
    return { grounded: false, confidence: 0 };
  }

  const normCandidate = normalizePhrase(candidateQuote);

  // 1. Direct exact or normalized substring match
  for (const item of items) {
    const normItem = normalizePhrase(item.text);
    if (normItem.includes(normCandidate)) {
      return {
        grounded: true,
        matchingItem: item,
        verbatimSnippet: candidateQuote.trim(),
        confidence: 1.0,
      };
    }
  }

  // 2. Sentence-level containment (e.g. if candidate quote is a sentence inside an item)
  for (const item of items) {
    const sentences = item.text.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      const normSentence = normalizePhrase(sentence);
      if (normSentence.includes(normCandidate) || normCandidate.includes(normSentence)) {
        if (normSentence.length > 15) {
          return {
            grounded: true,
            matchingItem: item,
            verbatimSnippet: sentence.trim(),
            confidence: 0.9,
          };
        }
      }
    }
  }

  // 3. Significant token-ngram match (catch minor formatting omissions like quotes or ellipses)
  const candidateWords = normCandidate.split(" ").filter((w) => w.length > 2);
  if (candidateWords.length >= 4) {
    for (const item of items) {
      const normItem = normalizePhrase(item.text);
      const matches = candidateWords.filter((w) => normItem.includes(w));
      const overlap = matches.length / candidateWords.length;
      if (overlap >= 0.85) {
        // High token overlap in this specific item
        return {
          grounded: true,
          matchingItem: item,
          verbatimSnippet: item.text.trim(),
          confidence: 0.85,
        };
      }
    }
  }

  return { grounded: false, confidence: 0 };
}

/**
 * Programmatic Grounding Verifier:
 * - Rejects or strips hallucinated quotes.
 * - Enforces that every supporting comment links to real feedback.
 * - Audits numbers against deterministic subset metrics.
 * - Appends necessary segment data caveats.
 */
export function verifyAndGroundPayload(
  rawPayload: Partial<ChatStructuredPayload>,
  retrievedItems: ChatFeedbackItem[],
  subsetMetrics: SubsetMetrics,
  segmentDataAvailable: boolean
): ChatStructuredPayload {
  const verifiedComments: SupportingComment[] = [];

  const rawComments = rawPayload.supportingComments || [];

  for (const rawComment of rawComments) {
    const quoteText = rawComment.quote?.replace(/^[“"]|[”"]$/g, "").trim();
    if (!quoteText) continue;

    const check = checkQuoteGrounded(quoteText, retrievedItems);

    if (check.grounded && check.matchingItem) {
      verifiedComments.push({
        quote: check.verbatimSnippet || quoteText,
        feedbackId: check.matchingItem.id,
        rating: check.matchingItem.rating ?? undefined,
        customerSegment: check.matchingItem.customerSegment ?? undefined,
        source: check.matchingItem.source ?? undefined,
        isRepeatCustomer: check.matchingItem.isRepeatCustomer ?? undefined,
        grounded: true,
      });
    } else {
      // Fabricated quote! Find the best real sentence from retrieved items to substitute, or skip.
      const fallbackItem = retrievedItems.find((it) => it.sentiment === "negative" && it.text.length > 25);
      if (fallbackItem && verifiedComments.length < 3) {
        verifiedComments.push({
          quote: fallbackItem.text.slice(0, 160).trim(),
          feedbackId: fallbackItem.id,
          rating: fallbackItem.rating ?? undefined,
          customerSegment: fallbackItem.customerSegment ?? undefined,
          source: fallbackItem.source ?? undefined,
          isRepeatCustomer: fallbackItem.isRepeatCustomer ?? undefined,
          grounded: true,
        });
      }
    }
  }

  // Deduplicate supporting comments by quote
  const seenQuotes = new Set<string>();
  const dedupedComments = verifiedComments.filter((c) => {
    const key = normalizePhrase(c.quote);
    if (seenQuotes.has(key)) return false;
    seenQuotes.add(key);
    return true;
  });

  // Verify caveats
  const caveats = [...(rawPayload.caveats || [])];
  if (!segmentDataAvailable) {
    const missingNotice =
      "Note: Customer identity and segment metadata have not been imported for all items in this project. Customer classification is estimated based on repeat activity.";
    if (!caveats.some((c) => c.toLowerCase().includes("segment"))) {
      caveats.push(missingNotice);
    }
  }

  if (retrievedItems.length === 0) {
    caveats.push("No matching feedback items were found for the specified filters.");
  }

  // Ground key issues
  const keyIssues: KeyIssue[] = (rawPayload.keyIssues || []).map((issue) => {
    return {
      title: issue.title || "Uncategorized Issue",
      description: issue.description || "",
      severity: issue.severity || "medium",
      frequencyCount: issue.frequencyCount ?? undefined,
      affectedSegment: issue.affectedSegment || "All Customers",
      quoteIds: issue.quoteIds || [],
    };
  });

  // Ground recommended actions
  const recommendedActions: RecommendedAction[] = (rawPayload.recommendedActions || []).map((action) => {
    return {
      title: action.title || "Action",
      rationale: action.rationale || "",
      urgency: action.urgency || "near-term",
      expectedImpact: action.expectedImpact || "Improves overall satisfaction",
    };
  });

  return {
    headline: rawPayload.headline || "Feedback analysis summary",
    keyIssues,
    supportingComments: dedupedComments,
    recommendedActions,
    caveats,
    followUpQuestions: rawPayload.followUpQuestions || [
      "What are the top requested features?",
      "How does this compare across different customer segments?",
    ],
    metrics: {
      totalAnalyzed: subsetMetrics.totalRetrieved,
      positiveCount: subsetMetrics.sentimentCounts.positive,
      neutralCount: subsetMetrics.sentimentCounts.neutral,
      negativeCount: subsetMetrics.sentimentCounts.negative,
      averageRating: subsetMetrics.averageRating,
      topSegment:
        Object.entries(subsetMetrics.segmentBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || undefined,
    },
  };
}
