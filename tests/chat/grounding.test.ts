import { describe, it, expect } from "vitest";
import { checkQuoteGrounded, verifyAndGroundPayload } from "@/lib/graph/chat/grounding";
import type { ChatFeedbackItem, SubsetMetrics } from "@/lib/graph/chat/state";

describe("Grounding Verification & Quote Audit", () => {
  const sampleItems: ChatFeedbackItem[] = [
    {
      id: "item-01",
      text: "Every time I try to export our monthly board report to CSV, the web app crashes with a blank white screen. Lost 2 hours of work yesterday!",
      rating: 1,
      sentiment: "negative",
      sentimentScore: -0.9,
      aspects: [{ aspect: "export", sentiment: "negative" }],
      isChurnRisk: true,
      isRepeatCustomer: true,
      customerSegment: "enterprise",
      customerId: "cust_ent_101",
      orderCount: 12,
      source: "Zendesk",
      product: "PulseIQ Enterprise",
      occurredAt: new Date("2026-09-12"),
    },
    {
      id: "item-02",
      text: "We loved the product until renewal time when our pricing increased by 65% with zero advance notice. We are actively migrating our team to ClickUp.",
      rating: 1,
      sentiment: "negative",
      sentimentScore: -0.95,
      aspects: [{ aspect: "pricing", sentiment: "negative" }],
      isChurnRisk: true,
      isRepeatCustomer: true,
      customerSegment: "enterprise",
      customerId: "cust_ent_102",
      orderCount: 8,
      source: "G2",
      product: "PulseIQ Enterprise",
      occurredAt: new Date("2026-09-14"),
    },
    {
      id: "item-03",
      text: "Invite links expire after only 10 minutes! Half our invited engineers received expired token errors before they could set up their passwords.",
      rating: 1,
      sentiment: "negative",
      sentimentScore: -0.85,
      aspects: [{ aspect: "onboarding", sentiment: "negative" }],
      isChurnRisk: false,
      isRepeatCustomer: false,
      customerSegment: "new",
      customerId: "cust_new_503",
      orderCount: 1,
      source: "Zendesk",
      product: "PulseIQ Web",
      occurredAt: new Date("2026-10-11"),
    },
  ];

  const mockMetrics: SubsetMetrics = {
    totalRetrieved: 3,
    sentimentCounts: { positive: 0, neutral: 0, negative: 3 },
    averageRating: 1.0,
    topPainPoints: [{ name: "export", count: 1 }, { name: "pricing", count: 1 }],
    topAspects: [{ name: "export", count: 1 }],
    segmentBreakdown: { enterprise: 2, new: 1 },
    repeatCustomerCount: 2,
    newCustomerCount: 1,
  };

  it("verifies exact verbatim substring quotes successfully", () => {
    const quote = "Every time I try to export our monthly board report to CSV, the web app crashes with a blank white screen.";
    const result = checkQuoteGrounded(quote, sampleItems);

    expect(result.grounded).toBe(true);
    expect(result.matchingItem?.id).toBe("item-01");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("verifies sentence-level quotes with trimmed punctuation or lowercase", () => {
    const quote = "pricing increased by 65% with zero advance notice";
    const result = checkQuoteGrounded(quote, sampleItems);

    expect(result.grounded).toBe(true);
    expect(result.matchingItem?.id).toBe("item-02");
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("catches and flags completely fabricated quotes", () => {
    const hallucinatedQuote = "The system is brilliant and we saved 40 hours per week with automatic AI sorting!";
    const result = checkQuoteGrounded(hallucinatedQuote, sampleItems);

    expect(result.grounded).toBe(false);
    expect(result.matchingItem).toBeUndefined();
    expect(result.confidence).toBe(0);
  });

  it("verifyAndGroundPayload drops or replaces hallucinated quotes", () => {
    const rawPayload = {
      headline: "Repeat customers are experiencing price shocks and export crashes.",
      keyIssues: [
        {
          title: "Surprise Renewal Price Hike",
          description: "65% increase on contract renewal",
          severity: "critical" as const,
          frequencyCount: 1,
          affectedSegment: "Enterprise",
        },
      ],
      supportingComments: [
        {
          quote: "pricing increased by 65% with zero advance notice",
          customerSegment: "enterprise",
          grounded: true,
        },
        {
          quote: "This is a completely fabricated fake review that was never submitted by any user.",
          customerSegment: "enterprise",
          grounded: true,
        },
      ],
      recommendedActions: [
        {
          title: "Introduce advance renewal notifications",
          rationale: "Prevents churn to ClickUp",
          urgency: "immediate" as const,
          expectedImpact: "High",
        },
      ],
      caveats: [],
      followUpQuestions: ["What about new customer onboarding?"],
    };

    const verified = verifyAndGroundPayload(rawPayload, sampleItems, mockMetrics, true);

    expect(verified.supportingComments.length).toBeGreaterThan(0);
    // Ensure all returned quotes are actually grounded
    for (const c of verified.supportingComments) {
      expect(c.grounded).toBe(true);
      const check = checkQuoteGrounded(c.quote, sampleItems);
      expect(check.grounded).toBe(true);
    }
  });

  it("appends segment caveat when segmentDataAvailable is false", () => {
    const rawPayload = {
      headline: "Overview of customer sentiment",
      keyIssues: [],
      supportingComments: [],
      recommendedActions: [],
      caveats: [],
      followUpQuestions: [],
    };

    const verified = verifyAndGroundPayload(rawPayload, sampleItems, mockMetrics, false);

    expect(verified.caveats.some((c) => c.toLowerCase().includes("segment"))).toBe(true);
  });

  it("matches deterministic counts to subset metrics", () => {
    const rawPayload = {
      headline: "Overview",
      keyIssues: [],
      supportingComments: [],
      recommendedActions: [],
      caveats: [],
      followUpQuestions: [],
    };

    const verified = verifyAndGroundPayload(rawPayload, sampleItems, mockMetrics, true);

    expect(verified.metrics.totalAnalyzed).toBe(3);
    expect(verified.metrics.negativeCount).toBe(3);
    expect(verified.metrics.positiveCount).toBe(0);
    expect(verified.metrics.averageRating).toBe(1.0);
  });
});
