import { SCORING_CONFIG } from "./scoring.config";

export interface ClusterItem<T = any> {
  id: string;
  text: string;
  embedding: number[];
  payload?: T;
}

export interface ClusterResult<T = any> {
  clusterIndex: number;
  items: ClusterItem<T>[];
  centroid: number[];
  representativeItems: ClusterItem<T>[];
}

/**
 * Computes cosine similarity between two numeric vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const valA = a[i];
    const valB = b[i];
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Computes the mean centroid vector of an array of items.
 */
export function computeCentroid(items: ClusterItem[]): number[] {
  if (items.length === 0) return [];
  const dim = items[0].embedding.length;
  const centroid = new Array(dim).fill(0);

  for (const item of items) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += item.embedding[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    centroid[i] /= items.length;
  }

  return centroid;
}

/**
 * Agglomerative Hierarchical Clustering using average-linkage cosine similarity.
 */
export function clusterItemsAgglomerative<T>(
  items: ClusterItem<T>[],
  similarityThreshold = SCORING_CONFIG.clustering.similarityThreshold,
  singletonMergeThreshold = SCORING_CONFIG.clustering.singletonMergeThreshold
): ClusterResult<T>[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [
      {
        clusterIndex: 0,
        items,
        centroid: items[0].embedding,
        representativeItems: items,
      },
    ];
  }

  // Initial state: each item starts in its own cluster
  let clusters: Array<{ items: ClusterItem<T>[]; centroid: number[] }> = items.map(
    (item) => ({
      items: [item],
      centroid: [...item.embedding],
    })
  );

  // Iteratively merge the two most similar clusters until max similarity is below threshold
  while (clusters.length > 1) {
    let bestSim = -1;
    let bestI = -1;
    let bestJ = -1;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const sim = cosineSimilarity(clusters[i].centroid, clusters[j].centroid);
        if (sim > bestSim) {
          bestSim = sim;
          bestI = i;
          bestJ = j;
        }
      }
    }

    if (bestSim >= similarityThreshold && bestI !== -1 && bestJ !== -1) {
      // Merge bestJ into bestI
      const mergedItems = [...clusters[bestI].items, ...clusters[bestJ].items];
      const mergedCentroid = computeCentroid(mergedItems);

      clusters[bestI] = {
        items: mergedItems,
        centroid: mergedCentroid,
      };

      clusters.splice(bestJ, 1);
    } else {
      // No pair meets threshold
      break;
    }
  }

  // Handle singletons (size 1 clusters): merge into nearest multi-item cluster if similarity > singletonMergeThreshold
  const multiItemClusters = clusters.filter((c) => c.items.length > 1);
  const singletons = clusters.filter((c) => c.items.length === 1);
  const unmergedSingletons: ClusterItem<T>[] = [];

  if (multiItemClusters.length > 0) {
    for (const singleton of singletons) {
      let nearestClusterIndex = -1;
      let highestSim = -1;

      for (let i = 0; i < multiItemClusters.length; i++) {
        const sim = cosineSimilarity(singleton.centroid, multiItemClusters[i].centroid);
        if (sim > highestSim) {
          highestSim = sim;
          nearestClusterIndex = i;
        }
      }

      if (highestSim >= singletonMergeThreshold && nearestClusterIndex !== -1) {
        multiItemClusters[nearestClusterIndex].items.push(singleton.items[0]);
        multiItemClusters[nearestClusterIndex].centroid = computeCentroid(
          multiItemClusters[nearestClusterIndex].items
        );
      } else {
        unmergedSingletons.push(singleton.items[0]);
      }
    }
    clusters = multiItemClusters;
  } else {
    // If all are singletons, keep as is
    unmergedSingletons.push(...singletons.map((s) => s.items[0]));
    clusters = [];
  }

  // If there are unmerged singletons, group them under "Other / Long tail" if count >= 1
  if (unmergedSingletons.length > 0) {
    clusters.push({
      items: unmergedSingletons,
      centroid: computeCentroid(unmergedSingletons),
    });
  }

  // Sort clusters by size descending
  clusters.sort((a, b) => b.items.length - a.items.length);

  // Build final results and select representative items closest to centroid
  return clusters.map((cluster, idx) => {
    // Sort items by similarity to cluster centroid to pick best representatives
    const sortedByCentroid = [...cluster.items].sort((a, b) => {
      const simA = cosineSimilarity(a.embedding, cluster.centroid);
      const simB = cosineSimilarity(b.embedding, cluster.centroid);
      return simB - simA;
    });

    const representativeItems = sortedByCentroid.slice(
      0,
      SCORING_CONFIG.clustering.representativeQuotesPerCluster
    );

    return {
      clusterIndex: idx,
      items: cluster.items,
      centroid: cluster.centroid,
      representativeItems,
    };
  });
}
