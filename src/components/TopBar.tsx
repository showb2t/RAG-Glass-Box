import React, { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Database,
  FlaskConical,
  Loader2,
  Moon,
  Play,
  Sun,
  Upload,
  X,
} from "lucide-react";
import type { GuidedLab, SampleDataset } from "../types/rag";

interface TopBarProps {
  datasets: SampleDataset[];
  activeDatasetId: string;
  customDocTitle: string;
  guidedLabs: GuidedLab[];
  activeLabId: string | null;
  theme: "light" | "dark";
  isRunningAll: boolean;
  onSelectDataset: (datasetId: string) => void;
  onSaveCustomDocument: (title: string, content: string) => void;
  onSelectGuidedLab: (lab: GuidedLab) => void;
  onToggleTheme: () => void;
  onRunFullPipeline: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  datasets,
  activeDatasetId,
  customDocTitle,
  guidedLabs,
  activeLabId,
  theme,
  isRunningAll,
  onSelectDataset,
  onSaveCustomDocument,
  onSelectGuidedLab,
  onToggleTheme,
  onRunFullPipeline,
}) => {
  const [openMenu, setOpenMenu] = useState<"datasets" | "labs" | null>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [draftTitle, setDraftTitle] = useState(customDocTitle || "Custom Knowledge Base");
  const [draftContent, setDraftContent] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const menuContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeDatasetLabel =
    activeDatasetId === "custom"
      ? customDocTitle || "Custom Document"
      : datasets.find((d) => d.id === activeDatasetId)?.shortLabel ?? "Datasets";

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".txt") && !file.name.endsWith(".md") && file.type !== "text/plain") {
      setUploadError("Please upload a plain text (.txt) or Markdown (.md) file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      if (!text.trim()) {
        setUploadError("The uploaded file appears to be empty.");
        return;
      }
      setDraftTitle(file.name.replace(/\.(txt|md)$/i, ""));
      setDraftContent(text.slice(0, 30000));
    };
    reader.readAsText(file);
  };

  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftContent.trim()) {
      setUploadError("Paste some text or upload a .txt / .md file before loading.");
      return;
    }
    onSaveCustomDocument(draftTitle.trim() || "Custom Document", draftContent.trim());
    setShowCustomModal(false);
    setUploadError(null);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-sm">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => e.preventDefault()}
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0"
            style={{ fontFamily: "var(--font-display)" }}
          >
            RAG Glass Box
          </a>

          {/* Zone 2: Concise Navigation & Experiment Controls */}
          <nav
            ref={menuContainerRef}
            className="flex items-center gap-4 sm:gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            {/* Datasets Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === "datasets" ? null : "datasets")}
                className="flex items-center gap-1.5 py-1.5 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                aria-expanded={openMenu === "datasets"}
              >
                <Database className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <span className="max-w-[150px] truncate">{activeDatasetLabel}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>

              {openMenu === "datasets" && (
                <div className="absolute left-0 mt-2 w-80 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] shadow-lg p-2 z-50">
                  <div className="px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                    Pre-loaded Knowledge Bases
                  </div>
                  <div className="space-y-1">
                    {datasets.map((ds) => {
                      const active = ds.id === activeDatasetId;
                      return (
                        <button
                          key={ds.id}
                          type="button"
                          onClick={() => {
                            onSelectDataset(ds.id);
                            setOpenMenu(null);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                            active
                              ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          <div className="text-sm font-semibold flex items-center justify-between gap-2">
                            <span className="truncate">{ds.title}</span>
                            {active && (
                              <span className="text-xs font-normal text-blue-600 dark:text-blue-400 shrink-0">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 font-normal">
                            {ds.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      setShowCustomModal(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Paste text or upload .txt / .md</span>
                  </button>
                </div>
              )}
            </div>

            {/* Guided Labs Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === "labs" ? null : "labs")}
                className={`flex items-center gap-1.5 py-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeLabId
                    ? "text-blue-600 dark:text-blue-400 font-semibold"
                    : "hover:text-slate-900 dark:hover:text-white"
                }`}
                aria-expanded={openMenu === "labs"}
              >
                <FlaskConical className="w-4 h-4" />
                <span>Guided Labs</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>

              {openMenu === "labs" && (
                <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-[340px] sm:w-96 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] shadow-lg p-2 z-50">
                  <div className="px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                    Break RAG on Purpose — One-Click Experiments
                  </div>
                  <div className="space-y-1">
                    {guidedLabs.map((lab) => {
                      const active = lab.id === activeLabId;
                      return (
                        <button
                          key={lab.id}
                          type="button"
                          onClick={() => {
                            onSelectGuidedLab(lab);
                            setOpenMenu(null);
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
                            active
                              ? "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          <div className="text-sm font-semibold flex items-center justify-between gap-2">
                            <span>{lab.title}</span>
                            {active && (
                              <span className="text-xs font-normal text-amber-700 dark:text-amber-300">
                                Loaded
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
                            {lab.subtitle}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              className="flex items-center gap-1.5 py-1.5 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? (
                <>
                  <Moon className="w-4 h-4 text-slate-500" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </>
              )}
            </button>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              disabled={isRunningAll}
              onClick={onRunFullPipeline}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isRunningAll ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Running…</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Full Pipeline</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Custom Document Paste / Upload Modal */}
      {showCustomModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="custom-doc-title"
        >
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2
                id="custom-doc-title"
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                Load Custom Document
              </h2>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitCustom} className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Document Title
                  </label>
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="e.g., Q4 Architecture RFC"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,text/plain,text/markdown"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload .txt / .md</span>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Document Text (max 30,000 characters)
                  </label>
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {draftContent.length.toLocaleString()} chars
                  </span>
                </div>
                <textarea
                  rows={10}
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value.slice(0, 30000))}
                  placeholder="Paste any policy handbook, technical manual, research abstract, or legal clause here..."
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {uploadError && (
                <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  Load Into Workbench
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
