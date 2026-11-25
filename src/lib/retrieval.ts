import type {
  Bm25TermDetail,
  DocumentChunk,
  PcaPoint,
  PcaProjectionResult,
  ScoredChunk,
  SearchMethod,
} from "../types/rag";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "do", "does",
  "for", "from", "had", "has", "have", "how", "if", "in", "into", "is", "it",
  "its", "may", "must", "of", "on", "or", "shall", "that", "the", "their",
  "then", "there", "these", "they", "this", "to", "upon", "was", "were", "what",
  "when", "where", "which", "who", "will", "with", "would",
]);

/**
 * Tokenizes text for BM25 while preserving exact hyphenated identifiers
 * like ERR-77X-THERM, POL-409-B, HR-SAB-19, COM-X9-KA.
 */
export function tokenizeForBm25(text: string): string[] {
  const lowered = text.toLowerCase();
  const matches = lowered.match(/[a-z0-9]+(?:-[a-z0-9]+)+|[a-z0-9]+/g) ?? [];
  const tokens: string[] = [];

  for (const tok of matches) {
    if (tok.includes("-")) {
      // Keep full identifier token intact with high weight
      tokens.push(tok);
    } else if (tok.length > 1 && !STOP_WORDS.has(tok)) {
      tokens.push(tok);
    }
  }
  return tokens;
}

export function cosineSimilarityMath(
  a: number[] | undefined,
  b: number[] | undefined
): { score: number; dot: number; normA: number; normB: number } {
  if (!a || !b || a.length === 0 || b.length === 0) {
    return { score: 0, dot: 0, normA: 0, normB: 0 };
  }
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let sqA = 0;
  let sqB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    sqA += a[i] * a[i];
    sqB += b[i] * b[i];
  }
  const normA = Math.sqrt(sqA);
  const normB = Math.sqrt(sqB);
  const score = normA > 0 && normB > 0 ? dot / (normA * normB) : 0;
  return { score: Math.max(-1, Math.min(1, score)), dot, normA, normB };
}

export function scoreChunks(params: {
  chunks: DocumentChunk[];
  chunkEmbeddings: Record<number, number[]>;
  queryText: string;
  queryEmbedding: number[] | null;
  searchMethod: SearchMethod;
  topK: number;
  minThreshold: number;
}): ScoredChunk[] {
  const {
    chunks,
    chunkEmbeddings,
    queryText,
    queryEmbedding,
    searchMethod,
    topK,
    minThreshold,
  } = params;

  if (chunks.length === 0) return [];

  // 1. Prepare BM25 corpus statistics
  const N = chunks.length;
  const k1 = 1.5;
  const b = 0.75;

  const docTokens = chunks.map((c) => tokenizeForBm25(c.text));
  const avgDocLen =
    docTokens.reduce((sum, toks) => sum + toks.length, 0) / Math.max(1, N);

  const queryTerms = Array.from(new Set(tokenizeForBm25(queryText)));
  const docFreq = new Map<string, number>();

  for (const term of queryTerms) {
    let df = 0;
    for (const toks of docTokens) {
      if (toks.includes(term)) df++;
    }
    docFreq.set(term, df);
  }

  // 2. Compute raw Dense + BM25 scores per chunk
  const preliminary = chunks.map((chunk, idx) => {
    const emb = chunkEmbeddings[chunk.id];
    const cos = cosineSimilarityMath(queryEmbedding ?? undefined, emb);

    const toks = docTokens[idx];
    const docLen = toks.length;
    const tfMap = new Map<string, number>();
    for (const t of toks) {
      tfMap.set(t, (tfMap.get(t) ?? 0) + 1);
    }

    let bm25Raw = 0;
    const bm25Terms: Bm25TermDetail[] = [];

    for (const term of queryTerms) {
      const tf = tfMap.get(term) ?? 0;
      const df = docFreq.get(term) ?? 0;
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
      // Slight extra weight for exact hyphenated ID codes
      const idBoost = term.includes("-") ? 1.65 : 1.0;
      const denom = tf + k1 * (1 - b + b * (docLen / Math.max(1, avgDocLen)));
      const contribution = tf > 0 ? idBoost * idf * ((tf * (k1 + 1)) / Math.max(0.0001, denom)) : 0;
      bm25Raw += contribution;
      bm25Terms.push({ term, tf, df, idf: idf * idBoost, contribution });
    }

    // Smooth monotonic normalization to [0, 1] so zero stays 0 and strong matches reach ~0.85+
    const bm25Normalized = bm25Raw > 0 ? bm25Raw / (bm25Raw + 2.2) : 0;

    return {
      chunk,
      denseScore: Math.max(0, cos.score),
      dotProduct: cos.dot,
      normA: cos.normA,
      normB: cos.normB,
      bm25Raw,
      bm25Normalized,
      bm25Terms,
    };
  });

  // 3. Assign Dense ranks and BM25 ranks for Reciprocal Rank Fusion
  const denseOrder = [...preliminary].sort((a, b) => b.denseScore - a.denseScore);
  const denseRankMap = new Map<number, number>();
  denseOrder.forEach((item, i) => denseRankMap.set(item.chunk.id, i + 1));

  const bm25Order = [...preliminary].sort((a, b) => {
    if (b.bm25Raw !== a.bm25Raw) return b.bm25Raw - a.bm25Raw;
    return b.denseScore - a.denseScore;
  });
  const bm25RankMap = new Map<number, number>();
  bm25Order.forEach((item, i) => bm25RankMap.set(item.chunk.id, i + 1));

  const RRF_K = 60;
  const maxTheoreticalRrf = 2 / (RRF_K + 1);

  const combined = preliminary.map((item) => {
    const denseRank = denseRankMap.get(item.chunk.id) ?? N;
    const bm25Rank = bm25RankMap.get(item.chunk.id) ?? N;
    // If BM25 had zero keyword overlap at all, only count dense rank in RRF so irrelevant docs don't get free rank points
    const bm25Contribution = item.bm25Raw > 0 ? 1 / (RRF_K + bm25Rank) : 0;
    const denseContribution = item.denseScore > 0 ? 1 / (RRF_K + denseRank) : 0;
    const rrfRaw = denseContribution + bm25Contribution;
    const rrfNormalized = Math.min(1, rrfRaw / maxTheoreticalRrf);

    let activeScore = item.denseScore;
    if (searchMethod === "bm25") {
      activeScore = item.bm25Normalized;
    } else if (searchMethod === "hybrid") {
      // Blend RRF normalized with underlying signal magnitude so threshold filtering stays meaningful on out-of-scope queries
      const signalFloor = Math.max(item.denseScore, item.bm25Normalized);
      activeScore = Math.min(1, rrfNormalized * (0.35 + 0.65 * signalFloor));
    }

    return {
      ...item,
      denseRank,
      bm25Rank,
      rrfRaw,
      rrfNormalized,
      activeScore,
      activeRank: 0,
      passedTopK: false,
      passedThreshold: false,
      retrieved: false,
    };
  });

  combined.sort((a, b) => b.activeScore - a.activeScore);

  return combined.map((item, idx) => {
    const activeRank = idx + 1;
    const passedTopK = activeRank <= topK;
    const passedThreshold = item.activeScore >= minThreshold;
    return {
      ...item,
      activeRank,
      passedTopK,
      passedThreshold,
      retrieved: passedTopK && passedThreshold,
    };
  });
}

/**
 * Exact 2D PCA via dual Gram matrix (N x N) + deflated power iteration.
 * Fast (<1ms) even on 3,072-dimensional Gemini embeddings, and projects
 * the query vector onto the identical principal component axes.
 */
export function computePca2D(
  chunkVectors: { id: number; vector: number[] }[],
  queryVector: number[] | null
): PcaProjectionResult {
  const valid = chunkVectors.filter((c) => c.vector && c.vector.length > 0);
  const N = valid.length;

  if (N === 0) {
    return { chunkPoints: [], queryPoint: null, varianceExplained: [0, 0] };
  }

  const D = valid[0].vector.length;

  if (N === 1) {
    const cos = queryVector ? cosineSimilarityMath(queryVector, valid[0].vector).score : undefined;
    return {
      chunkPoints: [
        { id: valid[0].id, label: `Chunk ${valid[0].id}`, x: 0, y: 0, cosineToQuery: cos },
      ],
      queryPoint: queryVector
        ? { id: 0, label: "User Query", x: 0.35, y: 0.25, isQuery: true }
        : null,
      varianceExplained: [100, 0],
    };
  }

  // 1. Compute mean vector across chunks
  const mean = new Float64Array(D);
  for (let i = 0; i < N; i++) {
    const vec = valid[i].vector;
    for (let d = 0; d < D; d++) {
      mean[d] += vec[d] / N;
    }
  }

  // 2. Center chunk matrix X (N x D)
  const X: Float64Array[] = valid.map((item) => {
    const row = new Float64Array(D);
    for (let d = 0; d < D; d++) {
      row[d] = item.vector[d] - mean[d];
    }
    return row;
  });

  // 3. Build N x N Gram matrix G = X * X^T
  const G: Float64Array[] = Array.from({ length: N }, () => new Float64Array(N));
  let totalVariance = 0;
  for (let i = 0; i < N; i++) {
    for (let j = i; j < N; j++) {
      let sum = 0;
      const ri = X[i];
      const rj = X[j];
      for (let d = 0; d < D; d++) {
        sum += ri[d] * rj[d];
      }
      G[i][j] = sum;
      G[j][i] = sum;
      if (i === j) totalVariance += sum;
    }
  }

  function powerIteration(
    matrix: Float64Array[],
    seedOffset: number
  ): { eigenvec: Float64Array; eigenval: number } {
    const v = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      v[i] = Math.sin((i + 1) * (seedOffset + 1.618)) + 0.5;
    }
    let norm = Math.sqrt(v.reduce((s, val) => s + val * val, 0)) || 1;
    for (let i = 0; i < N; i++) v[i] /= norm;

    let eigenval = 0;
    const next = new Float64Array(N);

    for (let iter = 0; iter < 50; iter++) {
      for (let i = 0; i < N; i++) {
        let sum = 0;
        const row = matrix[i];
        for (let j = 0; j < N; j++) {
          sum += row[j] * v[j];
        }
        next[i] = sum;
      }
      norm = Math.sqrt(next.reduce((s, val) => s + val * val, 0));
      if (norm < 1e-12) {
        return { eigenvec: v, eigenval: 0 };
      }
      eigenval = norm;
      for (let i = 0; i < N; i++) {
        v[i] = next[i] / norm;
      }
    }
    return { eigenvec: v, eigenval };
  }

  // First principal eigenvector of G
  const { eigenvec: v1, eigenval: lambda1 } = powerIteration(G, 1);

  // Deflate G -> G2 = G - lambda1 * v1 * v1^T
  const G2: Float64Array[] = Array.from({ length: N }, (_, i) => {
    const row = new Float64Array(N);
    for (let j = 0; j < N; j++) {
      row[j] = G[i][j] - lambda1 * v1[i] * v1[j];
    }
    return row;
  });

  // Second principal eigenvector of G2
  const { eigenvec: v2, eigenval: lambda2 } = powerIteration(G2, 7);

  // Recover unit principal axes in D-space: u_k = X^T v_k / ||X^T v_k||
  function recoverAxis(v: Float64Array): Float64Array {
    const u = new Float64Array(D);
    for (let i = 0; i < N; i++) {
      const weight = v[i];
      const row = X[i];
      for (let d = 0; d < D; d++) {
        u[d] += weight * row[d];
      }
    }
    let norm = 0;
    for (let d = 0; d < D; d++) norm += u[d] * u[d];
    norm = Math.sqrt(norm);
    if (norm > 1e-12) {
      for (let d = 0; d < D; d++) u[d] /= norm;
    }
    return u;
  }

  const u1 = recoverAxis(v1);
  const u2 = recoverAxis(v2);

  function project(vec: number[]): [number, number] {
    let x = 0;
    let y = 0;
    for (let d = 0; d < D; d++) {
      const centered = (vec[d] ?? 0) - mean[d];
      x += centered * u1[d];
      y += centered * u2[d];
    }
    return [x, y];
  }

  const chunkPoints: PcaPoint[] = valid.map((item) => {
    const [x, y] = project(item.vector);
    const cos = queryVector ? cosineSimilarityMath(queryVector, item.vector).score : undefined;
    return {
      id: item.id,
      label: `Chunk ${item.id}`,
      x,
      y,
      cosineToQuery: cos,
    };
  });

  let queryPoint: PcaPoint | null = null;
  if (queryVector && queryVector.length > 0) {
    const [qx, qy] = project(queryVector);
    queryPoint = {
      id: 0,
      label: "Query Vector",
      x: qx,
      y: qy,
      isQuery: true,
    };
  }

  const vExp1 = totalVariance > 1e-12 ? Math.round((lambda1 / totalVariance) * 100) : 50;
  const vExp2 = totalVariance > 1e-12 ? Math.round((lambda2 / totalVariance) * 100) : 25;

  return {
    chunkPoints,
    queryPoint,
    varianceExplained: [Math.min(100, vExp1), Math.min(100 - Math.min(100, vExp1), vExp2)],
  };
}
