import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === "production";

const GENERATION_MODEL = "gemini-4-hydrogen";
const EMBEDDING_MODEL = "gemini-embedding-2";

// Server-side embedding cache keyed by model::taskType::text to save free-tier RPM/RPD
const MAX_CACHE_ENTRIES = 2500;
const embeddingCache = new Map<string, number[]>();

function cacheSet(key: string, vector: number[]) {
  if (embeddingCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = embeddingCache.keys().next().value;
    if (oldestKey !== undefined) {
      embeddingCache.delete(oldestKey);
    }
  }
  embeddingCache.set(key, vector);
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error(
      "GEMINI_API_KEY is not configured. Add it in Settings > Secrets, or switch to Local Demo Mode."
    ) as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function formatApiError(err: unknown): { status: number; message: string; hint: string } {
  const errorObj = err as { status?: number; code?: number; message?: string };
  const rawMessage = errorObj?.message || "Unexpected Gemini API error";
  const status = Number(errorObj?.status || errorObj?.code) || (rawMessage.includes("429") ? 429 : rawMessage.includes("403") ? 403 : rawMessage.includes("404") ? 404 : 500);

  if (status === 429 || rawMessage.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      message: "Gemini API rate limit reached (429 RESOURCE_EXHAUSTED).",
      hint: "Wait a few seconds, or toggle Local Demo Mode in the toolbar to keep experimenting with zero quota usage.",
    };
  }
  if (status === 403 || status === 400 || rawMessage.includes("API_KEY_INVALID") || rawMessage.includes("PERMISSION_DENIED")) {
    return {
      status: status === 400 ? 400 : 403,
      message: rawMessage,
      hint: "Check your Gemini API key in Settings > Secrets, or switch to Local Demo Mode.",
    };
  }
  return {
    status: status >= 400 && status < 600 ? status : 500,
    message: rawMessage,
    hint: "Try again in a moment, or switch to Local Demo Mode to continue offline.",
  };
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      if (status === 400 || status === 403 || status === 404) {
        throw err;
      }
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 450 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

const app = express();
app.use(express.json({ limit: "2mb" }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    generationModel: GENERATION_MODEL,
    embeddingModel: EMBEDDING_MODEL,
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    cachedEmbeddings: embeddingCache.size,
  });
});

// 1. Embed Chunks or Queries with Caching
app.post("/api/rag/embed", async (req, res) => {
  try {
    const body = req.body as {
      texts?: unknown;
      taskType?: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";
    };

    if (!Array.isArray(body.texts) || body.texts.length === 0) {
      res.status(400).json({ error: "texts must be a non-empty array of strings." });
      return;
    }

    const texts = body.texts
      .slice(0, 100)
      .map((item) => (typeof item === "string" ? item.slice(0, 8000) : ""));
    const taskType =
      body.taskType === "RETRIEVAL_QUERY" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT";

    const results: (number[] | null)[] = new Array(texts.length).fill(null);
    const uncachedIndices: number[] = [];
    let cacheHits = 0;

    texts.forEach((text, index) => {
      const cacheKey = `${EMBEDDING_MODEL}::${taskType}::${text}`;
      const cached = embeddingCache.get(cacheKey);
      if (cached) {
        results[index] = cached;
        cacheHits += 1;
      } else {
        uncachedIndices.push(index);
      }
    });

    let apiCalls = 0;
    let estimatedTokens = 0;

    if (uncachedIndices.length > 0) {
      const ai = getAiClient();
      const BATCH_SIZE = 16;

      for (let i = 0; i < uncachedIndices.length; i += BATCH_SIZE) {
        const batchIndices = uncachedIndices.slice(i, i + BATCH_SIZE);
        const batchTexts = batchIndices.map((idx) => texts[idx]);

        const response = await withRetry(() =>
          ai.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: batchTexts,
            config: {
              taskType,
            },
          })
        );
        apiCalls += 1;
        estimatedTokens += batchTexts.reduce((sum, t) => sum + estimateTokens(t), 0);

        const vectors = response.embeddings ?? [];
        if (vectors.length === batchIndices.length) {
          batchIndices.forEach((origIdx, j) => {
            const values = vectors[j]?.values ?? [];
            results[origIdx] = values;
            const cacheKey = `${EMBEDDING_MODEL}::${taskType}::${texts[origIdx]}`;
            if (values.length > 0) {
              cacheSet(cacheKey, values);
            }
          });
        } else {
          // Fallback to individual embedding requests if batch count mismatches
          for (const origIdx of batchIndices) {
            const singleResp = await withRetry(() =>
              ai.models.embedContent({
                model: EMBEDDING_MODEL,
                contents: texts[origIdx],
                config: { taskType },
              })
            );
            apiCalls += 1;
            const values = singleResp.embeddings?.[0]?.values ?? [];
            results[origIdx] = values;
            const cacheKey = `${EMBEDDING_MODEL}::${taskType}::${texts[origIdx]}`;
            if (values.length > 0) {
              cacheSet(cacheKey, values);
            }
          }
        }
      }
    }

    const finalEmbeddings = results.map((vec) => vec ?? []);
    const dimensions = finalEmbeddings[0]?.length ?? 0;

    res.json({
      embeddings: finalEmbeddings,
      dimensions,
      model: EMBEDDING_MODEL,
      taskType,
      cacheHits,
      apiCalls,
      estimatedTokens,
    });
  } catch (err) {
    const formatted = formatApiError(err);
    res.status(formatted.status).json({ error: formatted.message, hint: formatted.hint });
  }
});

// 2. Query Rewriting / HyDE
app.post("/api/rag/rewrite", async (req, res) => {
  try {
    const body = req.body as {
      query?: string;
      mode?: "hyde" | "expand";
      domainHint?: string;
    };

    const query = typeof body.query === "string" ? body.query.trim().slice(0, 1200) : "";
    if (!query) {
      res.status(400).json({ error: "query is required." });
      return;
    }

    const mode = body.mode === "expand" ? "expand" : "hyde";
    const domainHint =
      typeof body.domainHint === "string" ? body.domainHint.trim().slice(0, 120) : "technical or policy documentation";

    const ai = getAiClient();
    const systemInstruction =
      mode === "hyde"
        ? `You are implementing Hypothetical Document Embeddings (HyDE) for a RAG pipeline. Write a concise, realistic 2-3 sentence excerpt that looks like it comes from ${domainHint} and directly answers the user's question using rich domain terminology and synonyms. Do NOT fabricate specific error codes or policy IDs unless present in the query. Output only the hypothetical passage text.`
        : `You are a search query expansion specialist for a RAG pipeline. Rewrite the user's question into an enriched search query by adding key domain synonyms, technical equivalents, and concise related phrases. Keep it to 1-2 sentences. Output only the expanded query text.`;

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GENERATION_MODEL,
        contents: `User Query: ${query}`,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      })
    );

    const rewrittenText = (response.text ?? "").trim();
    const usage = response.usageMetadata;

    res.json({
      rewrittenText,
      mode,
      model: GENERATION_MODEL,
      usage: {
        promptTokens: usage?.promptTokenCount ?? estimateTokens(query + systemInstruction),
        outputTokens: usage?.candidatesTokenCount ?? estimateTokens(rewrittenText),
        apiCalls: 1,
      },
    });
  } catch (err) {
    const formatted = formatApiError(err);
    res.status(formatted.status).json({ error: formatted.message, hint: formatted.hint });
  }
});

// 3. LLM Reranking (0-10 relevance scoring via structured JSON)
app.post("/api/rag/rerank", async (req, res) => {
  try {
    const body = req.body as {
      query?: string;
      candidates?: { id: number; text: string }[];
    };

    const query = typeof body.query === "string" ? body.query.trim().slice(0, 1200) : "";
    const candidates = Array.isArray(body.candidates) ? body.candidates.slice(0, 12) : [];

    if (!query || candidates.length === 0) {
      res.status(400).json({ error: "query and non-empty candidates are required." });
      return;
    }

    const ai = getAiClient();
    const formattedCandidates = candidates
      .map((c) => `[Chunk ${c.id}]\n${String(c.text).slice(0, 1400)}`)
      .join("\n\n---\n\n");

    const prompt = `User Query: "${query}"\n\nScore each candidate chunk from 0.0 (completely irrelevant) to 10.0 (directly and completely answers the query). Be strict and discriminative so the most directly relevant chunks clearly outrank partially related ones.\n\nCandidate Chunks:\n${formattedCandidates}`;

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GENERATION_MODEL,
        contents: prompt,
        config: {
          systemInstruction:
            "You are a precision cross-encoder reranker for a Retrieval-Augmented Generation pipeline. Evaluate every provided candidate chunk independently against the user query and return JSON scores.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scores: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.INTEGER, description: "The Chunk ID number" },
                    score: {
                      type: Type.NUMBER,
                      description: "Relevance score from 0.0 to 10.0",
                    },
                    reason: {
                      type: Type.STRING,
                      description: "One concise sentence explaining why this chunk got this score.",
                    },
                  },
                  required: ["id", "score", "reason"],
                },
              },
            },
            required: ["scores"],
          },
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{"scores":[]}').trim()) as {
      scores?: { id: number; score: number; reason: string }[];
    };
    const usage = response.usageMetadata;

    res.json({
      scores: Array.isArray(parsed.scores) ? parsed.scores : [],
      model: GENERATION_MODEL,
      usage: {
        promptTokens: usage?.promptTokenCount ?? estimateTokens(prompt),
        outputTokens: usage?.candidatesTokenCount ?? estimateTokens(response.text ?? ""),
        apiCalls: 1,
      },
    });
  } catch (err) {
    const formatted = formatApiError(err);
    res.status(formatted.status).json({ error: formatted.message, hint: formatted.hint });
  }
});

// 4. Generation: RAG-Grounded Answer + Optional Standard LLM (No RAG) Comparison
app.post("/api/rag/generate", async (req, res) => {
  try {
    const body = req.body as {
      query?: string;
      systemPrompt?: string;
      userPrompt?: string;
      compareNoRag?: boolean;
    };

    const query = typeof body.query === "string" ? body.query.trim().slice(0, 1200) : "";
    const systemPrompt =
      typeof body.systemPrompt === "string" ? body.systemPrompt.slice(0, 4000) : "";
    const userPrompt =
      typeof body.userPrompt === "string" ? body.userPrompt.slice(0, 24000) : "";
    const compareNoRag = Boolean(body.compareNoRag);

    if (!query || !userPrompt) {
      res.status(400).json({ error: "query and userPrompt are required." });
      return;
    }

    const ai = getAiClient();

    const ragPromise = withRetry(() =>
      ai.models.generateContent({
        model: GENERATION_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      })
    );

    const noRagPromise = compareNoRag
      ? withRetry(() =>
          ai.models.generateContent({
            model: GENERATION_MODEL,
            contents: query,
            config: {
              systemInstruction:
                "You are a standard general-purpose assistant answering purely from pre-training memory. You do NOT have access to any private documents, employee handbooks, contracts, or manuals. Answer the user's question concisely in 2-4 sentences as best you can from general knowledge.",
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          })
        )
      : Promise.resolve(null);

    const [ragResp, noRagResp] = await Promise.all([ragPromise, noRagPromise]);

    const ragAnswer = (ragResp.text ?? "").trim();
    const noRagAnswer = noRagResp ? (noRagResp.text ?? "").trim() : null;

    const ragPromptTokens =
      ragResp.usageMetadata?.promptTokenCount ?? estimateTokens(systemPrompt + userPrompt);
    const ragOutputTokens =
      ragResp.usageMetadata?.candidatesTokenCount ?? estimateTokens(ragAnswer);
    const noRagPromptTokens = noRagResp
      ? noRagResp.usageMetadata?.promptTokenCount ?? estimateTokens(query)
      : 0;
    const noRagOutputTokens = noRagResp
      ? noRagResp.usageMetadata?.candidatesTokenCount ?? estimateTokens(noRagAnswer ?? "")
      : 0;

    res.json({
      ragAnswer,
      noRagAnswer,
      model: GENERATION_MODEL,
      usage: {
        promptTokens: ragPromptTokens + noRagPromptTokens,
        outputTokens: ragOutputTokens + noRagOutputTokens,
        apiCalls: compareNoRag ? 2 : 1,
      },
    });
  } catch (err) {
    const formatted = formatApiError(err);
    res.status(formatted.status).json({ error: formatted.message, hint: formatted.hint });
  }
});

// 5. Grounding / Faithfulness Audit
app.post("/api/rag/faithfulness", async (req, res) => {
  try {
    const body = req.body as {
      query?: string;
      answer?: string;
      chunks?: { id: number; text: string }[];
    };

    const query = typeof body.query === "string" ? body.query.trim().slice(0, 1200) : "";
    const answer = typeof body.answer === "string" ? body.answer.trim().slice(0, 6000) : "";
    const chunks = Array.isArray(body.chunks) ? body.chunks.slice(0, 10) : [];

    if (!answer) {
      res.status(400).json({ error: "answer is required." });
      return;
    }

    const ai = getAiClient();
    const contextText =
      chunks.length > 0
        ? chunks.map((c) => `[Chunk ${c.id}]\n${String(c.text).slice(0, 1400)}`).join("\n\n")
        : "(No retrieved chunks were provided.)";

    const auditPrompt = `User Query: ${query}\n\nRetrieved Context:\n${contextText}\n\nRAG Answer to Audit:\n${answer}\n\nBreak the RAG Answer into 1 to 5 atomic claims and check whether each claim is strictly supported by the Retrieved Context. If the answer properly refuses to answer because the context lacks the information, mark the verdict as "safe_refusal" with a high faithfulness score (95-100).`;

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GENERATION_MODEL,
        contents: auditPrompt,
        config: {
          systemInstruction:
            "You are a strict RAG Faithfulness & Grounding Auditor. Verify every factual claim strictly against the retrieved chunks—never use outside world knowledge to excuse unsupported claims.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallScore: {
                type: Type.INTEGER,
                description: "Faithfulness percentage score from 0 to 100",
              },
              verdict: {
                type: Type.STRING,
                description: "One of: grounded, partially_grounded, hallucinated, safe_refusal",
              },
              summary: {
                type: Type.STRING,
                description: "Concise 1-2 sentence explanation of grounding quality.",
              },
              claims: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    claim: { type: Type.STRING },
                    status: {
                      type: Type.STRING,
                      description: "One of: supported, partial, unsupported, refusal",
                    },
                    citedChunkIds: {
                      type: Type.ARRAY,
                      items: { type: Type.INTEGER },
                    },
                    explanation: { type: Type.STRING },
                  },
                  required: ["claim", "status", "citedChunkIds", "explanation"],
                },
              },
            },
            required: ["overallScore", "verdict", "summary", "claims"],
          },
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? "{}").trim());
    const usage = response.usageMetadata;

    res.json({
      overallScore: typeof parsed.overallScore === "number" ? parsed.overallScore : 0,
      verdict: parsed.verdict ?? "partially_grounded",
      summary: parsed.summary ?? "Faithfulness evaluation complete.",
      claims: Array.isArray(parsed.claims) ? parsed.claims : [],
      model: GENERATION_MODEL,
      usage: {
        promptTokens: usage?.promptTokenCount ?? estimateTokens(auditPrompt),
        outputTokens: usage?.candidatesTokenCount ?? estimateTokens(response.text ?? ""),
        apiCalls: 1,
      },
    });
  } catch (err) {
    const formatted = formatApiError(err);
    res.status(formatted.status).json({ error: formatted.message, hint: formatted.hint });
  }
});

async function startServer() {
  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("/{*splat}", (_req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Build not found. Run npm run build first.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`RAG Glass Box server listening on http://localhost:${PORT}`);
  });
}

startServer();
