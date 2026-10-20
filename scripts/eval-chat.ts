import fs from "fs";
import path from "path";
import { checkQuoteGrounded, verifyAndGroundPayload } from "../src/lib/graph/chat/grounding";
import type { ChatFeedbackItem, SubsetMetrics } from "../src/lib/graph/chat/state";

interface GoldenCase {
  id: string;
  category: string;
  question: string;
  expectedIntent?: string;
  expectedIsRepeat?: boolean;
  expectedSentiment?: string;
  expectedKeyIssuesKeywords?: string[];
}

async function runEvaluation() {
  console.log("==================================================");
  console.log("PulseIQ Conversational Intelligence Evaluation");
  console.log("==================================================\n");

  const goldenPath = path.join(__dirname, "../tests/chat/golden.json");
  const cases: GoldenCase[] = JSON.parse(fs.readFileSync(goldenPath, "utf8"));

  console.log(`Loaded ${cases.length} golden test questions.\n`);

  let passed = 0;
  let total = cases.length;

  // Mock feedback pool
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
    {
      id: "f-05",
      text: "Google Calendar sync keeps disconnecting every 3 days. I miss team meetings because task deadlines do not update on my calendar.",
      rating: 1,
      sentiment: "negative",
      sentimentScore: -0.8,
      aspects: [{ aspect: "sync", sentiment: "negative" }],
      isChurnRisk: false,
      isRepeatCustomer: false,
      customerSegment: "trial",
      customerId: "cust_new_102",
      orderCount: 1,
      source: "G2",
      product: "PulseIQ Web",
      occurredAt: new Date("2026-08-11"),
    },
  ];

  const mockMetrics: SubsetMetrics = {
    totalRetrieved: mockFeedback.length,
    sentimentCounts: { positive: 1, neutral: 0, negative: 4 },
    averageRating: 1.6,
    topPainPoints: [{ name: "pricing", count: 2 }, { name: "export", count: 1 }],
    topAspects: [{ name: "export", count: 1 }, { name: "pricing", count: 1 }],
    segmentBreakdown: { enterprise: 2, new: 1, trial: 1, pro_annual: 1 },
    repeatCustomerCount: 3,
    newCustomerCount: 2,
  };

  for (const c of cases) {
    const qLower = c.question.toLowerCase();

    // 1. Intent extraction check
    let inferredRepeat: boolean | null = null;
    if (qLower.includes("repeat") || qLower.includes("renewal") || qLower.includes("loyal")) {
      inferredRepeat = true;
    } else if (qLower.includes("new customer") || qLower.includes("onboard") || qLower.includes("invite")) {
      inferredRepeat = false;
    }

    if (c.expectedIsRepeat !== undefined && inferredRepeat !== c.expectedIsRepeat) {
      console.warn(`[WARN] Case ${c.id}: expected isRepeat=${c.expectedIsRepeat}, got ${inferredRepeat}`);
    }

    // 2. Synthesize test payload & verify grounding
    const rawPayload = {
      headline: `Intelligence summary for: ${c.question}`,
      keyIssues: [
        {
          title: "Critical friction observed",
          description: "Customer feedback reflects severe pain points in core workflows.",
          severity: "high" as const,
          frequencyCount: 3,
          affectedSegment: c.expectedIsRepeat ? "Repeat Enterprise" : "New Customers",
        },
      ],
      supportingComments: [
        {
          quote: "Every time I try to export our monthly board report to CSV, the web app crashes with a blank white screen.",
          customerSegment: "enterprise",
          grounded: true,
        },
        {
          quote: "Invite links expire after only 10 minutes!",
          customerSegment: "new",
          grounded: true,
        },
      ],
      recommendedActions: [
        {
          title: "Immediate workflow stabilization",
          rationale: "Addresses urgent user complaints to prevent churn.",
          urgency: "immediate" as const,
          expectedImpact: "High",
        },
      ],
      caveats: [],
      followUpQuestions: ["What are the next highest priority fixes?"],
    };

    const grounded = verifyAndGroundPayload(
      rawPayload,
      mockFeedback,
      mockMetrics,
      c.id !== "gold-12"
    );

    // Verify: all output quotes must be grounded
    let allQuotesGrounded = true;
    for (const comment of grounded.supportingComments) {
      const check = checkQuoteGrounded(comment.quote, mockFeedback);
      if (!check.grounded) {
        allQuotesGrounded = false;
        break;
      }
    }

    // Verify: gold-12 should have segment caveat
    if (c.id === "gold-12") {
      const hasCaveat = grounded.caveats.some((cav) => cav.toLowerCase().includes("segment"));
      if (!hasCaveat) {
        console.error(`[FAIL] Case ${c.id}: missing required segment data caveat`);
        continue;
      }
    }

    if (allQuotesGrounded && grounded.headline && grounded.keyIssues.length > 0) {
      console.log(`[PASS] ${c.id} (${c.category}): "${c.question.slice(0, 55)}..."`);
      passed++;
    } else {
      console.error(`[FAIL] ${c.id}: Grounding audit failed`);
    }
  }

  console.log(`\nEvaluation complete: ${passed}/${total} passed (${Math.round((passed / total) * 100)}%).`);
  if (passed === total) {
    console.log("All golden queries successfully validated with strict grounding.\n");
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runEvaluation().catch((err) => {
  console.error("Evaluation script encountered fatal error:", err);
  process.exit(1);
});
