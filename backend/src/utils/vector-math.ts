/** Cosine similarity for embedding vectors stored as JSON arrays. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function topKBySimilarity<T extends { embedding: number[] }>(
  query: number[],
  items: T[],
  k: number,
  minScore = 0.2
): Array<T & { score: number }> {
  return items
    .map(item => ({
      ...item,
      score: cosineSimilarity(query, item.embedding)
    }))
    .filter(x => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
