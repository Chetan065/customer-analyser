import { describe, it, expect } from "vitest";
import {
  calculateThemeScores,
  computeSeverityLabel,
  computeRecencyShare,
} from "@/lib/analysis/scoring";

describe("Deterministic Scoring System", () => {
  it("correctly computes severity labels based on thresholds", () => {
    expect(computeSeverityLabel(0.2)).toBe("Low");
    expect(computeSeverityLabel(0.34)).toBe("Low");
    expect(computeSeverityLabel(0.35)).toBe("Medium");
    expect(computeSeverityLabel(0.59)).toBe("Medium");
    expect(computeSeverityLabel(0.6)).toBe("High");
    expect(computeSeverityLabel(0.79)).toBe("High");
    expect(computeSeverityLabel(0.8)).toBe("Critical");
    expect(computeSeverityLabel(1.0)).toBe("Critical");
  });

  it("calculates priorityScore correctly for a critical pain point", () => {
    const scores = calculateThemeScores({
      mentions: 50,
      totalProjectItems: 100,
      maxThemeMentions: 50, // normFrequency = 1.0
      kind: "pain_point",
      rawSeverities: [5, 5, 5, 5], // avg 5 / 5 = 1.0
      sourceItemSentimentScores: [-0.8, -0.9, -1.0], // avg = -0.9 -> negativity = 0.9
      churnRiskCount: 25, // churnShare = 25/50 = 0.5
      dates: [], // recency defaults to 0.5
    });

    expect(scores.normFrequency).toBe(1.0);
    expect(scores.severityScore).toBe(1.0);
    expect(scores.severityLabel).toBe("Critical");
    expect(scores.negativity).toBe(0.9);
    expect(scores.churnShare).toBe(0.5);
    expect(scores.recencyShare).toBe(0.5);

    // priorityScore = 100 * (0.40*1.0 + 0.30*1.0 + 0.15*0.9 + 0.10*0.5 + 0.05*0.5)
    // = 100 * (0.40 + 0.30 + 0.135 + 0.05 + 0.025) = 100 * 0.91 = 91.0
    expect(scores.priorityScore).toBe(91);
  });

  it("caps feature request severity proxy at 0.6", () => {
    const scores = calculateThemeScores({
      mentions: 20,
      totalProjectItems: 100,
      maxThemeMentions: 40,
      kind: "feature_request",
      sourceItemSentimentScores: [-0.9, 0.8, -1.0], // abs mean = 0.9 > 0.6
      churnRiskCount: 0,
    });

    expect(scores.severityScore).toBe(0.6);
  });

  it("computes recency share correctly with valid dates", () => {
    const minDate = new Date("2026-01-01T00:00:00Z");
    const maxDate = new Date("2026-01-10T00:00:00Z"); // 9 days span

    // Cutoff is 70% mark = Jan 7.3
    const dates = [
      new Date("2026-01-02T00:00:00Z"), // old
      new Date("2026-01-08T00:00:00Z"), // recent
      new Date("2026-01-09T00:00:00Z"), // recent
    ];

    const share = computeRecencyShare(dates, minDate, maxDate);
    expect(share).toBeCloseTo(2 / 3);
  });
});
