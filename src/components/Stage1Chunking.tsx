import React, { useMemo, useState } from "react";
import { ArrowRight, Layers } from "lucide-react";
import type { ChunkingStrategy, DocumentChunk, HighlightSpan } from "../types/rag";
import { buildHighlightSpans } from "../lib/chunking";

interface Stage1ChunkingProps {
  sourceText: string;
  datasetTitle: string;
  strategy: ChunkingStrategy;
  chunkSize: number;
  chunkOverlap: number;
  chunks: DocumentChunk[];
  onStrategyChange: (s: ChunkingStrategy) => void;
  onChunkSizeChange: (size: number) => void;
  onChunkOverlapChange: (overlap: number) => void;
  onProceedToEmbeddings: () => void;
}

const CHUNK_HIGHLIGHT_CLASSES = [
  "bg-blue-100/80 dark:bg-blue-900/35 text-slate-900 dark:text-slate-100",
  "bg-emerald-100/75 dark:bg-emerald-900/30 text-slate-900 dark:text-slate-100",
  "bg-indigo-100/75 dark:bg-indigo-900/35 text-slate-900 dark:text-slate-100",
  "bg-teal-100/75 dark:bg-teal-900/30 text-slate-900 dark:text-slate-100",
];

export const Stage1Chunking: React.FC<Stage1ChunkingProps> = ({
  sourceText,
  datasetTitle,
  strategy,
  chunkSize,
  chunkOverlap,
  chunks,
  onStrategyChange,
  onChunkSizeChange,
  onChunkOverlapChange,
  onProceedToEmbeddings,
}) => {
  const [hoveredChunkId, setHoveredChunkId] = useState<number | null>(null);
  const [selectedChunkId, setSelectedChunkId] = useState<number | null>(null);

  const spans: HighlightSpan[] = useMemo(
    () => buildHighlightSpans(sourceText, chunks),
    [sourceText, chunks]
  );

  const avgTokens = useMemo(() => {
    if (chunks.length === 0) return 0;
    const total = chunks.reduce((s, c) => s + c.estimatedTokens, 0);
    return Math.round(total / chunks.length);
  }, [chunks]);

  const overlapZonesCount = useMemo(
    () => spans.filter((s) => s.isOverlap).length,
    [spans]
  );

  const maxOverlapAllowed = Math.max(0, Math.min(200, chunkSize - 20));
  const activeFocusId = hoveredChunkId ?? selectedChunkId;

  return (
    <div className="space-y-5">
      {/* Control Strip */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Stage 1: Ingestion &amp; Chunking Lab
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Drag the sliders to see how strategy, size, and overlap slice{" "}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {datasetTitle}
              </span>{" "}
              in real time.
            </p>
          </div>

          <button
            type="button"
            onClick={onProceedToEmbeddings}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 self-start lg:self-auto cursor-pointer"
          >
            <span>Embed These {chunks.length} Chunks</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Strategy & Sliders Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 items-start">
          {/* Strategy Selector */}
          <div className="lg:col-span-5">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
              Chunking Strategy
            </label>
            <div
              className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800"
              role="radiogroup"
              aria-label="Chunking Strategy"
            >
              {(
                [
                  { id: "fixed", label: "Fixed Char" },
                  { id: "sentence", label: "Sentence-Aware" },
                  { id: "recursive", label: "Recursive Para" },
                ] as const
              ).map((opt) => {
                const active = strategy === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onStrategyChange(opt.id)}
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
              {strategy === "fixed" &&
                "Slices strictly every N characters—fast, but cuts straight through words and sentences."}
              {strategy === "sentence" &&
                "Packs complete sentences up to the target budget so clauses stay readable."}
              {strategy === "recursive" &&
                "Splits on paragraphs first, falling back to sentences only when a paragraph exceeds the limit."}
            </p>
          </div>

          {/* Chunk Size Slider */}
          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="chunk-size-slider"
                className="text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Chunk Size
              </label>
              <span className="text-xs font-mono tabular-nums font-semibold text-blue-600 dark:text-blue-400">
                {chunkSize} chars (~{Math.ceil(chunkSize / 4)} tokens)
              </span>
            </div>
            <input
              id="chunk-size-slider"
              type="range"
              min={100}
              max={1000}
              step={20}
              value={chunkSize}
              onChange={(e) => onChunkSizeChange(Number(e.target.value))}
              className="w-full lab-slider"
            />
            <div className="flex justify-between text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
              <span>100 chars</span>
              <span>500 chars</span>
              <span>1,000 chars</span>
            </div>
          </div>

          {/* Chunk Overlap Slider */}
          <div className="lg:col-span-3 space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="chunk-overlap-slider"
                className="text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Chunk Overlap
              </label>
              <span className="text-xs font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                {Math.min(chunkOverlap, maxOverlapAllowed)} chars
              </span>
            </div>
            <input
              id="chunk-overlap-slider"
              type="range"
              min={0}
              max={200}
              step={10}
              value={Math.min(chunkOverlap, maxOverlapAllowed)}
              onChange={(e) => onChunkOverlapChange(Number(e.target.value))}
              className="w-full lab-slider"
            />
            <div className="flex justify-between text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
              <span>0 chars</span>
              <span>100</span>
              <span>200 chars</span>
            </div>
          </div>
        </div>

        {/* Live Unboxed Metrics Bar (Zero-Pill Discipline) */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono tabular-nums">
            <span>
              <strong className="text-slate-900 dark:text-white">{chunks.length}</strong> chunks
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
            <span>
              Avg <strong className="text-slate-900 dark:text-white">{avgTokens}</strong> tokens/chunk
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
            <span>
              <strong className="text-amber-700 dark:text-amber-400">{overlapZonesCount}</strong> overlap zones
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
            <span>
              Source <strong className="text-slate-900 dark:text-white">{sourceText.length.toLocaleString()}</strong> chars
            </span>
          </div>

          {/* Visual Legend */}
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-blue-100 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-700" />
              <span>Chunk A</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700" />
              <span>Chunk B</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs overlap-hatch-light border border-amber-500/70" />
              <span>Overlap Zone</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Split: Highlighted Full Document (Left) + Chunk Boundary Inspector (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Highlighted Document Canvas */}
        <div className="xl:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Source Document with Live Chunk &amp; Overlap Highlights
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Click any span to inspect its chunk
            </span>
          </div>

          <div className="p-5 max-h-[520px] overflow-y-auto text-[14.5px] leading-[1.8] whitespace-pre-wrap text-slate-800 dark:text-slate-200">
            {spans.map((span, idx) => {
              const primaryChunkId = span.chunkIds[0];
              const isHighlighted =
                activeFocusId !== null && span.chunkIds.includes(activeFocusId);
              const isDimmed =
                activeFocusId !== null && !span.chunkIds.includes(activeFocusId);

              let bgClass = "bg-transparent";
              if (span.isOverlap) {
                bgClass =
                  "overlap-hatch-light border-b border-dashed border-amber-500/80 dark:border-amber-400/80";
              } else if (primaryChunkId !== undefined) {
                bgClass =
                  CHUNK_HIGHLIGHT_CLASSES[(primaryChunkId - 1) % CHUNK_HIGHLIGHT_CLASSES.length];
              }

              return (
                <span
                  key={`${span.start}-${idx}`}
                  onMouseEnter={() => {
                    if (primaryChunkId) setHoveredChunkId(primaryChunkId);
                  }}
                  onMouseLeave={() => setHoveredChunkId(null)}
                  onClick={() => {
                    if (primaryChunkId) {
                      setSelectedChunkId((prev) =>
                        prev === primaryChunkId ? null : primaryChunkId
                      );
                    }
                  }}
                  title={
                    span.isOverlap
                      ? `Overlap shared by Chunks ${span.chunkIds.map((id) => `#${id}`).join(" & ")}`
                      : primaryChunkId
                      ? `Chunk #${primaryChunkId}`
                      : undefined
                  }
                  className={`rounded-xs px-0.5 py-0.5 transition-opacity duration-150 cursor-pointer ${bgClass} ${
                    isHighlighted
                      ? "ring-2 ring-blue-600 dark:ring-blue-400 relative z-10"
                      : ""
                  } ${isDimmed ? "opacity-35" : "opacity-100"}`}
                >
                  {span.text}
                </span>
              );
            })}
          </div>
        </div>

        {/* Chunk List Inspector */}
        <div className="xl:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>Generated Chunks ({chunks.length})</span>
            </span>
            {selectedChunkId && (
              <button
                type="button"
                onClick={() => setSelectedChunkId(null)}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Clear highlight
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[520px] overflow-y-auto">
            {chunks.map((chunk) => {
              const isSelected = activeFocusId === chunk.id;
              const prevOverlapChars = Math.max(0, chunk.overlapWithPrevEnd - chunk.startOffset);
              const nextOverlapChars = Math.max(0, chunk.endOffset - chunk.overlapWithNextStart);

              return (
                <button
                  key={chunk.id}
                  type="button"
                  onMouseEnter={() => setHoveredChunkId(chunk.id)}
                  onMouseLeave={() => setHoveredChunkId(null)}
                  onClick={() =>
                    setSelectedChunkId((prev) => (prev === chunk.id ? null : chunk.id))
                  }
                  className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-blue-50/80 dark:bg-blue-950/40"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      Chunk #{chunk.id}
                    </span>
                    <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {chunk.charCount} chars · ~{chunk.estimatedTokens} tok
                      {prevOverlapChars > 0 || nextOverlapChars > 0 ? (
                        <span className="text-amber-700 dark:text-amber-400">
                          {" "}
                          · overlap {prevOverlapChars > 0 ? `←${prevOverlapChars}` : ""}
                          {prevOverlapChars > 0 && nextOverlapChars > 0 ? " " : ""}
                          {nextOverlapChars > 0 ? `→${nextOverlapChars}` : ""}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 line-clamp-3">
                    {chunk.text}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
