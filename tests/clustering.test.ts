import { describe, it, expect } from "vitest";
import {
  cosineSimilarity,
  computeCentroid,
  clusterItemsAgglomerative,
} from "@/lib/analysis/clustering";

describe("Clustering & Vector Math", () => {
  it("calculates exact cosine similarity", () => {
    // Identical
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1.0);
    // Orthogonal
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0);
    // Opposite
    expect(cosineSimilarity([1, 0, 0], [-1, 0, 0])).toBeCloseTo(-1.0);
    // Proportional
    expect(cosineSimilarity([2, 2, 0], [5, 5, 0])).toBeCloseTo(1.0);
  });

  it("computes vector centroid accurately", () => {
    const items = [
      { id: "1", text: "A", embedding: [1, 2, 3] },
      { id: "2", text: "B", embedding: [3, 4, 5] },
    ];
    const centroid = computeCentroid(items);
    expect(centroid).toEqual([2, 3, 4]);
  });

  it("agglomerative clusters similar items and separates dissimilar items", () => {
    const items = [
      // Cluster A: Export issues
      { id: "1", text: "CSV export crash", embedding: [0.95, 0.05, 0.0] },
      { id: "2", text: "Cannot export report", embedding: [0.94, 0.06, 0.0] },
      { id: "3", text: "Export button broken", embedding: [0.93, 0.07, 0.0] },
      // Cluster B: Calendar sync issues
      { id: "4", text: "Calendar sync fails", embedding: [0.05, 0.95, 0.0] },
      { id: "5", text: "Google calendar disconnected", embedding: [0.06, 0.94, 0.0] },
    ];

    const clusters = clusterItemsAgglomerative(items, 0.8, 0.7);

    // Expecting 2 main clusters
    expect(clusters.length).toBe(2);

    const clusterSizes = clusters.map((c) => c.items.length).sort((a, b) => b - a);
    expect(clusterSizes).toEqual([3, 2]);
  });

  it("merges singletons into closest cluster if above merge threshold", () => {
    const items = [
      // Cluster A
      { id: "1", text: "A1", embedding: [1, 0, 0] },
      { id: "2", text: "A2", embedding: [0.98, 0.02, 0] },
      // Near singleton
      { id: "3", text: "A3 singleton", embedding: [0.75, 0.1, 0] },
    ];

    const clusters = clusterItemsAgglomerative(items, 0.9, 0.7);
    // Should merge singleton into Cluster A
    expect(clusters.length).toBe(1);
    expect(clusters[0].items.length).toBe(3);
  });
});
