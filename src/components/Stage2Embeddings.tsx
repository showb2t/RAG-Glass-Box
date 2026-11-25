import React, { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Cpu, Loader2, Sparkles } from "lucide-react";
import type { DocumentChunk, ExecutionMode, PcaProjectionResult } from "../types/rag";
import { computePca2D, cosineSimilarityMath } from "../lib/retrieval";

interface Stage2EmbeddingsProps {
  chunks: DocumentChunk[];
  chunkEmbeddings: Record<number, number[]>;
  queryText: string;
  queryEmbedding: number[] | null;
  embeddingModel: string;
  lastEmbedCacheHits: number;
  isEmbedding: boolean;
  mode: ExecutionMode;
  topK: number;
  onEmbedAll: () => void;
  onProceedToRetrieval: () => void;
}

export const Stage2Embeddings: React.FC<Stage2EmbeddingsProps> = ({
  chunks,
  chunkEmbeddings,
  queryText,
  queryEmbedding,
  embeddingModel,
  lastEmbedCacheHits,
  isEmbedding,
  mode,
  topK,
  onEmbedAll,
  onProceedToRetrieval,
}) => {
  const [selectedChunkId, setSelectedChunkId] = useState<number>(chunks[0]?.id ?? 1);
  const [hoveredPointId, setHoveredPointId] = useState<number | null>(null);

  const embeddedCount = useMemo(
    () => chunks.filter((c) => (chunkEmbeddings[c.id]?.length ?? 0) > 0).length,
    [chunks, chunkEmbeddings]
  );

  const allEmbedded = chunks.length > 0 && embeddedCount === chunks.length;
  const activeChunk = chunks.find((c) => c.id === selectedChunkId) ?? chunks[0];
  const activeVector = activeChunk ? chunkEmbeddings[activeChunk.id] : undefined;
  const dimensions = activeVector?.length ?? 0;

  // Compute 2D PCA projection on real vectors
  const pca: PcaProjectionResult = useMemo(() => {
    const list = chunks
      .filter((c) => (chunkEmbeddings[c.id]?.length ?? 0) > 0)
      .map((c) => ({ id: c.id, vector: chunkEmbeddings[c.id] }));
    return computePca2D(list, queryEmbedding);
  }, [chunks, chunkEmbeddings, queryEmbedding]);

  // Nearest chunks to query by true high-dimensional cosine similarity
  const nearestIds = useMemo(() => {
    if (!queryEmbedding) return new Set<number>();
    const scored = chunks
      .filter((c) => (chunkEmbeddings[c.id]?.length ?? 0) > 0)
      .map((c) => ({
        id: c.id,
        sim: cosineSimilarityMath(queryEmbedding, chunkEmbeddings[c.id]).score,
      }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, Math.min(topK, 4));
    return new Set(scored.map((s) => s.id));
  }, [chunks, chunkEmbeddings, queryEmbedding, topK]);

  // SVG viewport coordinate mapping
  const svgPoints = useMemo(() => {
    const allPts = [...pca.chunkPoints, ...(pca.queryPoint ? [pca.queryPoint] : [])];
    if (allPts.length === 0) {
      return { chunks: [], query: null };
    }
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const p of allPts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const padX = Math.max(0.08, (maxX - minX) * 0.16);
    const padY = Math.max(0.08, (maxY - minY) * 0.16);
    minX -= padX;
    maxX += padX;
    minY -= padY;
    maxY += padY;

    const spanX = Math.max(0.001, maxX - minX);
    const spanY = Math.max(0.001, maxY - minY);

    const W = 560;
    const H = 360;
    const margin = 42;

    const mapX = (x: number) => margin + ((x - minX) / spanX) * (W - margin * 2);
    const mapY = (y: number) => H - margin - ((y - minY) / spanY) * (H - margin * 2);

    return {
      chunks: pca.chunkPoints.map((p) => ({ ...p, sx: mapX(p.x), sy: mapY(p.y) })),
      query: pca.queryPoint
        ? { ...pca.queryPoint, sx: mapX(pca.queryPoint.x), sy: mapY(pca.queryPoint.y) }
        : null,
    };
  }, [pca]);

  const hoveredChunk = chunks.find((c) => c.id === hoveredPointId);
  const first12 = activeVector ? activeVector.slice(0, 12) : [];
  const sparklineDims = activeVector ? activeVector.slice(0, 48) : [];
  const maxAbsVal = useMemo(() => {
    if (sparklineDims.length === 0) return 0.1;
    return Math.max(0.001, ...sparklineDims.map((v) => Math.abs(v)));
  }, [sparklineDims]);

  return (
    <div className="space-y-5">
      {/* Header & Action Strip */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Stage 2: Embeddings &amp; 2D Vector Space Visualizer
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Convert every chunk (<code className="text-xs">RETRIEVAL_DOCUMENT</code>) and your
              query (<code className="text-xs">RETRIEVAL_QUERY</code>) into numerical coordinates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isEmbedding || chunks.length === 0}
              onClick={onEmbedAll}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
            >
              {isEmbedding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Embedding…</span>
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4" />
                  <span>
                    {allEmbedded ? "Re-Embed Chunks & Query" : `Embed All ${chunks.length} Chunks`}
                  </span>
                </>
              )}
            </button>

            {allEmbedded && (
              <button
                type="button"
                onClick={onProceedToRetrieval}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
              >
                <span>Inspect Retrieval</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Unboxed Status Metadata */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
          <span>
            Model:{" "}
            <strong className="text-slate-900 dark:text-slate-100">
              {embeddingModel || (mode === "live" ? "gemini-embedding-2" : "local-tfidf-64d")}
            </strong>
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
          <span>
            Embedded:{" "}
            <strong className="text-slate-900 dark:text-slate-100">
              {embeddedCount}/{chunks.length}
            </strong>{" "}
            chunks
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
          <span>
            Dimensions:{" "}
            <strong className="text-slate-900 dark:text-slate-100">
              {dimensions > 0 ? `${dimensions}D` : "—"}
            </strong>
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
          <span>
            Cache Hits:{" "}
            <strong className="text-emerald-700 dark:text-emerald-400">
              {lastEmbedCacheHits}
            </strong>
          </span>
          {queryEmbedding && (
            <>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-sans font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Query vector plotted
              </span>
            </>
          )}
        </div>
      </div>

      {/* Empty State if not embedded yet */}
      {!allEmbedded && embeddedCount === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] p-10 text-center space-y-3">
          <div className="mx-auto w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            No embeddings computed for the current chunks yet
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
            Click <strong>Embed All {chunks.length} Chunks</strong> above (or{" "}
            <strong>Run Full Pipeline</strong>) to generate vector coordinates and project them onto
            the 2D PCA semantic map. Identical chunks are automatically cached.
          </p>
        </div>
      ) : (
        /* Main Split: 2D PCA Vector Map (Left) + Raw Vector Inspector (Right) */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* Interactive 2D PCA Vector Space Map */}
          <div className="xl:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  Interactive 2D Vector Space Map (Client-Side PCA Projection)
                </h3>
                <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                  PC1 explains {pca.varianceExplained[0]}% variance · PC2 explains{" "}
                  {pca.varianceExplained[1]}% variance
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                  Nearest
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                  Other Chunks
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="text-amber-500 font-bold text-sm leading-none">★</span>
                  Query
                </span>
              </div>
            </div>

            <div className="p-4 relative">
              <svg
                viewBox="0 0 560 360"
                className="w-full h-auto rounded-lg bg-slate-50 dark:bg-[#0B1120] border border-slate-200/80 dark:border-slate-800"
                role="img"
                aria-label="2D PCA projection of chunk and query embedding vectors"
              >
                {/* Subtle coordinate grid */}
                <defs>
                  <pattern id="pca-grid" width="56" height="45" patternUnits="userSpaceOnUse">
                    <path
                      d="M 56 0 L 0 0 0 45"
                      fill="none"
                      stroke="currentColor"
                      className="text-slate-200/70 dark:text-slate-800/70"
                      strokeWidth="0.8"
                    />
                  </pattern>
                </defs>
                <rect width="560" height="360" fill="url(#pca-grid)" />

                {/* Axis labels */}
                <text
                  x="280"
                  y="348"
                  textAnchor="middle"
                  className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono"
                >
                  Principal Component 1 ({pca.varianceExplained[0]}%)
                </text>
                <text
                  x="14"
                  y="180"
                  textAnchor="middle"
                  transform="rotate(-90 14 180)"
                  className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono"
                >
                  PC 2 ({pca.varianceExplained[1]}%)
                </text>

                {/* Dotted connection lines from Query Star to nearest chunks */}
                {svgPoints.query &&
                  svgPoints.chunks
                    .filter((pt) => nearestIds.has(pt.id))
                    .map((pt) => {
                      const midX = (svgPoints.query!.sx + pt.sx) / 2;
                      const midY = (svgPoints.query!.sy + pt.sy) / 2;
                      return (
                        <g key={`line-${pt.id}`}>
                          <line
                            x1={svgPoints.query!.sx}
                            y1={svgPoints.query!.sy}
                            x2={pt.sx}
                            y2={pt.sy}
                            stroke="#2563EB"
                            strokeOpacity="0.65"
                            strokeWidth="1.75"
                            strokeDasharray="4 4"
                          />
                          {typeof pt.cosineToQuery === "number" && (
                            <g transform={`translate(${midX}, ${midY})`}>
                              <rect
                                x="-22"
                                y="-9"
                                width="44"
                                height="16"
                                rx="4"
                                className="fill-white dark:fill-slate-900 stroke-blue-300 dark:stroke-blue-700"
                                strokeWidth="0.8"
                              />
                              <text
                                x="0"
                                y="2.5"
                                textAnchor="middle"
                                className="fill-blue-700 dark:fill-blue-300 text-[9.5px] font-mono font-semibold"
                              >
                                {pt.cosineToQuery.toFixed(2)}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}

                {/* Document Chunk Dots */}
                {svgPoints.chunks.map((pt) => {
                  const isSelected = pt.id === selectedChunkId;
                  const isNear = nearestIds.has(pt.id);
                  const isHovered = pt.id === hoveredPointId;

                  return (
                    <g
                      key={`pt-${pt.id}`}
                      transform={`translate(${pt.sx}, ${pt.sy})`}
                      onClick={() => setSelectedChunkId(pt.id)}
                      onMouseEnter={() => setHoveredPointId(pt.id)}
                      onMouseLeave={() => setHoveredPointId(null)}
                      className="cursor-pointer"
                    >
                      {(isSelected || isHovered) && (
                        <circle
                          r="13"
                          className="fill-blue-500/20 dark:fill-blue-400/25"
                        />
                      )}
                      <circle
                        r={isSelected ? 7.5 : isNear ? 6.5 : 5.5}
                        className={
                          isNear
                            ? "fill-blue-600 dark:fill-blue-400 stroke-white dark:stroke-slate-950"
                            : "fill-slate-400 dark:fill-slate-500 stroke-white dark:stroke-slate-950"
                        }
                        strokeWidth="2"
                      />
                      <text
                        y="-10"
                        textAnchor="middle"
                        className={`text-[10px] font-mono select-none ${
                          isSelected || isNear
                            ? "fill-slate-900 dark:fill-slate-100 font-semibold"
                            : "fill-slate-500 dark:fill-slate-400"
                        }`}
                      >
                        C{pt.id}
                      </text>
                    </g>
                  );
                })}

                {/* Glowing Query Vector Star */}
                {svgPoints.query && (
                  <g
                    transform={`translate(${svgPoints.query.sx}, ${svgPoints.query.sy})`}
                    aria-label="User Query Vector"
                  >
                    <circle r="16" className="fill-amber-400/25 dark:fill-amber-400/20" />
                    <path
                      d="M 0,-10 L 2.9,-3.2 L 10,-3.2 L 4.3,1.2 L 6.4,8.5 L 0,4.2 L -6.4,8.5 L -4.3,1.2 L -10,-3.2 L -2.9,-3.2 Z"
                      className="fill-amber-500 dark:fill-amber-400 stroke-amber-900/40 dark:stroke-slate-950"
                      strokeWidth="1.2"
                    />
                    <text
                      y="20"
                      textAnchor="middle"
                      className="fill-amber-800 dark:fill-amber-300 text-[10.5px] font-semibold"
                    >
                      Query
                    </text>
                  </g>
                )}
              </svg>

              {/* Hover / Active Preview Strip */}
              <div className="mt-3 px-3.5 py-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 text-xs">
                {hoveredChunk ? (
                  <div>
                    <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 mb-0.5">
                      Hovering Chunk #{hoveredChunk.id}
                      {queryEmbedding && chunkEmbeddings[hoveredChunk.id] ? (
                        <span className="text-blue-600 dark:text-blue-400 font-normal">
                          {" "}
                          · Cosine similarity:{" "}
                          {cosineSimilarityMath(
                            queryEmbedding,
                            chunkEmbeddings[hoveredChunk.id]
                          ).score.toFixed(4)}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 line-clamp-2">
                      {hoveredChunk.text}
                    </p>
                  </div>
                ) : (
                  <div className="text-slate-500 dark:text-slate-400">
                    {queryText ? (
                      <>
                        Active query plotted as{" "}
                        <strong className="text-amber-600 dark:text-amber-400">★ Query</strong>:{" "}
                        <span className="text-slate-700 dark:text-slate-200 italic">
                          &ldquo;{queryText}&rdquo;
                        </span>{" "}
                        — click any dot to inspect its raw vector dimensions.
                      </>
                    ) : (
                      "Click any chunk dot on the map to inspect its raw floating-point vector on the right."
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Raw Vector Array & Sparkline Inspector */}
          <div className="xl:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                Raw Vector Inspector
              </h3>
              <select
                value={activeChunk?.id ?? ""}
                onChange={(e) => setSelectedChunkId(Number(e.target.value))}
                aria-label="Select chunk to inspect vector"
                className="text-xs font-mono px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 cursor-pointer"
              >
                {chunks.map((c) => (
                  <option key={c.id} value={c.id}>
                    Chunk #{c.id} ({c.charCount} chars)
                  </option>
                ))}
              </select>
            </div>

            {activeChunk && activeVector && activeVector.length > 0 ? (
              <div className="p-5 space-y-4">
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Chunk #{activeChunk.id} Text Preview
                  </div>
                  <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-lg p-3 line-clamp-3">
                    {activeChunk.text}
                  </p>
                </div>

                {/* 48-Dimension Sparkline Bar Chart */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      Vector Fingerprint (first {sparklineDims.length} of {dimensions} dims)
                    </span>
                    <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                      +blue / −amber
                    </span>
                  </div>
                  <div className="h-24 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-2 flex items-center gap-[2px] relative">
                    <div className="absolute inset-x-2 top-1/2 h-px bg-slate-300/80 dark:bg-slate-700/80 pointer-events-none" />
                    {sparklineDims.map((val, idx) => {
                      const pct = Math.min(48, (Math.abs(val) / maxAbsVal) * 46);
                      const positive = val >= 0;
                      return (
                        <div
                          key={idx}
                          title={`dim[${idx}] = ${val.toFixed(5)}`}
                          className="flex-1 h-full relative"
                        >
                          <div
                            style={{
                              height: `${Math.max(2, pct)}%`,
                              bottom: positive ? "50%" : undefined,
                              top: positive ? undefined : "50%",
                            }}
                            className={`absolute inset-x-0 rounded-xs ${
                              positive
                                ? "bg-blue-600/85 dark:bg-blue-400/85"
                                : "bg-amber-500/85 dark:bg-amber-400/85"
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* First 12 Raw Floating-Point Values */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      First 12 Floating-Point Coordinates
                    </span>
                    <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                      Float32[{dimensions}]
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px] tabular-nums">
                    {first12.map((val, idx) => (
                      <div
                        key={idx}
                        className="px-2 py-1.5 rounded-md border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between"
                      >
                        <span className="text-slate-400 dark:text-slate-500">d{idx}</span>
                        <span
                          className={
                            val >= 0
                              ? "text-blue-700 dark:text-blue-300 font-medium"
                              : "text-amber-700 dark:text-amber-300 font-medium"
                          }
                        >
                          {val >= 0 ? "+" : ""}
                          {val.toFixed(4)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-xs text-slate-500 dark:text-slate-400">
                Embed this chunk to inspect its floating-point vector coordinates.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
