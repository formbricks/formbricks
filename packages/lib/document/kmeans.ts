import { TDocument } from "@formbricks/types/documents";

class KMeans {
  private k: number;
  private maxIterations: number;
  private centroids: number[][];

  constructor(k: number, maxIterations: number = 100) {
    this.k = k;
    this.maxIterations = maxIterations;
  }

  fit(documents: TDocument[]): number[] {
    // Extract the vectors from the documents
    const points = documents.map((document) => document.vector);

    // Initialize centroids randomly
    this.centroids = this.initializeCentroids(points);

    for (let i = 0; i < this.maxIterations; i++) {
      const clusters: TDocument[][] = Array.from({ length: this.k }, () => []);

      // Assign documents to nearest centroid
      for (const document of documents) {
        const closestCentroidIndex = this.getClosestCentroidIndex(document.vector);
        clusters[closestCentroidIndex].push(document);
      }

      // Update centroids
      const newCentroids = clusters.map((cluster) =>
        cluster.length > 0
          ? this.calculateCentroid(cluster.map((d) => d.vector))
          : this.centroids[clusters.indexOf(cluster)]
      );

      // Check for convergence
      if (this.hasConverged(newCentroids)) {
        break;
      }

      this.centroids = newCentroids;
    }

    // Assign final clusters
    return documents.map((document) => this.getClosestCentroidIndex(document.vector));
  }

  private initializeCentroids(points: number[][]): number[][] {
    const centroids: number[][] = [];
    const used = new Set<number>();

    while (centroids.length < this.k) {
      const index = Math.floor(Math.random() * points.length);
      if (!used.has(index)) {
        centroids.push([...points[index]]);
        used.add(index);
      }
    }

    return centroids;
  }

  private getClosestCentroidIndex(point: number[]): number {
    let minDistance = Infinity;
    let closestIndex = 0;

    for (let i = 0; i < this.centroids.length; i++) {
      const distance = this.euclideanDistance(point, this.centroids[i]);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }

    return closestIndex;
  }

  private calculateCentroid(cluster: number[][]): number[] {
    const dimensions = cluster[0].length;
    const centroid = new Array(dimensions).fill(0);

    for (const point of cluster) {
      for (let i = 0; i < dimensions; i++) {
        centroid[i] += point[i];
      }
    }

    return centroid.map((sum) => sum / cluster.length);
  }

  private euclideanDistance(a: number[], b: number[]): number {
    return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
  }

  private hasConverged(newCentroids: number[][]): boolean {
    return newCentroids.every((centroid, i) => this.euclideanDistance(centroid, this.centroids[i]) < 1e-6);
  }
}

export async function clusterDocuments(documents: TDocument[], numTopics: number) {
  // 2. Perform clustering
  const kmeans = new KMeans(numTopics);
  const clusterAssignments = kmeans.fit(documents);

  // 3. Analyze clusters
  const clusters: TDocument[][] = Array.from({ length: numTopics }, () => []);
  documents.forEach((document, index) => {
    clusters[clusterAssignments[index]].push(document);
  });

  // 4. Find central documents and extract responses
  const topics = await Promise.all(
    clusters.map(async (cluster, index) => {
      const centroid = kmeans["centroids"][index];
      const centralDocument = cluster.reduce(
        (central, document) => {
          const distance = kmeans["euclideanDistance"](document.vector, centroid);
          return distance < central.distance ? { document, distance } : central;
        },
        { document: cluster[0], distance: Infinity }
      ).document;

      return {
        topicId: index,
        centralDocument: centralDocument,
        size: cluster.length,
      };
    })
  );

  return topics;
}
