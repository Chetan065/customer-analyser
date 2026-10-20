export interface ScoringWeights {
  normFrequency: number;
  severity: number;
  negativity: number;
  churn: number;
  recency: number;
}

export const SCORING_CONFIG = {
  // Weights sum to 1.00
  weights: {
    normFrequency: 0.40,
    severity: 0.30,
    negativity: 0.15,
    churn: 0.10,
    recency: 0.05,
  } as ScoringWeights,

  // Severity thresholds for qualitative labels
  severityThresholds: {
    low: 0.35,
    medium: 0.60,
    high: 0.80,
  },

  // Clustering cosine similarity thresholds
  clustering: {
    similarityThreshold: 0.78, // Cosine similarity threshold for grouping into the same cluster
    singletonMergeThreshold: 0.70, // Merge singletons into closest cluster if similarity exceeds this
    maxClustersToLabel: 25, // Top N clusters to submit to LLM for naming
    representativeQuotesPerCluster: 8,
  },
};
