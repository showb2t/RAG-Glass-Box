import React, { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Play,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { DocumentChunk, ExecutionMode, GenerationResult } from "../types/rag";

interface Stage6GenerationProps {
  queryText: string;
  compareNoRag: boolean;
  isGenerating: boolean;
  generationResult: GenerationResult | null;
  retrievedChunks: DocumentChunk[];
  mode: ExecutionMode;
  onToggleCompareNoRag: (enabled: boolean) => void;
  onGenerate: () => void;
}

export const Stage6Generation: React.FC<Stage6GenerationProps> = ({
  queryText,
  compareNoRag,
  isGenerating,
  generationResult,
  retrievedChunks,
  mode,
  onToggleCompareNoRag,
  onGenerate,
}) => {
  const [highlightedChunkId, setHighlightedChunkId] = useState<number | null>(null);
  const chunkRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const activeEvidenceChunks =
    generationResult?.usedChunks && generationResult.usedChunks.length > 0
      ? generationResult.usedChunks
      : retrievedChunks;

  const handleCitationClick = (chunkId: number) => {
    setHighlightedChunkId(chunkId);
    const el = chunkRefs.current[chunkId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // Parse inline [Chunk N] citations into clickable buttons
  const renderCitedAnswer = (text: string) => {
    const parts = text.split(/(\[Chunk\s+\d+\])/gi);
    return parts.map((part, idx) => {
      const match = part.match(/^\[Chunk\s+(\d+)\]$/i);
      if (match) {
        const chunkId = Number(match[1]);
        const isActive = highlightedChunkId === chunkId;
        return (
          <button
            key={idx}
            type="button"
            onClick={() => handleCitationClick(chunkId)}
            className={`inline-flex items-center mx-0.5 px-1.5 py-0.5 rounded font-mono text-xs font-semibold transition-colors cursor-pointer ${
              isActive
                ? "bg-blue-600 text-white"
                : "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900"
            }`}
          >
            [Chunk {chunkId}]
          </button>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  const faithfulness = generationResult?.faithfulness ?? null;

  return (
    <div className="space-y-5">
      {/* Control Strip */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Stage 6: Generation, Inline Citations &amp; No-RAG Comparison
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Compare an ungrounded LLM against the RAG-grounded answer and verify every claim against
            its cited evidence.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 shrink-0">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={compareNoRag}
              onChange={(e) => onToggleCompareNoRag(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span>Run No-RAG comparison (+1 call)</span>
          </label>

          <button
            type="button"
            disabled={isGenerating || !queryText.trim()}
            onClick={onGenerate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating &amp; Auditing…</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{generationResult ? "Regenerate Answer" : "Generate Answer"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Empty State */}
      {!generationResult && !isGenerating ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] p-10 text-center space-y-3">
          <div className="mx-auto w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Ready to generate grounded answers
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
            Click <strong>Generate Answer</strong> above (or <strong>Run Full Pipeline</strong>) to
            compare Standard LLM memory against your {retrievedChunks.length} retrieved chunks with
            clickable <code className="text-xs">[Chunk #]</code> citations.
          </p>
        </div>
      ) : (
        <>
          {/* Side-by-Side Comparison Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
            {/* Left Panel: Standard LLM (No RAG) */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] flex flex-col overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Standard LLM (No RAG)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pre-training memory only — zero document context injected
                  </p>
                </div>
                <span className="text-xs font-mono text-amber-700 dark:text-amber-400 shrink-0">
                  Ungrounded
                </span>
              </div>

              <div className="p-5 flex-1">
                {isGenerating ? (
                  <div className="space-y-2.5 animate-pulse">
                    <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-5/6" />
                    <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-full" />
                    <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                  </div>
                ) : !compareNoRag || generationResult?.noRagAnswer === null ? (
                  <div className="h-full flex flex-col justify-center text-xs text-slate-500 dark:text-slate-400 space-y-2 py-4">
                    <p>
                      No-RAG comparison call was skipped to conserve API quota. Enable{" "}
                      <strong>Run No-RAG comparison</strong> above and regenerate to see how an
                      ungrounded model guesses on your private document.
                    </p>
                  </div>
                ) : (
                  <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {generationResult?.noRagAnswer}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: RAG-Grounded Answer */}
            <div className="rounded-xl border border-blue-200 dark:border-blue-900/70 bg-white dark:bg-[#111827] flex flex-col overflow-hidden">
              <div className="px-5 py-3.5 border-b border-blue-100 dark:border-blue-950 flex items-center justify-between gap-2 bg-blue-50/40 dark:bg-blue-950/25">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    RAG-Grounded Answer
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Click any <code className="font-mono">[Chunk #]</code> citation to jump to its
                    exact source excerpt
                  </p>
                </div>
                <span className="text-xs font-mono text-blue-700 dark:text-blue-400 shrink-0">
                  {generationResult?.model ?? (mode === "live" ? "gemini-4-hydrogen" : "local-demo")}
                </span>
              </div>

              <div className="p-5 flex-1">
                {isGenerating ? (
                  <div className="space-y-2.5 animate-pulse">
                    <div className="h-3.5 bg-blue-100 dark:bg-blue-950 rounded w-11/12" />
                    <div className="h-3.5 bg-blue-100 dark:bg-blue-950 rounded w-full" />
                    <div className="h-3.5 bg-blue-100 dark:bg-blue-950 rounded w-4/5" />
                  </div>
                ) : (
                  <div className="text-sm leading-relaxed text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
                    {generationResult ? renderCitedAnswer(generationResult.ragAnswer) : null}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Grounding / Faithfulness Meter */}
          {faithfulness && !isGenerating && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {faithfulness.verdict === "grounded" || faithfulness.verdict === "safe_refusal" ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  )}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Grounding &amp; Faithfulness Meter
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {faithfulness.summary}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                  <span
                    className={`text-xs font-semibold ${
                      faithfulness.verdict === "grounded" || faithfulness.verdict === "safe_refusal"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : faithfulness.verdict === "partially_grounded"
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-red-700 dark:text-red-400"
                    }`}
                  >
                    {faithfulness.verdict === "safe_refusal"
                      ? "Safe Refusal"
                      : faithfulness.verdict === "grounded"
                      ? "Grounded"
                      : faithfulness.verdict === "partially_grounded"
                      ? "Partially Grounded"
                      : "Unsupported Claims"}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    {faithfulness.overallScore}%
                  </span>
                </div>
              </div>

              {/* Faithfulness Score Bar */}
              <div className="px-5 pt-4">
                <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    style={{ width: `${Math.max(4, Math.min(100, faithfulness.overallScore))}%` }}
                    className={`h-full rounded-full transition-all duration-300 ${
                      faithfulness.overallScore >= 85
                        ? "bg-emerald-600 dark:bg-emerald-400"
                        : faithfulness.overallScore >= 50
                        ? "bg-amber-500 dark:bg-amber-400"
                        : "bg-red-600 dark:bg-red-400"
                    }`}
                  />
                </div>
              </div>

              {/* Claim-by-Claim Verification List */}
              {faithfulness.claims.length > 0 && (
                <div className="p-5 divide-y divide-slate-100 dark:divide-slate-800">
                  {faithfulness.claims.map((claim, idx) => {
                    const isGood = claim.status === "supported" || claim.status === "refusal";
                    const isPartial = claim.status === "partial";
                    return (
                      <div key={idx} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 text-xs font-semibold">
                            {isGood ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            ) : (
                              <AlertCircle
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  isPartial
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-red-600 dark:text-red-400"
                                }`}
                              />
                            )}
                            <span
                              className={
                                isGood
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : isPartial
                                  ? "text-amber-700 dark:text-amber-400"
                                  : "text-red-700 dark:text-red-400"
                              }
                            >
                              {claim.status === "supported"
                                ? "Supported"
                                : claim.status === "refusal"
                                ? "Verified Refusal"
                                : claim.status === "partial"
                                ? "Partially Supported"
                                : "Unsupported"}
                            </span>
                            {claim.citedChunkIds.length > 0 && (
                              <span className="inline-flex items-center gap-1">
                                {claim.citedChunkIds.map((cid) => (
                                  <button
                                    key={cid}
                                    type="button"
                                    onClick={() => handleCitationClick(cid)}
                                    className="font-mono text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                  >
                                    [Chunk {cid}]
                                  </button>
                                ))}
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-[13px] text-slate-900 dark:text-slate-100">
                            {claim.claim}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {claim.explanation}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Clickable Evidence Chunks Inspector */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                Retrieved Evidence Chunks ({activeEvidenceChunks.length})
              </h3>
              {highlightedChunkId && (
                <button
                  type="button"
                  onClick={() => setHighlightedChunkId(null)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Clear citation highlight
                </button>
              )}
            </div>

            {activeEvidenceChunks.length === 0 ? (
              <div className="p-5 text-xs text-slate-500 dark:text-slate-400">
                No chunks were injected into the prompt (0 chunks passed the retrieval threshold).
              </div>
            ) : (
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {activeEvidenceChunks.map((chunk) => {
                  const isHighlighted = highlightedChunkId === chunk.id;
                  return (
                    <div
                      key={chunk.id}
                      ref={(el) => {
                        chunkRefs.current[chunk.id] = el;
                      }}
                      className={`rounded-lg border p-4 transition-all duration-200 ${
                        isHighlighted
                          ? "border-blue-500 dark:border-blue-400 bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/30"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                        <span className="font-semibold text-blue-700 dark:text-blue-400">
                          [Chunk {chunk.id}]
                        </span>
                        <span className="tabular-nums text-slate-400 dark:text-slate-500">
                          {chunk.charCount} chars · ~{chunk.estimatedTokens} tok
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                        {chunk.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
