import React, { useState } from "react";
import { AlertTriangle, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import type { StageExplainer } from "../types/rag";

interface UnderTheHoodCardProps {
  explainer: StageExplainer;
}

export const UnderTheHoodCard: React.FC<UnderTheHoodCardProps> = ({ explainer }) => {
  // Expanded by default per user's Phase 1 preference for guided learning
  const [expanded, setExpanded] = useState(true);

  return (
    <section
      aria-label="What's Happening Under the Hood"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full px-5 py-3.5 flex items-center justify-between gap-4 text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            What&apos;s Happening Under the Hood?
          </span>
          <span className="hidden sm:inline text-xs text-slate-400 dark:text-slate-500">·</span>
          <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 truncate">
            {explainer.title}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
          <span>{expanded ? "Hide" : "Explain"}</span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Plain-English Intuition + Core Formula */}
          <div className="lg:col-span-7 space-y-3 pt-3">
            <div>
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Plain-English Intuition
              </h4>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {explainer.intuition}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                {explainer.formulaLabel}
              </div>
              <code className="block text-xs sm:text-[13px] font-mono text-slate-900 dark:text-blue-200 overflow-x-auto whitespace-pre-wrap">
                {explainer.formula}
              </code>
            </div>
          </div>

          {/* Common Failure Modes */}
          <div className="lg:col-span-5 pt-3 lg:border-l lg:border-slate-100 lg:dark:border-slate-800/80 lg:pl-5">
            <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Common Failure Modes</span>
            </h4>
            <ul className="space-y-2 text-xs sm:text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
              {explainer.failureModes.map((mode, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-mono text-slate-400 dark:text-slate-500 select-none">
                    {idx + 1}.
                  </span>
                  <span>{mode}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};
