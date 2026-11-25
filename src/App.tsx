import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  FlaskConical,
  Play,
  Search,
  Sparkles,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { GUIDED_LABS, SAMPLE_DATASETS, STAGE_EXPLAINERS } from "./data/datasets";
import { chunkDocument } from "./lib/chunking";
import { scoreChunks } from "./lib/retrieval";
import {
  auditFaithfulness,
  buildPromptPayload,
  embedTexts,
  generateComparison,
  RagApiError,
  rerankCandidates,
  rewriteQuery,
} from "./lib/ragService";
import type {
  ChunkingStrategy,
  DocumentChunk,
  ExecutionMode,
  GenerationResult,
  GuidedLab,
  HydeResult,
  ScoredChunk,
  SearchMethod,
  StageId,
  UsageStats,
} from "./types/rag";
import { TopBar } from "./components/TopBar";
import { UnderTheHoodCard } from "./components/UnderTheHoodCard";
import { Stage1Chunking } from "./components/Stage1Chunking";
import { Stage2Embeddings } from "./components/Stage2Embeddings";
import { Stage3Retrieval } from "./components/Stage3Retrieval";
import { Stage4Advanced } from "./components/Stage4Advanced";
import { Stage5Prompt } from "./components/Stage5Prompt";
import { Stage6Generation } from "./components/Stage6Generation";

const STAGES: { id: StageId; short: string; label: string }[] = [
  { id: 1, short: "1. Chunking", label: "Ingestion & Chunking" },
  { id: 2, short: "2. Embeddings", label: "Embeddings & Vector Map" },
  { id: 3, short: "3. Retrieval", label: "Retrieval & Scoring" },
  { id: 4, short: "4. Advanced", label: "HyDE & Reranking" },
  { id: 5, short: "5. Prompt", label: "Prompt Inspector" },
  { id: 6, short: "6. Generation", label: "Generation & Citations" },
];

export default function App() {
  // Theme (Light lab default per Phase 1 choice)
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Execution Mode (Live Gemini API default per Phase 1 choice)
  const [mode, setMode] = useState<ExecutionMode>("live");

  // Active Stepper Stage
  const [activeStage, setActiveStage] = useState<StageId>(1);

  // Dataset & Query State
  const [activeDatasetId, setActiveDatasetId] = useState<string>(SAMPLE_DATASETS[0].id);
  const [customDocTitle, setCustomDocTitle] = useState<string>("Custom Knowledge Base");
  const [customDocContent, setCustomDocContent] = useState<string>("");
  const [queryText, setQueryText] = useState<string>(SAMPLE_DATASETS[0].defaultQuery);
  const [showQuerySuggestions, setShowQuerySuggestions] = useState(false);

  // Guided Lab Banner State
  const [activeLab, setActiveLab] = useState<GuidedLab | null>(null);

  // Stage 1: Chunking Controls
  const [strategy, setStrategy] = useState<ChunkingStrategy>("recursive");
  const [chunkSize, setChunkSize] = useState<number>(460);
  const [chunkOverlap, setChunkOverlap] = useState<number>(70);

  // Stage 2: Embeddings State
  const [chunkEmbeddings, setChunkEmbeddings] = useState<Record<number, number[]>>({});
  const [queryEmbedding, setQueryEmbedding] = useState<number[] | null>(null);
  const [embeddingModel, setEmbeddingModel] = useState<string>("gemini-embedding-2");
  const [lastEmbedCacheHits, setLastEmbedCacheHits] = useState<number>(0);
  const [isEmbedding, setIsEmbedding] = useState<boolean>(false);

  // Stage 3: Retrieval Controls
  const [searchMethod, setSearchMethod] = useState<SearchMethod>("hybrid");
  const [topK, setTopK] = useState<number>(3);
  const [minThreshold, setMinThreshold] = useState<number>(0.15);

  // Stage 4: Advanced RAG State
  const [enableHyde, setEnableHyde] = useState<boolean>(false);
  const [hydeMode, setHydeMode] = useState<"hyde" | "expand">("hyde");
  const [hydeResult, setHydeResult] = useState<HydeResult | null>(null);
  const [isRunningHyde, setIsRunningHyde] = useState<boolean>(false);

  const [enableRerank, setEnableRerank] = useState<boolean>(false);
  const [rerankedChunks, setRerankedChunks] = useState<ScoredChunk[] | null>(null);
  const [isRunningRerank, setIsRunningRerank] = useState<boolean>(false);

  // Stage 6: Generation & Comparison State
  const [compareNoRag, setCompareNoRag] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);

  // Global Pipeline Status, Errors, Usage Stats
  const [isRunningAll, setIsRunningAll] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<{ message: string; hint: string } | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats>({
    apiCalls: 0,
    cacheHits: 0,
    promptTokens: 0,
    outputTokens: 0,
  });

  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Sync Tailwind v4 .dark class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowQuerySuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const currentDataset = useMemo(
    () => SAMPLE_DATASETS.find((d) => d.id === activeDatasetId) ?? null,
    [activeDatasetId]
  );

  const sourceText =
    activeDatasetId === "custom" ? customDocContent : currentDataset?.content ?? "";
  const datasetTitle =
    activeDatasetId === "custom" ? customDocTitle : currentDataset?.title ?? "Document";

  // Synchronously compute chunks whenever sourceText or chunking sliders change
  const chunks: DocumentChunk[] = useMemo(
    () => chunkDocument(sourceText, strategy, chunkSize, chunkOverlap),
    [sourceText, strategy, chunkSize, chunkOverlap]
  );

  // Track a signature of the current chunk texts so stale embeddings are cleared cleanly
  const chunksSignature = useMemo(
    () => chunks.map((c) => `${c.id}:${c.text.length}:${c.startOffset}`).join("|"),
    [chunks]
  );

  const prevChunksSigRef = useRef(chunksSignature);
  useEffect(() => {
    if (prevChunksSigRef.current !== chunksSignature) {
      prevChunksSigRef.current = chunksSignature;
      setChunkEmbeddings({});
      setHydeResult(null);
      setRerankedChunks(null);
      setGenerationResult(null);
    }
  }, [chunksSignature]);

  const addUsage = (delta: Partial<UsageStats>) => {
    setUsageStats((prev) => ({
      apiCalls: prev.apiCalls + (delta.apiCalls ?? 0),
      cacheHits: prev.cacheHits + (delta.cacheHits ?? 0),
      promptTokens: prev.promptTokens + (delta.promptTokens ?? 0),
      outputTokens: prev.outputTokens + (delta.outputTokens ?? 0),
    }));
  };

  const handleApiError = (err: unknown) => {
    if (err instanceof RagApiError) {
      setErrorBanner({ message: err.message, hint: err.hint });
    } else if (err instanceof Error) {
      setErrorBanner({
        message: err.message,
        hint: "Try again or toggle Local Demo Mode in the toolbar to keep experimenting offline.",
      });
    } else {
      setErrorBanner({
        message: "An unexpected error occurred while running the pipeline.",
        hint: "Switch to Local Demo Mode to continue offline.",
      });
    }
  };

  // Base Stage 3 Retrieval Scoring (always reactive to sliders & search method)
  const baseScoredChunks: ScoredChunk[] = useMemo(
    () =>
      scoreChunks({
        chunks,
        chunkEmbeddings,
        queryText,
        queryEmbedding,
        searchMethod,
        topK,
        minThreshold,
      }),
    [chunks, chunkEmbeddings, queryText, queryEmbedding, searchMethod, topK, minThreshold]
  );

  // Effective retrieved chunks flowing into Stage 5 & 6 (respecting Stage 4 HyDE & Reranking)
  const effectiveScoredChunks: ScoredChunk[] = useMemo(() => {
    if (enableHyde && hydeResult && hydeResult.afterScores.length === chunks.length) {
      return hydeResult.afterScores;
    }
    return baseScoredChunks;
  }, [enableHyde, hydeResult, chunks.length, baseScoredChunks]);

  const retrievedScoredChunks: ScoredChunk[] = useMemo(() => {
    if (enableRerank && rerankedChunks && rerankedChunks.length > 0) {
      return rerankedChunks;
    }
    return effectiveScoredChunks.filter((s) => s.retrieved);
  }, [enableRerank, rerankedChunks, effectiveScoredChunks]);

  const retrievedDocChunks: DocumentChunk[] = useMemo(
    () => retrievedScoredChunks.map((s) => s.chunk),
    [retrievedScoredChunks]
  );

  // Stage 5 exact prompt payload
  const promptPayload = useMemo(
    () => buildPromptPayload(queryText, retrievedDocChunks),
    [queryText, retrievedDocChunks]
  );

  const hasEmbeddings =
    chunks.length > 0 && chunks.every((c) => (chunkEmbeddings[c.id]?.length ?? 0) > 0);

  // Core reusable embed routine
  const executeEmbed = async (opts?: {
    targetChunks?: DocumentChunk[];
    targetQuery?: string;
    targetMode?: ExecutionMode;
  }) => {
    const useChunks = opts?.targetChunks ?? chunks;
    const useQuery = opts?.targetQuery ?? queryText;
    const useMode = opts?.targetMode ?? mode;

    if (useChunks.length === 0) return null;
    setIsEmbedding(true);
    setErrorBanner(null);

    try {
      const docResp = await embedTexts({
        texts: useChunks.map((c) => c.text),
        taskType: "RETRIEVAL_DOCUMENT",
        mode: useMode,
      });

      const nextMap: Record<number, number[]> = {};
      useChunks.forEach((c, idx) => {
        nextMap[c.id] = docResp.embeddings[idx] ?? [];
      });

      let qVec: number[] | null = null;
      let qCacheHits = 0;
      let qApiCalls = 0;
      let qTokens = 0;

      if (useQuery.trim()) {
        const qResp = await embedTexts({
          texts: [useQuery.trim()],
          taskType: "RETRIEVAL_QUERY",
          mode: useMode,
        });
        qVec = qResp.embeddings[0] ?? null;
        qCacheHits = qResp.cacheHits;
        qApiCalls = qResp.apiCalls;
        qTokens = qResp.promptTokens;
      }

      setChunkEmbeddings(nextMap);
      setQueryEmbedding(qVec);
      setEmbeddingModel(docResp.model);
      setLastEmbedCacheHits(docResp.cacheHits + qCacheHits);

      addUsage({
        apiCalls: docResp.apiCalls + qApiCalls,
        cacheHits: docResp.cacheHits + qCacheHits,
        promptTokens: docResp.promptTokens + qTokens,
      });

      return { chunkEmbeddings: nextMap, queryEmbedding: qVec };
    } catch (err) {
      handleApiError(err);
      return null;
    } finally {
      setIsEmbedding(false);
    }
  };

  // Stage 4: Run HyDE / Query Expansion
  const executeHyde = async (opts?: {
    currentChunkEmbeddings?: Record<number, number[]>;
    currentBaseScores?: ScoredChunk[];
    targetMode?: ExecutionMode;
  }) => {
    const useMode = opts?.targetMode ?? mode;
    if (!queryText.trim()) return null;

    setIsRunningHyde(true);
    setErrorBanner(null);
    try {
      let cEmbeddings = opts?.currentChunkEmbeddings ?? chunkEmbeddings;
      let qEmb = queryEmbedding;

      if (!chunks.every((c) => (cEmbeddings[c.id]?.length ?? 0) > 0)) {
        const embedded = await executeEmbed({ targetMode: useMode });
        if (!embedded) return null;
        cEmbeddings = embedded.chunkEmbeddings;
        qEmb = embedded.queryEmbedding;
      }

      const beforeScores =
        opts?.currentBaseScores ??
        scoreChunks({
          chunks,
          chunkEmbeddings: cEmbeddings,
          queryText,
          queryEmbedding: qEmb,
          searchMethod,
          topK,
          minThreshold,
        });

      const rewriteResp = await rewriteQuery({
        query: queryText,
        mode: useMode,
        rewriteType: hydeMode,
        domainHint: datasetTitle,
      });

      addUsage({
        apiCalls: rewriteResp.apiCalls,
        promptTokens: rewriteResp.promptTokens,
        outputTokens: rewriteResp.outputTokens,
      });

      const rewrittenEmbedResp = await embedTexts({
        texts: [rewriteResp.rewrittenText],
        taskType: "RETRIEVAL_QUERY",
        mode: useMode,
      });

      addUsage({
        apiCalls: rewrittenEmbedResp.apiCalls,
        cacheHits: rewrittenEmbedResp.cacheHits,
        promptTokens: rewrittenEmbedResp.promptTokens,
      });

      const rewrittenVec = rewrittenEmbedResp.embeddings[0] ?? null;
      const afterScores = scoreChunks({
        chunks,
        chunkEmbeddings: cEmbeddings,
        queryText: rewriteResp.rewrittenText,
        queryEmbedding: rewrittenVec,
        searchMethod,
        topK,
        minThreshold,
      });

      const result: HydeResult = {
        mode: hydeMode,
        originalQuery: queryText,
        rewrittenText: rewriteResp.rewrittenText,
        beforeTopIds: beforeScores.filter((s) => s.retrieved).map((s) => s.chunk.id),
        afterTopIds: afterScores.filter((s) => s.retrieved).map((s) => s.chunk.id),
        afterScores,
      };

      setHydeResult(result);
      setRerankedChunks(null);
      return result;
    } catch (err) {
      handleApiError(err);
      return null;
    } finally {
      setIsRunningHyde(false);
    }
  };

  // Stage 4: Run LLM Reranker
  const executeRerank = async (opts?: {
    sourceCandidates?: ScoredChunk[];
    targetMode?: ExecutionMode;
  }) => {
    const useMode = opts?.targetMode ?? mode;
    const candidates =
      opts?.sourceCandidates ?? effectiveScoredChunks.filter((s) => s.retrieved);

    if (candidates.length === 0) return null;

    setIsRunningRerank(true);
    setErrorBanner(null);
    try {
      const resp = await rerankCandidates({
        query: queryText,
        candidates: candidates.map((c) => ({ id: c.chunk.id, text: c.chunk.text })),
        mode: useMode,
      });

      addUsage({
        apiCalls: resp.apiCalls,
        promptTokens: resp.promptTokens,
        outputTokens: resp.outputTokens,
      });

      const scoreLookup = new Map(resp.scores.map((s) => [s.id, s]));
      const merged = candidates.map((item) => {
        const rr = scoreLookup.get(item.chunk.id);
        return {
          ...item,
          rerankScore: rr?.score ?? Number((item.activeScore * 10).toFixed(1)),
          rerankReason: rr?.reason ?? "Scored relative to retrieved set.",
        };
      });

      merged.sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0));

      const finalReranked = merged.map((item, idx) => {
        const newRank = idx + 1;
        return {
          ...item,
          rerankRank: newRank,
          rankDelta: item.activeRank - newRank,
        };
      });

      setRerankedChunks(finalReranked);
      return finalReranked;
    } catch (err) {
      handleApiError(err);
      return null;
    } finally {
      setIsRunningRerank(false);
    }
  };

  // Stage 6: Generate & Faithfulness Audit
  const executeGenerate = async (opts?: {
    overrideChunks?: DocumentChunk[];
    targetCompareNoRag?: boolean;
    targetMode?: ExecutionMode;
  }) => {
    const useMode = opts?.targetMode ?? mode;
    const useChunks = opts?.overrideChunks ?? retrievedDocChunks;
    const useCompare = opts?.targetCompareNoRag ?? compareNoRag;
    const payload = buildPromptPayload(queryText, useChunks);

    setIsGenerating(true);
    setErrorBanner(null);
    try {
      const genResp = await generateComparison({
        query: queryText,
        prompt: payload,
        retrievedChunks: useChunks,
        compareNoRag: useCompare,
        mode: useMode,
      });

      addUsage({
        apiCalls: genResp.apiCalls,
        promptTokens: genResp.promptTokens,
        outputTokens: genResp.outputTokens,
      });

      // Immediately show generated answers while faithfulness audits
      setGenerationResult({
        ragAnswer: genResp.ragAnswer,
        noRagAnswer: genResp.noRagAnswer,
        model: genResp.model,
        usedChunks: useChunks,
        faithfulness: null,
      });

      const auditResp = await auditFaithfulness({
        query: queryText,
        answer: genResp.ragAnswer,
        chunks: useChunks,
        mode: useMode,
      });

      addUsage({
        apiCalls: auditResp.apiCalls,
        promptTokens: auditResp.promptTokens,
        outputTokens: auditResp.outputTokens,
      });

      setGenerationResult({
        ragAnswer: genResp.ragAnswer,
        noRagAnswer: genResp.noRagAnswer,
        model: genResp.model,
        usedChunks: useChunks,
        faithfulness: auditResp.report,
      });
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsGenerating(false);
    }
  };

  // End-to-End Full Pipeline Runner
  const handleRunFullPipeline = async () => {
    if (!sourceText.trim() || !queryText.trim()) return;
    setIsRunningAll(true);
    setErrorBanner(null);

    try {
      // 1 & 2. Embed chunks + query
      const embedded = await executeEmbed();
      if (!embedded) return;

      // 3. Compute initial retrieval scores
      let activeScores = scoreChunks({
        chunks,
        chunkEmbeddings: embedded.chunkEmbeddings,
        queryText,
        queryEmbedding: embedded.queryEmbedding,
        searchMethod,
        topK,
        minThreshold,
      });

      // 4a. Optional HyDE
      if (enableHyde) {
        const hyde = await executeHyde({
          currentChunkEmbeddings: embedded.chunkEmbeddings,
          currentBaseScores: activeScores,
        });
        if (hyde) {
          activeScores = hyde.afterScores;
        }
      }

      let winningScored = activeScores.filter((s) => s.retrieved);

      // 4b. Optional Rerank
      if (enableRerank && winningScored.length > 0) {
        const reranked = await executeRerank({ sourceCandidates: winningScored });
        if (reranked) {
          winningScored = reranked;
        }
      }

      const winningChunks = winningScored.map((s) => s.chunk);

      // 5 & 6. Jump to Stage 6 and generate + audit
      setActiveStage(6);
      await executeGenerate({ overrideChunks: winningChunks });
    } finally {
      setIsRunningAll(false);
    }
  };

  // Switch Dataset
  const handleSelectDataset = (datasetId: string) => {
    const ds = SAMPLE_DATASETS.find((d) => d.id === datasetId);
    if (!ds) return;
    setActiveDatasetId(ds.id);
    setQueryText(ds.defaultQuery);
    setActiveLab(null);
    setChunkEmbeddings({});
    setQueryEmbedding(null);
    setHydeResult(null);
    setRerankedChunks(null);
    setGenerationResult(null);
    setErrorBanner(null);
  };

  // Save Custom Document
  const handleSaveCustomDocument = (title: string, content: string) => {
    setCustomDocTitle(title);
    setCustomDocContent(content);
    setActiveDatasetId("custom");
    setActiveLab(null);
    setQueryText("Summarize the main rules, key figures, or exceptions in this document.");
    setChunkEmbeddings({});
    setQueryEmbedding(null);
    setHydeResult(null);
    setRerankedChunks(null);
    setGenerationResult(null);
    setErrorBanner(null);
    setActiveStage(1);
  };

  // Load Guided "Break RAG on Purpose" Lab
  const handleSelectGuidedLab = async (lab: GuidedLab) => {
    const ds = SAMPLE_DATASETS.find((d) => d.id === lab.datasetId);
    if (!ds) return;

    setActiveLab(lab);
    setActiveDatasetId(lab.datasetId);
    setQueryText(lab.query);
    setStrategy(lab.strategy);
    setChunkSize(lab.chunkSize);
    setChunkOverlap(lab.chunkOverlap);
    setSearchMethod(lab.searchMethod);
    setTopK(lab.topK);
    setMinThreshold(lab.minThreshold);
    setEnableHyde(lab.enableHyde);
    setEnableRerank(lab.enableRerank);
    setCompareNoRag(lab.compareNoRag);
    setHydeResult(null);
    setRerankedChunks(null);
    setGenerationResult(null);
    setErrorBanner(null);
    setActiveStage(lab.targetStage);

    // Pre-compute chunks for the newly selected dataset so we can auto-embed immediately for Labs 1 & 2
    if (lab.targetStage === 3) {
      const labChunks = chunkDocument(ds.content, lab.strategy, lab.chunkSize, lab.chunkOverlap);
      prevChunksSigRef.current = labChunks
        .map((c) => `${c.id}:${c.text.length}:${c.startOffset}`)
        .join("|");
      await executeEmbed({ targetChunks: labChunks, targetQuery: lab.query });
    }
  };

  // Switch Execution Mode cleanly
  const handleModeChange = (nextMode: ExecutionMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setChunkEmbeddings({});
    setQueryEmbedding(null);
    setHydeResult(null);
    setRerankedChunks(null);
    setGenerationResult(null);
    setErrorBanner(null);
    setEmbeddingModel(nextMode === "live" ? "gemini-embedding-2" : "local-tfidf-64d");
  };

  // Stage completion indicators for the stepper
  const stageDone: Record<StageId, boolean> = {
    1: chunks.length > 0,
    2: hasEmbeddings,
    3: hasEmbeddings || searchMethod === "bm25",
    4: Boolean(hydeResult || rerankedChunks),
    5: retrievedDocChunks.length > 0 || Boolean(generationResult),
    6: Boolean(generationResult),
  };

  const totalTokensUsed = usageStats.promptTokens + usageStats.outputTokens;
  const activeExplainer = STAGE_EXPLAINERS[activeStage];

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#0B1120] text-[#0F172A] dark:text-[#F1F5F9] transition-colors">
      {/* 1. Three-Zone Top Bar */}
      <TopBar
        datasets={SAMPLE_DATASETS}
        activeDatasetId={activeDatasetId}
        customDocTitle={customDocTitle}
        guidedLabs={GUIDED_LABS}
        activeLabId={activeLab?.id ?? null}
        theme={theme}
        isRunningAll={isRunningAll}
        onSelectDataset={handleSelectDataset}
        onSaveCustomDocument={handleSaveCustomDocument}
        onSelectGuidedLab={handleSelectGuidedLab}
        onToggleTheme={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
        onRunFullPipeline={handleRunFullPipeline}
      />

      {/* 2. Workspace Control Bar: Mode Toggle + Query Input + Unboxed API & Token Counters */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Live Gemini vs Local Demo Mode Segmented Switch */}
          <div
            className="inline-flex p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 self-start lg:self-auto shrink-0"
            role="radiogroup"
            aria-label="Execution Mode"
          >
            <button
              type="button"
              onClick={() => handleModeChange("live")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                mode === "live"
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Live Gemini API</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("demo")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                mode === "demo"
                  ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span>Local Demo Mode</span>
            </button>
          </div>

          {/* Active Query Input + Suggested Questions */}
          <div ref={suggestionsRef} className="relative flex-1 min-w-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setShowQuerySuggestions(false);
                handleRunFullPipeline();
              }}
              className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 overflow-hidden"
            >
              <Search className="w-4 h-4 text-slate-400 ml-3 shrink-0" />
              <input
                type="text"
                value={queryText}
                onChange={(e) => {
                  setQueryText(e.target.value);
                  setQueryEmbedding(null);
                  setHydeResult(null);
                  setRerankedChunks(null);
                }}
                placeholder="Ask a question about the loaded document…"
                aria-label="User Query"
                className="w-full px-2.5 py-2 text-sm bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
              />
              {currentDataset && currentDataset.suggestedQueries.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowQuerySuggestions((prev) => !prev)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 mr-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
                  aria-label="Sample queries"
                >
                  <span>Samples</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

            {showQuerySuggestions && currentDataset && (
              <div className="absolute left-0 right-0 mt-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] shadow-lg p-1.5 z-30">
                <div className="px-2.5 py-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  Suggested questions for {currentDataset.shortLabel}
                </div>
                {currentDataset.suggestedQueries.map((sq, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setQueryText(sq);
                      setQueryEmbedding(null);
                      setHydeResult(null);
                      setRerankedChunks(null);
                      setGenerationResult(null);
                      setShowQuerySuggestions(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    {sq}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Live API Calls & Token Usage Readout (Zero-Pill Unboxed Tabular Text) */}
          <div
            className="flex items-center gap-2.5 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 shrink-0 whitespace-nowrap"
            aria-label="API calls and token usage"
          >
            <span>
              API <strong className="text-slate-900 dark:text-slate-100">{usageStats.apiCalls}</strong>
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
            <span>
              Cache <strong className="text-emerald-700 dark:text-emerald-400">{usageStats.cacheHits}</strong>
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
            <span>
              Tokens{" "}
              <strong className="text-slate-900 dark:text-slate-100">
                {totalTokensUsed.toLocaleString()}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* 3. Top 6-Stage Horizontal Stepper */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#0D1424]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2.5 overflow-x-auto">
          <ol className="flex items-center gap-1.5 min-w-max">
            {STAGES.map((stage, idx) => {
              const isActive = activeStage === stage.id;
              const isDone = stageDone[stage.id];
              return (
                <React.Fragment key={stage.id}>
                  <li>
                    <button
                      type="button"
                      onClick={() => setActiveStage(stage.id)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                        isActive
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-mono ${
                          isActive
                            ? "bg-white/20 text-white"
                            : isDone
                            ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {isDone && !isActive ? <Check className="w-3 h-3" /> : stage.id}
                      </span>
                      <span>{stage.label}</span>
                    </button>
                  </li>
                  {idx < STAGES.length - 1 && (
                    <li aria-hidden="true" className="text-slate-300 dark:text-slate-700 px-0.5 select-none">
                      →
                    </li>
                  )}
                </React.Fragment>
              );
            })}
          </ol>
        </div>
      </div>

      {/* 4. Main Active Stage Canvas */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Error Banner (Never masks live API errors silently) */}
        {errorBanner && (
          <div
            role="alert"
            className="rounded-xl border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2.5 text-sm text-red-900 dark:text-red-200">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">{errorBanner.message}</div>
                <div className="text-xs text-red-800/85 dark:text-red-300/85 mt-0.5">
                  {errorBanner.hint}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {mode === "live" && (
                <button
                  type="button"
                  onClick={() => handleModeChange("demo")}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 hover:bg-red-100/60 dark:hover:bg-red-900/40 whitespace-nowrap cursor-pointer"
                >
                  Switch to Local Demo
                </button>
              )}
              <button
                type="button"
                onClick={() => setErrorBanner(null)}
                className="p-1.5 rounded-lg text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 cursor-pointer"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Guided Lab Observation Banner (when a Guided Lab is active) */}
        {activeLab && (
          <div className="rounded-xl border border-amber-300/90 dark:border-amber-800/80 bg-amber-50/75 dark:bg-amber-950/25 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                <FlaskConical className="w-4 h-4 shrink-0" />
                <span>Active Guided Lab: {activeLab.title}</span>
              </div>
              <p className="text-xs sm:text-[13px] leading-relaxed text-amber-950 dark:text-amber-100">
                {activeLab.whatToWatch}
              </p>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/90">
                <strong>Try next:</strong> {activeLab.nextStepHint}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isRunningAll}
                onClick={handleRunFullPipeline}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 whitespace-nowrap cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Experiment End-to-End</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveLab(null)}
                className="p-1.5 rounded-lg text-amber-800 dark:text-amber-300 hover:bg-amber-200/50 dark:hover:bg-amber-900/40 cursor-pointer"
                aria-label="Dismiss lab banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Active Stage View */}
        {activeStage === 1 && (
          <Stage1Chunking
            sourceText={sourceText}
            datasetTitle={datasetTitle}
            strategy={strategy}
            chunkSize={chunkSize}
            chunkOverlap={chunkOverlap}
            chunks={chunks}
            onStrategyChange={setStrategy}
            onChunkSizeChange={setChunkSize}
            onChunkOverlapChange={setChunkOverlap}
            onProceedToEmbeddings={async () => {
              setActiveStage(2);
              await executeEmbed();
            }}
          />
        )}

        {activeStage === 2 && (
          <Stage2Embeddings
            chunks={chunks}
            chunkEmbeddings={chunkEmbeddings}
            queryText={queryText}
            queryEmbedding={queryEmbedding}
            embeddingModel={embeddingModel}
            lastEmbedCacheHits={lastEmbedCacheHits}
            isEmbedding={isEmbedding}
            mode={mode}
            topK={topK}
            onEmbedAll={() => {
              executeEmbed();
            }}
            onProceedToRetrieval={() => setActiveStage(3)}
          />
        )}

        {activeStage === 3 && (
          <Stage3Retrieval
            scoredChunks={effectiveScoredChunks}
            searchMethod={searchMethod}
            topK={topK}
            minThreshold={minThreshold}
            hasEmbeddings={hasEmbeddings}
            isEmbedding={isEmbedding}
            queryText={queryText}
            onSearchMethodChange={(m) => {
              setSearchMethod(m);
              setHydeResult(null);
              setRerankedChunks(null);
            }}
            onTopKChange={(k) => {
              setTopK(k);
              setRerankedChunks(null);
            }}
            onMinThresholdChange={(t) => {
              setMinThreshold(t);
              setRerankedChunks(null);
            }}
            onEmbedNow={() => {
              executeEmbed();
            }}
            onProceedToAdvanced={() => setActiveStage(4)}
          />
        )}

        {activeStage === 4 && (
          <Stage4Advanced
            enableHyde={enableHyde}
            hydeMode={hydeMode}
            hydeResult={hydeResult}
            isRunningHyde={isRunningHyde}
            enableRerank={enableRerank}
            rerankedChunks={rerankedChunks}
            baseRetrievedChunks={effectiveScoredChunks.filter((s) => s.retrieved)}
            isRunningRerank={isRunningRerank}
            onToggleHyde={(enabled) => {
              setEnableHyde(enabled);
              if (!enabled) setHydeResult(null);
            }}
            onHydeModeChange={(m) => {
              setHydeMode(m);
              setHydeResult(null);
            }}
            onRunHyde={() => {
              executeHyde();
            }}
            onToggleRerank={(enabled) => {
              setEnableRerank(enabled);
              if (!enabled) setRerankedChunks(null);
            }}
            onRunRerank={() => {
              executeRerank();
            }}
            onProceedToPrompt={() => setActiveStage(5)}
          />
        )}

        {activeStage === 5 && (
          <Stage5Prompt
            prompt={promptPayload}
            retrievedChunks={retrievedDocChunks}
            onProceedToGeneration={async () => {
              setActiveStage(6);
              if (!generationResult) {
                await executeGenerate();
              }
            }}
          />
        )}

        {activeStage === 6 && (
          <Stage6Generation
            queryText={queryText}
            compareNoRag={compareNoRag}
            isGenerating={isGenerating}
            generationResult={generationResult}
            retrievedChunks={retrievedDocChunks}
            mode={mode}
            onToggleCompareNoRag={setCompareNoRag}
            onGenerate={() => {
              executeGenerate();
            }}
          />
        )}

        {/* Collapsible "What's Happening Under the Hood?" Explainer (Expanded by default) */}
        <UnderTheHoodCard key={activeStage} explainer={activeExplainer} />
      </main>

      {/* Quiet Minimal Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] mt-auto">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>
              RAG Glass Box — In-memory interactive Retrieval-Augmented Generation workbench
            </span>
          </div>
          <div className="font-mono tabular-nums">
            {mode === "live"
              ? "Live Mode · gemini-4-hydrogen + gemini-embedding-2"
              : "Local Demo Mode · Offline 64-D Vectorizer (0 API quota)"}
          </div>
        </div>
      </footer>
    </div>
  );
}
