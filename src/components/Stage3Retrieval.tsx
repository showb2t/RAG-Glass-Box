import React, { useState } from "react";
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  Cpu,
  Filter,
  Loader2,
  XCircle,
} from "lucide-react";
import type { ScoredChunk, SearchMethod } from "../types/rag";

interface Stage3RetrievalProps {
  scoredChunks: ScoredChunk[];
  searchMethod: SearchMethod;
  topK: number;
  minThreshold: number;
  hasEmbeddings: boolean;
  isEmbedding: boolean;
  queryText: string;
  onSearchMethodChange: (method: SearchMethod) => void;
  onTopKChange: (k: number) => void;
  onMinThresholdChange: (threshold: number) => void;
  onEmbedNow: () => void;
  onProceedToAdvanced: () => void;
}

export const Stage3Retrieval: React.FC<Stage3RetrievalProps> = ({
  scoredChunks,
  searchMethod,
  topK,
  minThreshold,
  hasEmbeddings,
  isEmbedding,
  queryText,
  onSearchMethodChange,
  onTopKChange,
  onMinThresholdChange,
  onEmbedNow,
  onProceedToAdvanced,
}) => {
  const [inspectedChunkId, setInspectedChunkId] = useState<number | null>(null);

  const retrievedChunks = scoredChunks.filter((s) => s.retrieved);
  const filteredChunks = scoredChunks.filter((s) => !s.retrieved);
  const needsVectors = (searchMethod === "dense" || searchMethod === "hybrid") && !hasEmbeddings;

  const inspected =
    scoredChunks.find((s) => s.chunk.id === inspectedChunkId) ?? scoredChunks[0] ?? null;

  return (
    <div className="space-y-5">
      {/* Control Strip */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Stage 3: Retrieval &amp; Scoring Comparison
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Compare how Dense Vectors, Sparse BM25 Keywords, and Hybrid RRF rank every chunk for
              your query.
            </p>
          </div>

          <button
            type="button"
            onClick={onProceedToAdvanced}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 self-start lg:self-auto cursor-pointer"
          >
            <span>Advanced RAG (HyDE &amp; Rerank)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Search Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 items-start">
          {/* Search Method Segmented Buttons */}
          <div className="lg:col-span-5">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
              Search Method
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              {(
                [
                  { id: "dense", label: "Dense Cosine" },
                  { id: "bm25", label: "Sparse BM25" },
                  { id: "hybrid", label: "Hybrid RRF" },
                ] as const
              ).map((opt) => {
                const active = searchMethod === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onSearchMethodChange(opt.id)}
                    className={`px-2.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              {searchMethod === "dense" &&
                "Ranks by cosine angle between embeddings—excels at synonyms and paraphrased intent."}
              {searchMethod === "bm25" &&
                "Ranks by exact term frequency weighted by corpus rarity (IDF)—excels at error codes & policy IDs."}
              {searchMethod === "hybrid" &&
                "Fuses Dense and BM25 rankings via Reciprocal Rank Fusion (k=60) for balanced recall."}
            </p>
          </div>

          {/* Top-K Slider */}
          <div className="lg:col-span-3 space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="topk-slider"
                className="text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Top-K Cutoff
              </label>
              <span className="text-xs font-mono tabular-nums font-semibold text-blue-600 dark:text-blue-400">
                Top {topK} {topK === 1 ? "chunk" : "chunks"}
              </span>
            </div>
            <input
              id="topk-slider"
              type="range"
              min={1}
              max={8}
              step={1}
              value={topK}
              onChange={(e) => onTopKChange(Number(e.target.value))}
              className="w-full lab-slider"
            />
            <div className="flex justify-between text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
              <span>1</span>
              <span>4</span>
              <span>8</span>
            </div>
          </div>

          {/* Minimum Similarity Threshold Slider */}
          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="threshold-slider"
                className="text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Minimum Similarity Threshold
              </label>
              <span className="text-xs font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                ≥ {minThreshold.toFixed(2)}
              </span>
            </div>
            <input
              id="threshold-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={minThreshold}
              onChange={(e) => onMinThresholdChange(Number(e.target.value))}
              className="w-full lab-slider"
            />
            <div className="flex justify-between text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
              <span>0.00 (no filter)</span>
              <span>0.50</span>
              <span>1.00 (exact)</span>
            </div>
          </div>
        </div>

        {/* Summary Metadata Strip */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
              {retrievedChunks.length} Retrieved
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
            <span>{filteredChunks.length} Filtered Out</span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
            <span className="font-sans">
              Active Query:{" "}
              <span className="text-slate-800 dark:text-slate-200 font-medium">
                &ldquo;{queryText || "None"}&rdquo;
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Warning if embeddings missing for Dense/Hybrid */}
      {needsVectors && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-amber-900 dark:text-amber-200">
            <strong>Embeddings required for {searchMethod === "dense" ? "Dense Cosine" : "Hybrid RRF"} scoring.</strong>{" "}
            Generate vectors for your chunks and query to unlock real cosine similarity scores.
          </div>
          <button
            type="button"
            disabled={isEmbedding}
            onClick={onEmbedNow}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isEmbedding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cpu className="w-3.5 h-3.5" />}
            <span>Embed Chunks &amp; Query</span>
          </button>
        </div>
      )}

      {/* Ranked Chunks (Left) + Exact Math Inspector (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div className="xl:col-span-7 space-y-4">
          {/* Retrieved Chunks Group */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Retrieved Chunks (Passed Top-{topK} &amp; Threshold ≥ {minThreshold.toFixed(2)})</span>
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {retrievedChunks.length} selected
              </span>
            </div>

            {retrievedChunks.length === 0 ? (
              <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
                No chunks met the current threshold ({minThreshold.toFixed(2)}) under{" "}
                <strong>{searchMethod.toUpperCase()}</strong>. Try lowering the threshold, switching
                search method, or see how Stage 6 handles zero-context refusal!
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {retrievedChunks.map((item) => (
                  <ScoreRow
                    key={item.chunk.id}
                    item={item}
                    isSelected={inspected?.chunk.id === item.chunk.id}
                    minThreshold={minThreshold}
                    onInspect={() => setInspectedChunkId(item.chunk.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Filtered Out Chunks Group */}
          {filteredChunks.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filtered Out Chunks (Excluded from Prompt)</span>
                </span>
                <span className="text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500">
                  {filteredChunks.length} dropped
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 opacity-85">
                {filteredChunks.map((item) => (
                  <ScoreRow
                    key={item.chunk.id}
                    item={item}
                    isSelected={inspected?.chunk.id === item.chunk.id}
                    minThreshold={minThreshold}
                    onInspect={() => setInspectedChunkId(item.chunk.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Interactive Math Breakdown Panel */}
        <div className="xl:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden xl:sticky xl:top-20">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Scoring Math Breakdown</span>
            </span>
            {inspected && (
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                Chunk #{inspected.chunk.id} · Rank #{inspected.activeRank}
              </span>
            )}
          </div>

          {inspected ? (
            <div className="p-5 space-y-4">
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-lg p-3 max-h-28 overflow-y-auto">
                {inspected.chunk.text}
              </p>

              {/* Dense Cosine Math */}
              <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    1. Dense Vector (Cosine Similarity)
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-blue-600 dark:text-blue-400">
                    {inspected.denseScore.toFixed(4)} (Rank #{inspected.denseRank})
                  </span>
                </div>
                <div className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                  cos(q, d) = (q · d) / (‖q‖ × ‖d‖) ={" "}
                  {inspected.dotProduct.toFixed(4)} / ({inspected.normA.toFixed(3)} ×{" "}
                  {inspected.normB.toFixed(3)})
                </div>
              </div>

              {/* BM25 Term-by-Term Math */}
              <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    2. Sparse Keyword (Okapi BM25)
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                    norm {inspected.bm25Normalized.toFixed(4)} (raw {inspected.bm25Raw.toFixed(2)}, Rank #
                    {inspected.bm25Rank})
                  </span>
                </div>

                {inspected.bm25Terms.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] font-mono tabular-nums">
                      <thead>
                        <tr className="text-left text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                          <th className="py-1 pr-2 font-medium">Query Term</th>
                          <th className="py-1 px-2 text-right font-medium">TF</th>
                          <th className="py-1 px-2 text-right font-medium">DF</th>
                          <th className="py-1 px-2 text-right font-medium">IDF</th>
                          <th className="py-1 pl-2 text-right font-medium">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                        {inspected.bm25Terms.map((t) => (
                          <tr
                            key={t.term}
                            className={
                              t.tf > 0
                                ? "text-slate-900 dark:text-slate-100 font-medium"
                                : "text-slate-400 dark:text-slate-600"
                            }
                          >
                            <td className="py-1 pr-2">{t.term}</td>
                            <td className="py-1 px-2 text-right">{t.tf}</td>
                            <td className="py-1 px-2 text-right">{t.df}</td>
                            <td className="py-1 px-2 text-right">{t.idf.toFixed(2)}</td>
                            <td className="py-1 pl-2 text-right">
                              {t.contribution > 0 ? `+${t.contribution.toFixed(2)}` : "0.00"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No non-stopword tokens in query.</p>
                )}
              </div>

              {/* Hybrid RRF Math */}
              <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    3. Hybrid Fusion (RRF, k = 60)
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-indigo-600 dark:text-indigo-400">
                    raw {inspected.rrfRaw.toFixed(5)}
                  </span>
                </div>
                <div className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                  1/(60 + {inspected.denseRank}) +{" "}
                  {inspected.bm25Raw > 0 ? `1/(60 + ${inspected.bm25Rank})` : "0 (no keyword hit)"} ={" "}
                  {inspected.rrfRaw.toFixed(5)}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-xs text-slate-500 dark:text-slate-400">
              Hover or click any chunk row to inspect its full similarity math.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface ScoreRowProps {
  item: ScoredChunk;
  isSelected: boolean;
  minThreshold: number;
  onInspect: () => void;
}

const ScoreRow: React.FC<ScoreRowProps> = ({ item, isSelected, minThreshold, onInspect }) => {
  const barWidth = Math.max(2, Math.min(100, Math.round(item.activeScore * 100)));
  const thresholdPct = Math.round(minThreshold * 100);

  let statusText = "Retrieved";
  if (!item.passedThreshold) {
    statusText = "Below threshold";
  } else if (!item.passedTopK) {
    statusText = "Outside Top-K";
  }

  return (
    <button
      type="button"
      onMouseEnter={onInspect}
      onFocus={onInspect}
      onClick={onInspect}
      className={`w-full text-left px-5 py-3.5 transition-colors cursor-pointer ${
        isSelected
          ? "bg-blue-50/70 dark:bg-blue-950/35"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono tabular-nums text-xs font-semibold text-slate-400 dark:text-slate-500 w-6">
            #{item.activeRank}
          </span>
          <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
            Chunk #{item.chunk.id}
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${
              item.retrieved
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {item.retrieved ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{statusText}</span>
          </span>
        </div>

        <span className="font-mono tabular-nums text-xs font-semibold text-slate-900 dark:text-slate-100 shrink-0">
          {item.activeScore.toFixed(3)}
        </span>
      </div>

      {/* Horizontal Progress Bar with Threshold Marker */}
      <div className="relative h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-2">
        <div
          style={{ width: `${barWidth}%` }}
          className={`h-full rounded-full transition-all duration-200 ${
            item.retrieved
              ? "bg-blue-600 dark:bg-blue-400"
              : "bg-slate-300 dark:bg-slate-600"
          }`}
        />
        {thresholdPct > 0 && thresholdPct < 100 && (
          <div
            style={{ left: `${thresholdPct}%` }}
            title={`Threshold: ${minThreshold.toFixed(2)}`}
            className="absolute top-0 bottom-0 w-0.5 bg-amber-500 dark:bg-amber-400"
          />
        )}
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
        {item.chunk.text}
      </p>

      <div className="mt-1.5 flex items-center gap-3 text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
        <span>Cosine {item.denseScore.toFixed(3)}</span>
        <span>·</span>
        <span>BM25 {item.bm25Normalized.toFixed(3)}</span>
        <span>·</span>
        <span>RRF {item.rrfRaw.toFixed(4)}</span>
      </div>
    </button>
  );
};
