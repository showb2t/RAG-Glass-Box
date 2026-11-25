import React from "react";
import { motion } from "motion/react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Loader2,
  Minus,
  RefreshCw,
  SlidersHorizontal,
  Wand2,
} from "lucide-react";
import type { HydeResult, ScoredChunk } from "../types/rag";

interface Stage4AdvancedProps {
  enableHyde: boolean;
  hydeMode: "hyde" | "expand";
  hydeResult: HydeResult | null;
  isRunningHyde: boolean;
  enableRerank: boolean;
  rerankedChunks: ScoredChunk[] | null;
  baseRetrievedChunks: ScoredChunk[];
  isRunningRerank: boolean;
  onToggleHyde: (enabled: boolean) => void;
  onHydeModeChange: (mode: "hyde" | "expand") => void;
  onRunHyde: () => void;
  onToggleRerank: (enabled: boolean) => void;
  onRunRerank: () => void;
  onProceedToPrompt: () => void;
}

export const Stage4Advanced: React.FC<Stage4AdvancedProps> = ({
  enableHyde,
  hydeMode,
  hydeResult,
  isRunningHyde,
  enableRerank,
  rerankedChunks,
  baseRetrievedChunks,
  isRunningRerank,
  onToggleHyde,
  onHydeModeChange,
  onRunHyde,
  onToggleRerank,
  onRunRerank,
  onProceedToPrompt,
}) => {
  return (
    <div className="space-y-5">
      {/* Stage Header */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Stage 4: Advanced RAG Techniques (Optional Production Upgrades)
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Toggle HyDE Query Rewriting or LLM Reranking to observe how production pipelines improve
            retrieval precision before prompt assembly.
          </p>
        </div>

        <button
          type="button"
          onClick={onProceedToPrompt}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 self-start lg:self-auto cursor-pointer"
        >
          <span>Inspect Final Prompt</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Two-Column Production Upgrades */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        {/* Technique 1: Query Rewriting / HyDE */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Query Rewriting / HyDE
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Draft a hypothetical answer passage (HyDE) or expand synonyms, embed it, and compare
                retrieval before vs. after.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={enableHyde}
              onClick={() => onToggleHyde(!enableHyde)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
                enableHyde ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                  enableHyde ? "translate-x-5.5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {!enableHyde ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Toggle on to generate a hypothetical document or expanded search query. Especially
                effective on the <strong>Synonym Trap</strong> Guided Lab.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                    {(
                      [
                        { id: "hyde", label: "HyDE Passage" },
                        { id: "expand", label: "Query Expansion" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onHydeModeChange(opt.id)}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                          hydeMode === opt.id
                            ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                            : "text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={isRunningHyde}
                    onClick={onRunHyde}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {isRunningHyde ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>{hydeResult ? "Re-run Rewrite" : "Generate & Re-Retrieve"}</span>
                  </button>
                </div>

                {hydeResult ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 space-y-2">
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Original Query
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300">
                        {hydeResult.originalQuery}
                      </p>
                      <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800">
                        <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 mb-1">
                          {hydeResult.mode === "hyde"
                            ? "Generated Hypothetical Answer (Embedded for Retrieval)"
                            : "Expanded Query (Embedded for Retrieval)"}
                        </div>
                        <p className="text-xs leading-relaxed text-slate-900 dark:text-slate-100">
                          {hydeResult.rewrittenText}
                        </p>
                      </div>
                    </div>

                    {/* Before vs After Top-K IDs */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                          Before Rewrite (Top Chunks)
                        </div>
                        <div className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          {hydeResult.beforeTopIds.length > 0
                            ? hydeResult.beforeTopIds.map((id) => `Chunk #${id}`).join(" → ")
                            : "None passed"}
                        </div>
                      </div>
                      <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/25 p-3">
                        <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 mb-1.5">
                          After Rewrite (Top Chunks)
                        </div>
                        <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                          {hydeResult.afterTopIds.length > 0
                            ? hydeResult.afterTopIds.map((id) => `Chunk #${id}`).join(" → ")
                            : "None passed"}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Click <strong>Generate &amp; Re-Retrieve</strong> (or Run Full Pipeline) to
                    watch the rewritten query pull semantically richer chunks.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Technique 2: LLM Reranking with Animated Rank Shifts */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  LLM Cross-Encoder Reranking
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Score Stage 3 candidates on a 0–10 relevance rubric and animate how chunk ranks
                shift.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={enableRerank}
              onClick={() => onToggleRerank(!enableRerank)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
                enableRerank ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                  enableRerank ? "translate-x-5.5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {!enableRerank ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Toggle on to re-score your top candidate chunks jointly against the query using an
                LLM rubric (0–10) and inspect rank movements.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    Candidates queued: {baseRetrievedChunks.length}
                  </span>
                  <button
                    type="button"
                    disabled={isRunningRerank || baseRetrievedChunks.length === 0}
                    onClick={onRunRerank}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {isRunningRerank ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>{rerankedChunks ? "Re-run Reranker" : "Run LLM Reranker"}</span>
                  </button>
                </div>

                {rerankedChunks && rerankedChunks.length > 0 ? (
                  <div className="space-y-2.5">
                    {rerankedChunks.map((item) => {
                      const delta = item.rankDelta ?? 0;
                      return (
                        <motion.div
                          key={item.chunk.id}
                          layout
                          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                          className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-3.5 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 font-mono tabular-nums">
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                #{item.rerankRank}
                              </span>
                              <span className="font-semibold text-blue-700 dark:text-blue-400">
                                Chunk #{item.chunk.id}
                              </span>
                              <span className="text-slate-400 dark:text-slate-600">·</span>
                              <span className="text-slate-500 dark:text-slate-400">
                                was #{item.activeRank}
                              </span>
                              {delta > 0 ? (
                                <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                                  <ArrowUp className="w-3 h-3" />+{delta}
                                </span>
                              ) : delta < 0 ? (
                                <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400 font-semibold">
                                  <ArrowDown className="w-3 h-3" />
                                  {delta}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-slate-400">
                                  <Minus className="w-3 h-3" />0
                                </span>
                              )}
                            </div>

                            <span className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                              {(item.rerankScore ?? 0).toFixed(1)} / 10
                            </span>
                          </div>

                          {item.rerankReason && (
                            <p className="text-xs text-slate-700 dark:text-slate-300">
                              {item.rerankReason}
                            </p>
                          )}
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                            {item.chunk.text}
                          </p>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Click <strong>Run LLM Reranker</strong> to score each retrieved chunk from 0 to
                    10 and visualize how rank order changes.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
