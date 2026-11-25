export type ExecutionMode = "live" | "demo";

export type ChunkingStrategy = "fixed" | "sentence" | "recursive";

export type SearchMethod = "dense" | "bm25" | "hybrid";

export type StageId = 1 | 2 | 3 | 4 | 5 | 6;

export interface SampleDataset {
  id: string;
  title: string;
  shortLabel: string;
  category: string;
  description: string;
  defaultQuery: string;
  suggestedQueries: string[];
  content: string;
}

export interface DocumentChunk {
  id: number;
  text: string;
  startOffset: number;
  endOffset: number;
  overlapWithPrevEnd: number; // character offset in source where overlap with previous chunk ends
  overlapWithNextStart: number; // character offset in source where overlap with next chunk starts
  charCount: number;
  estimatedTokens: number;
}

export interface HighlightSpan {
  start: number;
  end: number;
  text: string;
  chunkIds: number[];
  isOverlap: boolean;
}

export interface PcaPoint {
  id: number;
  label: string;
  x: number;
  y: number;
  isQuery?: boolean;
  cosineToQuery?: number;
}

export interface PcaProjectionResult {
  chunkPoints: PcaPoint[];
  queryPoint: PcaPoint | null;
  varianceExplained: [number, number];
}

export interface Bm25TermDetail {
  term: string;
  tf: number;
  df: number;
  idf: number;
  contribution: number;
}

export interface ScoredChunk {
  chunk: DocumentChunk;
  denseScore: number; // cosine similarity (-1 to 1, typically 0 to 1)
  dotProduct: number;
  normA: number;
  normB: number;
  bm25Raw: number;
  bm25Normalized: number; // 0 to 1 normalized within corpus for threshold comparability
  bm25Terms: Bm25TermDetail[];
  denseRank: number;
  bm25Rank: number;
  rrfRaw: number;
  rrfNormalized: number;
  activeScore: number; // score under currently selected searchMethod
  activeRank: number;
  passedTopK: boolean;
  passedThreshold: boolean;
  retrieved: boolean;
  // Stage 4 Reranking fields
  rerankScore?: number; // 0-10
  rerankReason?: string;
  rerankRank?: number;
  rankDelta?: number; // positive = moved up
}

export interface HydeResult {
  mode: "hyde" | "expand";
  originalQuery: string;
  rewrittenText: string;
  beforeTopIds: number[];
  afterTopIds: number[];
  afterScores: ScoredChunk[];
}

export interface PromptPayload {
  systemInstruction: string;
  contextBlock: string;
  userQueryBlock: string;
  fullUserPrompt: string;
  systemTokens: number;
  contextTokens: number;
  queryTokens: number;
  totalTokens: number;
  contextWindowLimit: number;
}

export interface FaithfulnessClaim {
  claim: string;
  status: "supported" | "partial" | "unsupported" | "refusal";
  citedChunkIds: number[];
  explanation: string;
}

export interface FaithfulnessReport {
  overallScore: number;
  verdict: "grounded" | "partially_grounded" | "hallucinated" | "safe_refusal";
  summary: string;
  claims: FaithfulnessClaim[];
}

export interface GenerationResult {
  ragAnswer: string;
  noRagAnswer: string | null;
  model: string;
  usedChunks: DocumentChunk[];
  faithfulness: FaithfulnessReport | null;
}

export interface UsageStats {
  apiCalls: number;
  cacheHits: number;
  promptTokens: number;
  outputTokens: number;
}

export interface GuidedLab {
  id: string;
  title: string;
  subtitle: string;
  datasetId: string;
  query: string;
  strategy: ChunkingStrategy;
  chunkSize: number;
  chunkOverlap: number;
  searchMethod: SearchMethod;
  topK: number;
  minThreshold: number;
  enableHyde: boolean;
  enableRerank: boolean;
  compareNoRag: boolean;
  targetStage: StageId;
  whatToWatch: string;
  nextStepHint: string;
}

export interface StageExplainer {
  stage: StageId;
  title: string;
  intuition: string;
  formulaLabel: string;
  formula: string;
  failureModes: string[];
}
