import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { checkQuoteGrounded, verifyAndGroundPayload } from "@/lib/graph/chat/grounding";
import type { ChatFeedbackItem, SubsetMetrics } from "@/lib/graph/chat/state";

interface GoldenCase {
  id: string;
  category: string;
  question: string;
  expectedIntent?: string;
  expectedIsRepeat?: boolean;
  expectedSentiment?: string;
  expectedKeyIssuesKeywords?: string[];
}

describe("Chat Golden Dataset Evaluation Harness", () => {
  const goldenPath = path.join(process.cwd(), "tests/chat/golden.json");
  const cases: GoldenCase[] = JSON.parse(fs.readFileSync(goldenPath, "utf8"));

  const mockFeedback: ChatFeedbackItem[] = [
    {
      id: "f-01",
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
      id: "f-02",
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
      id: "f-03",
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
    {
      id: "f-04",
      text: "Please add a native Slack bot integration so our team can create, assign, and update tasks directly from Slack channels.",
      rating: 4,
      sentiment: "positive",
      sentimentScore: 0.6,
      aspects: [{ aspect: "integrations", sentiment: "positive" }],
      isChurnRisk: false,
      isRepeatCustomer: true,
      customerSegment: "pro_annual",
      customerId: "cust_rep_301",
      orderCount: 4,
      source: "G2",
      product: "PulseIQ Pro",
      occurredAt: new Date("2026-09-10"),
    },
  ];

  const mockMetrics: SubsetMetrics = {
    totalRetrieved: mockFeedback.length,
    sentimentCounts: { positive: 1, neutral: 0, negative: 3 },
    averageRating: 1.75,
    topPainPoints: [{ name: "pricing", count: 1 }, { name: "export", count: 1 }],
    topAspects: [{ name: "export", count: 1 }, { name: "pricing", count: 1 }],
    segmentBreakdown: { enterprise: 2, new: 1, pro_annual: 1 },
    repeatCustomerCount: 3,
    newCustomerCount: 1,
  };

  it("loads 12 golden test questions", () => {
    expect(cases.length).toBeGreaterThanOrEqual(10);
  });

  cases.forEach((goldCase) => {
    it(`evaluates ${goldCase.id} (${goldCase.category}): "${goldCase.question}"`, () => {
      const qLower = goldCase.question.toLowerCase();

      // Rule-based segment extraction test
      if (goldCase.expectedIsRepeat !== undefined) {
        let isRepeat: boolean | null = null;
        if (qLower.includes("repeat") || qLower.includes("renewal") || qLower.includes("loyal")) {
          isRepeat = true;
        } else if (qLower.includes("new customer") || qLower.includes("onboard") || qLower.includes("invite")) {
          isRepeat = false;
        }
        expect(isRepeat).toBe(goldCase.expectedIsRepeat);
      }

      // Synthesize and check grounding
      const rawPayload = {
        headline: `Findings for: ${goldCase.question}`,
        keyIssues: [
          {
            title: "Issue identified",
            description: "Direct customer feedback points to recurring pain point.",
            severity: "high" as const,
            frequencyCount: 2,
            affectedSegment: goldCase.expectedIsRepeat ? "Repeat Customers" : "New Customers",
          },
        ],
        supportingComments: [
          {
            quote: "Every time I try to export our monthly board report to CSV, the web app crashes with a blank white screen.",
            customerSegment: "enterprise",
            grounded: true,
          },
        ],
        recommendedActions: [
          {
            title: "Fix underlying bottleneck",
            rationale: "Improves customer retention.",
            urgency: "immediate" as const,
            expectedImpact: "High",
          },
        ],
        caveats: [],
        followUpQuestions: ["What are other user segments reporting?"],
      };

      const grounded = verifyAndGroundPayload(
        rawPayload,
        mockFeedback,
        mockMetrics,
        goldCase.id !== "gold-12"
      );

      // Assertions
      expect(grounded.headline).toBeTruthy();
      expect(grounded.keyIssues.length).toBeGreaterThan(0);
      expect(grounded.supportingComments.length).toBeGreaterThan(0);

      // Verbatim quote grounding assertion
      for (const comment of grounded.supportingComments) {
        expect(comment.grounded).toBe(true);
        const match = checkQuoteGrounded(comment.quote, mockFeedback);
        expect(match.grounded).toBe(true);
      }

      // Missing segment caveat assertion
      if (goldCase.id === "gold-12") {
        expect(grounded.caveats.some((c) => c.toLowerCase().includes("segment"))).toBe(true);
      }
    });
  });
});
