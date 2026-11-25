import type {
  DocumentChunk,
  ExecutionMode,
  FaithfulnessReport,
  PromptPayload,
} from "../types/rag";
import { estimateTokens } from "./chunking";
import {
  embedBatchLocal,
  evaluateFaithfulnessLocal,
  generateAnswerLocal,
  rerankCandidatesLocal,
  rewriteQueryLocal,
} from "./localDemo";

export class RagApiError extends Error {
  status: number;
  hint: string;

  constructor(message: string, status: number, hint: string) {
    super(message);
    this.name = "RagApiError";
    this.status = status;
    this.hint = hint;
  }
}

export const SYSTEM_GROUNDING_INSTRUCTION = `You are a strictly grounded Retrieval-Augmented Generation (RAG) assistant.
Rules:
1. Answer the user's question using ONLY the facts explicitly stated inside the provided [Chunk #] context blocks below.
2. Cite your sources inline immediately after every factual claim using exact brackets like [Chunk 1] or [Chunk 3].
3. NEVER use outside pre-training memory or guess missing figures, dates, or policies.
4. If the provided context does not contain enough information to answer the question, reply clearly: "I cannot answer this question based on the provided document context." and briefly explain what is missing.`;

export function buildPromptPayload(
  query: string,
  retrievedChunks: DocumentChunk[]
): PromptPayload {
  const contextBlock =
    retrievedChunks.length > 0
      ? retrievedChunks
          .map((c) => `[Chunk ${c.id}]\n${c.text}`)
          .join("\n\n")
      : "[No chunks passed the retrieval Top-K and similarity threshold filters.]";

  const userQueryBlock = `Question: ${query || "(Enter a question above)"}`;
  const fullUserPrompt = `### RETRIEVED CONTEXT\n${contextBlock}\n\n### USER QUESTION\n${userQueryBlock}\n\nAnswer concisely with inline [Chunk #] citations:`;

  const systemTokens = estimateTokens(SYSTEM_GROUNDING_INSTRUCTION);
  const contextTokens = estimateTokens(contextBlock);
  const queryTokens = estimateTokens(userQueryBlock);

  return {
    systemInstruction: SYSTEM_GROUNDING_INSTRUCTION,
    contextBlock,
    userQueryBlock,
    fullUserPrompt,
    systemTokens,
    contextTokens,
    queryTokens,
    totalTokens: systemTokens + contextTokens + queryTokens,
    contextWindowLimit: 32768,
  };
}

// Client-side embedding cache keyed by mode::taskType::text so unchanged chunks are never re-embedded
const clientEmbeddingCache = new Map<string, number[]>();

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    hint?: string;
  };

  if (!res.ok) {
    throw new RagApiError(
      data.error || `Server returned HTTP ${res.status}`,
      res.status,
      data.hint || "Check server logs or switch to Local Demo Mode to continue experimenting."
    );
  }

  return data as T;
}

export async function embedTexts(params: {
  texts: string[];
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";
  mode: ExecutionMode;
}): Promise<{
  embeddings: number[][];
  dimensions: number;
  model: string;
  cacheHits: number;
  apiCalls: number;
  promptTokens: number;
}> {
  const { texts, taskType, mode } = params;
  if (texts.length === 0) {
    return {
      embeddings: [],
      dimensions: 0,
      model: mode === "live" ? "gemini-embedding-2" : "local-tfidf-64d",
      cacheHits: 0,
      apiCalls: 0,
      promptTokens: 0,
    };
  }

  const results: (number[] | null)[] = new Array(texts.length).fill(null);
  const missingIndices: number[] = [];
  let clientHits = 0;

  texts.forEach((text, i) => {
    const key = `${mode}::${taskType}::${text}`;
    const cached = clientEmbeddingCache.get(key);
    if (cached) {
      results[i] = cached;
      clientHits += 1;
    } else {
      missingIndices.push(i);
    }
  });

  let apiCalls = 0;
  let serverHits = 0;
  let promptTokens = 0;
  let model = mode === "live" ? "gemini-embedding-2" : "local-tfidf-64d";

  if (missingIndices.length > 0) {
    const missingTexts = missingIndices.map((idx) => texts[idx]);

    if (mode === "demo") {
      const localVectors = embedBatchLocal(missingTexts);
      missingIndices.forEach((origIdx, j) => {
        results[origIdx] = localVectors[j];
        clientEmbeddingCache.set(`${mode}::${taskType}::${texts[origIdx]}`, localVectors[j]);
      });
    } else {
      const resp = await postJson<{
        embeddings: number[][];
        dimensions: number;
        model: string;
        cacheHits: number;
        apiCalls: number;
        estimatedTokens: number;
      }>("/api/rag/embed", {
        texts: missingTexts,
        taskType,
      });

      model = resp.model;
      apiCalls += resp.apiCalls;
      serverHits += resp.cacheHits;
      promptTokens += resp.estimatedTokens;

      missingIndices.forEach((origIdx, j) => {
        const vec = resp.embeddings[j] ?? [];
        results[origIdx] = vec;
        if (vec.length > 0) {
          clientEmbeddingCache.set(`${mode}::${taskType}::${texts[origIdx]}`, vec);
        }
      });
    }
  }

  const finalVectors = results.map((v) => v ?? []);
  return {
    embeddings: finalVectors,
    dimensions: finalVectors[0]?.length ?? 0,
    model,
    cacheHits: clientHits + serverHits,
    apiCalls,
    promptTokens,
  };
}

export async function rewriteQuery(params: {
  query: string;
  mode: ExecutionMode;
  rewriteType: "hyde" | "expand";
  domainHint?: string;
}): Promise<{
  rewrittenText: string;
  model: string;
  apiCalls: number;
  promptTokens: number;
  outputTokens: number;
}> {
  if (params.mode === "demo") {
    return {
      rewrittenText: rewriteQueryLocal(params.query, params.rewriteType),
      model: "local-demo-synthesizer",
      apiCalls: 0,
      promptTokens: 0,
      outputTokens: 0,
    };
  }

  const resp = await postJson<{
    rewrittenText: string;
    model: string;
    usage: { promptTokens: number; outputTokens: number; apiCalls: number };
  }>("/api/rag/rewrite", {
    query: params.query,
    mode: params.rewriteType,
    domainHint: params.domainHint,
  });

  return {
    rewrittenText: resp.rewrittenText,
    model: resp.model,
    apiCalls: resp.usage.apiCalls,
    promptTokens: resp.usage.promptTokens,
    outputTokens: resp.usage.outputTokens,
  };
}

export async function rerankCandidates(params: {
  query: string;
  candidates: { id: number; text: string }[];
  mode: ExecutionMode;
}): Promise<{
  scores: { id: number; score: number; reason: string }[];
  model: string;
  apiCalls: number;
  promptTokens: number;
  outputTokens: number;
}> {
  if (params.mode === "demo") {
    return {
      scores: rerankCandidatesLocal(params.query, params.candidates),
      model: "local-demo-cross-scorer",
      apiCalls: 0,
      promptTokens: 0,
      outputTokens: 0,
    };
  }

  const resp = await postJson<{
    scores: { id: number; score: number; reason: string }[];
    model: string;
    usage: { promptTokens: number; outputTokens: number; apiCalls: number };
  }>("/api/rag/rerank", {
    query: params.query,
    candidates: params.candidates,
  });

  return {
    scores: resp.scores,
    model: resp.model,
    apiCalls: resp.usage.apiCalls,
    promptTokens: resp.usage.promptTokens,
    outputTokens: resp.usage.outputTokens,
  };
}

export async function generateComparison(params: {
  query: string;
  prompt: PromptPayload;
  retrievedChunks: DocumentChunk[];
  compareNoRag: boolean;
  mode: ExecutionMode;
}): Promise<{
  ragAnswer: string;
  noRagAnswer: string | null;
  model: string;
  apiCalls: number;
  promptTokens: number;
  outputTokens: number;
}> {
  if (params.mode === "demo") {
    const local = generateAnswerLocal(
      params.query,
      params.retrievedChunks,
      params.compareNoRag
    );
    return {
      ...local,
      model: "local-demo-synthesizer",
      apiCalls: 0,
      promptTokens: 0,
      outputTokens: 0,
    };
  }

  const resp = await postJson<{
    ragAnswer: string;
    noRagAnswer: string | null;
    model: string;
    usage: { promptTokens: number; outputTokens: number; apiCalls: number };
  }>("/api/rag/generate", {
    query: params.query,
    systemPrompt: params.prompt.systemInstruction,
    userPrompt: params.prompt.fullUserPrompt,
    compareNoRag: params.compareNoRag,
  });

  return {
    ragAnswer: resp.ragAnswer,
    noRagAnswer: resp.noRagAnswer,
    model: resp.model,
    apiCalls: resp.usage.apiCalls,
    promptTokens: resp.usage.promptTokens,
    outputTokens: resp.usage.outputTokens,
  };
}

export async function auditFaithfulness(params: {
  query: string;
  answer: string;
  chunks: DocumentChunk[];
  mode: ExecutionMode;
}): Promise<{
  report: FaithfulnessReport;
  apiCalls: number;
  promptTokens: number;
  outputTokens: number;
}> {
  if (params.mode === "demo") {
    return {
      report: evaluateFaithfulnessLocal(params.answer, params.chunks),
      apiCalls: 0,
      promptTokens: 0,
      outputTokens: 0,
    };
  }

  const resp = await postJson<
    FaithfulnessReport & {
      usage: { promptTokens: number; outputTokens: number; apiCalls: number };
    }
  >("/api/rag/faithfulness", {
    query: params.query,
    answer: params.answer,
    chunks: params.chunks.map((c) => ({ id: c.id, text: c.text })),
  });

  return {
    report: {
      overallScore: resp.overallScore,
      verdict: resp.verdict,
      summary: resp.summary,
      claims: resp.claims,
    },
    apiCalls: resp.usage.apiCalls,
    promptTokens: resp.usage.promptTokens,
    outputTokens: resp.usage.outputTokens,
  };
}
