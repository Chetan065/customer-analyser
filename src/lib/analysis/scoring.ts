import { SCORING_CONFIG } from "./scoring.config";

export interface ThemeMetricsInput {
  mentions: number;
  totalProjectItems: number;
  maxThemeMentions: number;
  kind: "pain_point" | "feature_request";
  // For pain points: raw severity ratings 1..5; for feature requests: sentiment scores
  rawSeverities?: number[];
  sourceItemSentimentScores: number[];
  churnRiskCount: number;
  dates?: (Date | null | undefined)[];
  overallMinDate?: Date | null;
  overallMaxDate?: Date | null;
}

export interface ComputedThemeScores {
  frequency: number;
  normFrequency: number;
  severityScore: number;
  severityLabel: "Low" | "Medium" | "High" | "Critical";
  negativity: number;
  churnShare: number;
  recencyShare: number;
  priorityScore: number;
}

export function computeSeverityLabel(score: number): "Low" | "Medium" | "High" | "Critical" {
  const { low, medium, high } = SCORING_CONFIG.severityThresholds;
  if (score < low) return "Low";
  if (score < medium) return "Medium";
  if (score < high) return "High";
  return "Critical";
}

export function computeRecencyShare(
  dates: (Date | null | undefined)[],
  minDate?: Date | null,
  maxDate?: Date | null
): number {
  const validDates = dates.filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()));
  if (validDates.length === 0 || !minDate || !maxDate) {
    return 0.5; // Default 0.5 if no dates present
  }

  const rangeMs = maxDate.getTime() - minDate.getTime();
  if (rangeMs <= 0) return 0.5;

  // Most recent 30% threshold timestamp
  const cutoffMs = maxDate.getTime() - rangeMs * 0.3;

  const recentCount = validDates.filter((d) => d.getTime() >= cutoffMs).length;
  return recentCount / validDates.length;
}

export function calculateThemeScores(input: ThemeMetricsInput): ComputedThemeScores {
  const {
    mentions,
    totalProjectItems,
    maxThemeMentions,
    kind,
    rawSeverities = [],
    sourceItemSentimentScores,
    churnRiskCount,
    dates = [],
    overallMinDate,
    overallMaxDate,
  } = input;

  const safeTotal = Math.max(1, totalProjectItems);
  const frequency = mentions / safeTotal;

  // normFrequency scaled against largest theme's frequency so the top theme approaches 1
  const normFrequency =
    maxThemeMentions > 0 ? Math.min(1, mentions / maxThemeMentions) : 0;

  // Severity calculation
  let severityScore = 0;
  if (kind === "pain_point") {
    if (rawSeverities.length > 0) {
      const avgRawSeverity =
        rawSeverities.reduce((sum, s) => sum + s, 0) / rawSeverities.length;
      // Map 1..5 scale to 0.2..1.0
      severityScore = Math.min(1, Math.max(0, avgRawSeverity / 5));
    } else {
      severityScore = 0.5;
    }
  } else {
    // Feature request: use mean |sentimentScore| of source items as proxy, capped at 0.6
    if (sourceItemSentimentScores.length > 0) {
      const avgAbsSentiment =
        sourceItemSentimentScores.reduce((sum, s) => sum + Math.abs(s), 0) /
        sourceItemSentimentScores.length;
      severityScore = Math.min(0.6, avgAbsSentiment);
    } else {
      severityScore = 0.3;
    }
  }

  // Negativity: max(0, -avgSentimentScore)
  const avgSentiment =
    sourceItemSentimentScores.length > 0
      ? sourceItemSentimentScores.reduce((sum, s) => sum + s, 0) /
        sourceItemSentimentScores.length
      : 0;
  const negativity = Math.min(1, Math.max(0, -avgSentiment));

  // Churn share: share of source items flagged isChurnRisk
  const churnShare = mentions > 0 ? Math.min(1, churnRiskCount / mentions) : 0;

  // Recency share
  const recencyShare = computeRecencyShare(dates, overallMinDate, overallMaxDate);

  // Formula: priorityScore = 100 * (0.40*normFrequency + 0.30*severity + 0.15*negativity + 0.10*churn + 0.05*recency)
  const { weights } = SCORING_CONFIG;
  const rawPriority =
    weights.normFrequency * normFrequency +
    weights.severity * severityScore +
    weights.negativity * negativity +
    weights.churn * churnShare +
    weights.recency * recencyShare;

  const priorityScore = Math.round(rawPriority * 100 * 10) / 10; // Round to 1 decimal place

  return {
    frequency,
    normFrequency,
    severityScore,
    severityLabel: computeSeverityLabel(severityScore),
    negativity,
    churnShare,
    recencyShare,
    priorityScore,
  };
}
