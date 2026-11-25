import React, { useState } from "react";
import { ArrowRight, Check, Copy } from "lucide-react";
import type { DocumentChunk, PromptPayload } from "../types/rag";

interface Stage5PromptProps {
  prompt: PromptPayload;
  retrievedChunks: DocumentChunk[];
  onProceedToGeneration: () => void;
}

export const Stage5Prompt: React.FC<Stage5PromptProps> = ({
  prompt,
  retrievedChunks,
  onProceedToGeneration,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const fullText = `=== SYSTEM INSTRUCTIONS ===\n${prompt.systemInstruction}\n\n=== USER PROMPT ===\n${prompt.fullUserPrompt}`;
    navigator.clipboard?.writeText(fullText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  // Visual proportions for the token breakdown bar (scaled against total prompt or context window)
  const totalPrompt = Math.max(1, prompt.totalTokens);
  const sysPct = Math.max(4, Math.round((prompt.systemTokens / totalPrompt) * 100));
  const ctxPct = Math.max(4, Math.round((prompt.contextTokens / totalPrompt) * 100));
  const qryPct = Math.max(4, 100 - sysPct - ctxPct);
  const windowUsagePct = Math.min(
    100,
    Number(((prompt.totalTokens / prompt.contextWindowLimit) * 100).toFixed(2))
  );

  return (
    <div className="space-y-5">
      {/* Header + Token Breakdown Bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Stage 5: Prompt Augmentation (Context Window Inspector)
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              This is the exact payload transmitted to the LLM—syntax-segmented into System
              Instructions, Injected Context, and User Query.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied Prompt" : "Copy Payload"}</span>
            </button>
            <button
              type="button"
              onClick={onProceedToGeneration}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>Generate &amp; Compare</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Context-Window Token Breakdown Bar */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Prompt Token Composition
            </span>
            <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
              <strong className="text-slate-900 dark:text-slate-100">
                {prompt.totalTokens.toLocaleString()}
              </strong>{" "}
              / {prompt.contextWindowLimit.toLocaleString()} window tokens ({windowUsagePct}% used)
            </span>
          </div>

          <div className="h-3.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex gap-0.5 p-0.5">
            <div
              style={{ width: `${sysPct}%` }}
              title={`System Instructions: ${prompt.systemTokens} tokens`}
              className="h-full rounded-l-full bg-indigo-500 dark:bg-indigo-400 transition-all duration-200"
            />
            <div
              style={{ width: `${ctxPct}%` }}
              title={`Retrieved Context: ${prompt.contextTokens} tokens`}
              className="h-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-200"
            />
            <div
              style={{ width: `${qryPct}%` }}
              title={`User Query: ${prompt.queryTokens} tokens`}
              className="h-full rounded-r-full bg-amber-500 dark:bg-amber-400 transition-all duration-200"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500 dark:bg-indigo-400" />
              <span>System: {prompt.systemTokens} tok</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 dark:bg-emerald-400" />
              <span>
                Injected Context ({retrievedChunks.length} chunks): {prompt.contextTokens} tok
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 dark:bg-amber-400" />
              <span>User Query: {prompt.queryTokens} tok</span>
            </span>
          </div>
        </div>
      </div>

      {/* Three Color-Coded Exact Prompt Blocks (Clean Hairline Borders, No Thick Left Stripes) */}
      <div className="space-y-4">
        {/* Block 1: System Instructions */}
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/70 bg-indigo-50/40 dark:bg-indigo-950/20 overflow-hidden">
          <div className="px-5 py-2.5 border-b border-indigo-200/70 dark:border-indigo-900/60 flex items-center justify-between text-xs">
            <span className="font-semibold text-indigo-800 dark:text-indigo-300">
              1. System Instructions (Grounding &amp; Refusal Guardrails)
            </span>
            <span className="font-mono tabular-nums text-indigo-700/80 dark:text-indigo-400">
              ~{prompt.systemTokens} tokens
            </span>
          </div>
          <pre className="p-5 text-xs sm:text-[13px] font-mono leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-200">
            {prompt.systemInstruction}
          </pre>
        </div>

        {/* Block 2: Injected Retrieved Context */}
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/40 dark:bg-emerald-950/20 overflow-hidden">
          <div className="px-5 py-2.5 border-b border-emerald-200/70 dark:border-emerald-900/60 flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-800 dark:text-emerald-300">
              2. Injected Retrieved Context ({retrievedChunks.length}{" "}
              {retrievedChunks.length === 1 ? "Chunk" : "Chunks"})
            </span>
            <span className="font-mono tabular-nums text-emerald-700/80 dark:text-emerald-400">
              ~{prompt.contextTokens} tokens
            </span>
          </div>
          <div className="p-5 space-y-3">
            {retrievedChunks.length === 0 ? (
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                [No chunks passed the Stage 3 retrieval filters—the model will receive empty context
                and should safely refuse.]
              </p>
            ) : (
              retrievedChunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className="rounded-lg border border-emerald-200/80 dark:border-emerald-900/60 bg-white/80 dark:bg-slate-950/70 p-3.5"
                >
                  <div className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                    [Chunk {chunk.id}]{" "}
                    <span className="font-normal text-slate-400 dark:text-slate-500">
                      ({chunk.charCount} chars · ~{chunk.estimatedTokens} tok)
                    </span>
                  </div>
                  <p className="text-xs sm:text-[13px] font-mono leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                    {chunk.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Block 3: User Query */}
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/70 bg-amber-50/40 dark:bg-amber-950/20 overflow-hidden">
          <div className="px-5 py-2.5 border-b border-amber-200/70 dark:border-amber-900/60 flex items-center justify-between text-xs">
            <span className="font-semibold text-amber-800 dark:text-amber-300">
              3. User Query
            </span>
            <span className="font-mono tabular-nums text-amber-700/80 dark:text-amber-400">
              ~{prompt.queryTokens} tokens
            </span>
          </div>
          <pre className="p-5 text-xs sm:text-[13px] font-mono leading-relaxed whitespace-pre-wrap text-slate-900 dark:text-slate-100">
            {prompt.userQueryBlock}
          </pre>
        </div>
      </div>
    </div>
  );
};
