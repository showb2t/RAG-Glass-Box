import type { ChunkingStrategy, DocumentChunk, HighlightSpan } from "../types/rag";

export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

function clampOverlap(chunkSize: number, chunkOverlap: number): number {
  const maxAllowed = Math.max(0, Math.min(200, chunkSize - 20));
  return Math.max(0, Math.min(chunkOverlap, maxAllowed));
}

interface TextSegment {
  start: number;
  end: number;
  text: string;
}

function splitIntoSentenceSpans(source: string): TextSegment[] {
  const spans: TextSegment[] = [];
  const regex = /[^.!?\n]+(?:[.!?]+["')\]]*|\n+|$)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    const raw = match[0];
    if (!raw.trim()) continue;
    const leadingWs = raw.length - raw.trimStart().length;
    const trailingWs = raw.length - raw.trimEnd().length;
    const start = match.index + leadingWs;
    const end = match.index + raw.length - trailingWs;
    if (end > start) {
      spans.push({ start, end, text: source.slice(start, end) });
    }
  }
  return spans;
}

function splitRecursiveSpans(source: string, maxLen: number): TextSegment[] {
  const rawParagraphs: TextSegment[] = [];
  const paraRegex = /(?:^|\n\n)([\s\S]*?)(?=\n\n|$)/g;
  let match: RegExpExecArray | null;

  while ((match = paraRegex.exec(source)) !== null) {
    const full = match[0];
    const body = match[1];
    const bodyOffset = match.index + full.indexOf(body);
    const trimmedStart = body.length - body.trimStart().length;
    const trimmedEnd = body.length - body.trimEnd().length;
    const start = bodyOffset + trimmedStart;
    const end = bodyOffset + body.length - trimmedEnd;
    if (end > start) {
      rawParagraphs.push({ start, end, text: source.slice(start, end) });
    }
  }

  const atomic: TextSegment[] = [];
  for (const para of rawParagraphs) {
    if (para.end - para.start <= maxLen) {
      atomic.push(para);
      continue;
    }
    // Split oversized paragraph into lines, then sentences, then word boundaries
    const subSentences = splitIntoSentenceSpans(para.text).map((s) => ({
      start: para.start + s.start,
      end: para.start + s.end,
      text: s.text,
    }));

    for (const sent of subSentences) {
      if (sent.end - sent.start <= maxLen) {
        atomic.push(sent);
      } else {
        // Word-safe slice
        let cursor = sent.start;
        while (cursor < sent.end) {
          let nextEnd = Math.min(sent.end, cursor + maxLen);
          if (nextEnd < sent.end) {
            const lastSpace = source.lastIndexOf(" ", nextEnd);
            if (lastSpace > cursor + Math.floor(maxLen * 0.5)) {
              nextEnd = lastSpace;
            }
          }
          const slice = source.slice(cursor, nextEnd).trim();
          if (slice) {
            const sStart = source.indexOf(slice, cursor);
            atomic.push({ start: sStart, end: sStart + slice.length, text: slice });
          }
          cursor = Math.max(nextEnd + 1, cursor + 1);
          while (cursor < sent.end && /\s/.test(source[cursor])) cursor++;
        }
      }
    }
  }

  return atomic;
}

function packSegmentsWithOverlap(
  source: string,
  segments: TextSegment[],
  chunkSize: number,
  overlap: number
): DocumentChunk[] {
  if (segments.length === 0) return [];

  const rawWindows: { start: number; end: number }[] = [];
  let idx = 0;

  while (idx < segments.length) {
    const start = segments[idx].start;
    let end = segments[idx].end;
    let j = idx + 1;

    while (j < segments.length && segments[j].end - start <= chunkSize) {
      end = segments[j].end;
      j++;
    }

    rawWindows.push({ start, end });

    if (j >= segments.length) break;

    if (overlap > 0) {
      const targetStart = Math.max(start + 1, end - overlap);
      let nextIdx = j;
      while (nextIdx > idx + 1 && segments[nextIdx - 1].start >= targetStart) {
        nextIdx--;
      }
      // If segments are large so no whole segment fits inside overlap window,
      // start the next window at a word boundary inside [end - overlap, end)
      if (nextIdx === j && end - start > overlap) {
        let charStart = Math.max(start + 10, end - overlap);
        const spaceAfter = source.indexOf(" ", charStart);
        if (spaceAfter !== -1 && spaceAfter < end - 5) {
          charStart = spaceAfter + 1;
        }
        // Build remaining via character-assisted overlap start
        const nextSegEnd = segments[j].end;
        if (nextSegEnd - charStart <= chunkSize) {
          // Insert synthetic anchor segment for next iteration
          segments.splice(j, 0, {
            start: charStart,
            end: end,
            text: source.slice(charStart, end),
          });
          idx = j;
          continue;
        }
      }
      idx = Math.max(idx + 1, nextIdx);
    } else {
      idx = j;
    }
  }

  return finalizeChunks(source, rawWindows);
}

function finalizeChunks(
  source: string,
  windows: { start: number; end: number }[]
): DocumentChunk[] {
  const cleaned = windows
    .map((w) => {
      const raw = source.slice(w.start, w.end);
      const lead = raw.length - raw.trimStart().length;
      const trail = raw.length - raw.trimEnd().length;
      const startOffset = w.start + lead;
      const endOffset = Math.max(startOffset, w.end - trail);
      return { startOffset, endOffset, text: source.slice(startOffset, endOffset) };
    })
    .filter((c) => c.text.length > 0);

  return cleaned.map((c, i) => {
    const prev = i > 0 ? cleaned[i - 1] : null;
    const next = i < cleaned.length - 1 ? cleaned[i + 1] : null;

    const overlapWithPrevEnd =
      prev && prev.endOffset > c.startOffset ? Math.min(prev.endOffset, c.endOffset) : c.startOffset;
    const overlapWithNextStart =
      next && next.startOffset < c.endOffset ? Math.max(next.startOffset, c.startOffset) : c.endOffset;

    return {
      id: i + 1,
      text: c.text,
      startOffset: c.startOffset,
      endOffset: c.endOffset,
      overlapWithPrevEnd,
      overlapWithNextStart,
      charCount: c.text.length,
      estimatedTokens: estimateTokens(c.text),
    };
  });
}

export function chunkDocument(
  sourceText: string,
  strategy: ChunkingStrategy,
  chunkSize: number,
  chunkOverlap: number
): DocumentChunk[] {
  const trimmed = sourceText.trim();
  if (!trimmed) return [];

  const safeSize = Math.max(100, Math.min(1000, Math.round(chunkSize)));
  const safeOverlap = clampOverlap(safeSize, Math.round(chunkOverlap));

  if (strategy === "fixed") {
    const windows: { start: number; end: number }[] = [];
    const step = Math.max(20, safeSize - safeOverlap);
    let cursor = 0;
    while (cursor < sourceText.length) {
      const end = Math.min(sourceText.length, cursor + safeSize);
      windows.push({ start: cursor, end });
      if (end >= sourceText.length) break;
      cursor += step;
    }
    return finalizeChunks(sourceText, windows);
  }

  if (strategy === "sentence") {
    const sentences = splitIntoSentenceSpans(sourceText);
    // Split any individual sentence longer than safeSize
    const bounded: TextSegment[] = [];
    for (const s of sentences) {
      if (s.end - s.start <= safeSize) {
        bounded.push(s);
      } else {
        let cursor = s.start;
        while (cursor < s.end) {
          let nextEnd = Math.min(s.end, cursor + safeSize);
          if (nextEnd < s.end) {
            const space = sourceText.lastIndexOf(" ", nextEnd);
            if (space > cursor + Math.floor(safeSize * 0.5)) nextEnd = space;
          }
          bounded.push({ start: cursor, end: nextEnd, text: sourceText.slice(cursor, nextEnd) });
          cursor = Math.max(nextEnd + 1, cursor + 1);
        }
      }
    }
    return packSegmentsWithOverlap(sourceText, bounded, safeSize, safeOverlap);
  }

  // Recursive paragraph -> line -> sentence -> word
  const segments = splitRecursiveSpans(sourceText, safeSize);
  return packSegmentsWithOverlap(sourceText, segments, safeSize, safeOverlap);
}

/**
 * Splits the full source document into contiguous non-overlapping visual spans,
 * identifying which chunk IDs cover each span so overlaps render with hatched styling.
 */
export function buildHighlightSpans(
  sourceText: string,
  chunks: DocumentChunk[]
): HighlightSpan[] {
  if (!sourceText) return [];
  if (chunks.length === 0) {
    return [{ start: 0, end: sourceText.length, text: sourceText, chunkIds: [], isOverlap: false }];
  }

  const boundarySet = new Set<number>([0, sourceText.length]);
  for (const chunk of chunks) {
    boundarySet.add(Math.max(0, Math.min(sourceText.length, chunk.startOffset)));
    boundarySet.add(Math.max(0, Math.min(sourceText.length, chunk.endOffset)));
  }

  const boundaries = Array.from(boundarySet).sort((a, b) => a - b);
  const spans: HighlightSpan[] = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    if (end <= start) continue;

    const covering: number[] = [];
    for (const chunk of chunks) {
      if (chunk.startOffset <= start && chunk.endOffset >= end) {
        covering.push(chunk.id);
      }
    }

    spans.push({
      start,
      end,
      text: sourceText.slice(start, end),
      chunkIds: covering,
      isOverlap: covering.length > 1,
    });
  }

  return spans;
}
