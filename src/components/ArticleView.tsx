import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore, Article } from "@/stores/useAppStore";
import { Icon } from "@iconify-icon/react";

interface ArticleViewProps {
  article: Article | null;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

type ViewMode = "original" | "translated" | "split";

export function ArticleView({ article }: ArticleViewProps) {
  const { feeds } = useAppStore();
  const [translating, setTranslating] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<string>("");
  const [displayedContent, setDisplayedContent] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("original");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [hasTranslation, setHasTranslation] = useState(false);
  const streamRef = useRef<NodeJS.Timeout | null>(null);
  const fullTranslationRef = useRef<string>("");

  // Clear stream interval on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        clearInterval(streamRef.current);
      }
    };
  }, []);

  // Load saved translation when article changes
  useEffect(() => {
    if (article) {
      // Always reset to original view when changing articles
      setViewMode("original");
      setTranslatedContent("");
      setDisplayedContent("");
      setTranslating(false);
      loadSavedTranslation();
    } else {
      setTranslatedContent("");
      setDisplayedContent("");
      setHasTranslation(false);
      setViewMode("original");
      if (streamRef.current) {
        clearInterval(streamRef.current);
        streamRef.current = null;
      }
    }
  }, [article?.id]);

  const loadSavedTranslation = async () => {
    if (!article) return;
    try {
      const saved = await invoke<string | null>("get_translation", {
        articleId: article.id,
      });
      if (saved) {
        setTranslatedContent(saved);
        setHasTranslation(true);
      } else {
        setTranslatedContent("");
        setHasTranslation(false);
      }
    } catch (e) {
      console.error("Failed to load translation:", e);
    }
  };

  const addToast = (message: string, type: "success" | "error" | "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  // Stream display effect - progressively show content
  const streamDisplay = useCallback((fullText: string, speed: number = 30) => {
    // Clear any existing stream
    if (streamRef.current) {
      clearInterval(streamRef.current);
    }

    let index = 0;
    setDisplayedContent("");
    fullTranslationRef.current = fullText;

    streamRef.current = setInterval(() => {
      if (index < fullText.length) {
        // Add characters in chunks for smoother display
        const chunkSize = Math.min(3, fullText.length - index);
        const nextChunk = fullText.slice(index, index + chunkSize);
        setDisplayedContent((prev) => prev + nextChunk);
        index += chunkSize;
      } else {
        if (streamRef.current) {
          clearInterval(streamRef.current);
          streamRef.current = null;
        }
      }
    }, speed);
  }, []);

  const formatDate = (timestamp: number) => {
    if (!timestamp || timestamp <= 0) return "Unknown date";
    try {
      return new Date(timestamp * 1000).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Invalid date";
    }
  };

  const getFeedTitle = (feedId: string) => {
    const feed = feeds.find((f) => f.id === feedId);
    return feed?.title || "Unknown Feed";
  };

  const handleOpenOriginal = () => {
    if (article) {
      invoke("open_link", { url: article.link })
        .then(() => {
          addToast("Opening in browser...", "info");
        })
        .catch((e) => {
          addToast(`Failed to open: ${e}`, "error");
        });
    }
  };

  const handleTranslate = async () => {
    if (!article || translating) return;

    const content = article.content || article.summary || "";
    if (!content.trim()) {
      addToast("No content to translate", "error");
      return;
    }

    setTranslating(true);
    setViewMode("translated");
    addToast("Starting translation...", "info");

    try {
      const result = await invoke<string>("translate_text", {
        text: content.slice(0, 5000),
        targetLang: "zh",
      });

      // Save translation
      await invoke("save_translation", {
        articleId: article.id,
        content: result,
      });

      setTranslatedContent(result);
      setHasTranslation(true);

      // Stream display the result
      streamDisplay(result, 20);

      addToast("Translation completed!", "success");
    } catch (e) {
      console.error("Translation failed:", e);
      const errorMsg = e instanceof Error ? e.message : String(e);
      addToast(`Translation failed: ${errorMsg}`, "error");
      setViewMode("original");
    } finally {
      setTranslating(false);
    }
  };

  const handleToggleStar = async () => {
    if (!article) return;
    const newStarred = article.isStarred === 0;
    try {
      await invoke("toggle_starred", { id: article.id, starred: newStarred });
      addToast(
        newStarred ? "Added to favorites" : "Removed from favorites",
        "success",
      );
    } catch (e) {
      addToast("Failed to toggle star", "error");
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "translated" && translatedContent && !translating) {
      // If switching to translated view and we have content, show it immediately
      setDisplayedContent(translatedContent);
    }
  };

  const getContentToDisplay = () => {
    switch (viewMode) {
      case "original":
        return article?.content || article?.summary || "";
      case "translated":
        return translating
          ? displayedContent
          : translatedContent || displayedContent;
      case "split":
        return article?.content || article?.summary || "";
      default:
        return article?.content || article?.summary || "";
    }
  };

  // Debug article content
  useEffect(() => {
    if (article) {
      console.log("[ArticleView] Article loaded:", {
        id: article.id,
        title: article.title,
        hasContent: !!article.content,
        contentLength: article.content?.length,
        hasSummary: !!article.summary,
        summaryLength: article.summary?.length,
        pubDate: article.pubDate,
        viewMode,
      });
    }
  }, [article]);

  if (!article) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Icon
            icon="mdi:newspaper-variant"
            className="text-6xl mx-auto mb-4 text-muted-foreground"
          />
          <p>Select an article to read</p>
        </div>
      </div>
    );
  }

  const mainContent = getContentToDisplay();

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* Toast Notifications */}
      <div className="fixed top-16 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-right ${
              toast.type === "success"
                ? "bg-green-500 text-white"
                : toast.type === "error"
                  ? "bg-red-500 text-white"
                  : "bg-blue-500 text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon
                icon={
                  toast.type === "success"
                    ? "mdi:check-circle"
                    : toast.type === "error"
                      ? "mdi:alert-circle"
                      : "mdi:information"
                }
                className="text-lg"
              />
              {toast.message}
            </div>
          </div>
        ))}
      </div>

      {/* Article header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-semibold mb-2">{article.title}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Icon icon="mdi:newspaper-variant" className="text-sm" />
                {getFeedTitle(article.feedId)}
              </span>
              {article.author && (
                <span className="flex items-center gap-1">
                  <Icon icon="mdi:account" className="text-sm" />
                  {article.author}
                </span>
              )}
              <span>{formatDate(article.pubDate)}</span>
            </div>
          </div>

          <button
            onClick={handleToggleStar}
            className="text-xl transition-transform hover:scale-110 cursor-pointer p-1 rounded hover:bg-muted"
            title="Toggle star"
          >
            <Icon
              icon={article.isStarred === 1 ? "mdi:star" : "mdi:star-outline"}
              className={article.isStarred === 1 ? "text-yellow-500" : ""}
            />
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button
            onClick={handleOpenOriginal}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/80 hover:shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-1"
          >
            <Icon icon="mdi:open-in-new" className="text-sm" />
            Open Original
          </button>

          {!hasTranslation ? (
            <button
              onClick={handleTranslate}
              disabled={translating}
              className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/70 hover:shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
            >
              {translating ? (
                <>
                  <Icon icon="mdi:loading" className="animate-spin" />
                  Translating...
                </>
              ) : (
                <>
                  <Icon icon="mdi:translate" />
                  Translate
                </>
              )}
            </button>
          ) : (
            <>
              {/* View mode toggle buttons */}
              <div className="flex rounded-md overflow-hidden border border-border">
                <button
                  onClick={() => handleViewModeChange("original")}
                  className={`px-3 py-1.5 text-sm flex items-center gap-1 transition-colors ${
                    viewMode === "original"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  <Icon icon="mdi:file-document" className="text-sm" />
                  Original
                </button>
                <button
                  onClick={() => handleViewModeChange("translated")}
                  className={`px-3 py-1.5 text-sm flex items-center gap-1 transition-colors border-l border-border ${
                    viewMode === "translated"
                      ? "bg-green-600 text-white"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  <Icon icon="mdi:translate" className="text-sm" />
                  Translated
                </button>
                <button
                  onClick={() => handleViewModeChange("split")}
                  className={`px-3 py-1.5 text-sm flex items-center gap-1 transition-colors border-l border-border ${
                    viewMode === "split"
                      ? "bg-blue-600 text-white"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  <Icon icon="mdi:view-split-vertical" className="text-sm" />
                  Split
                </button>
              </div>

              {/* Re-translate button */}
              <button
                onClick={handleTranslate}
                disabled={translating}
                className="px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-all disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                title="Re-translate"
              >
                {translating ? (
                  <Icon icon="mdi:loading" className="animate-spin" />
                ) : (
                  <Icon icon="mdi:refresh" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Article content */}
      <div className="flex-1 overflow-y-auto p-6">
        {viewMode === "split" && hasTranslation ? (
          // Split view: original on left, translated on right
          <div className="grid grid-cols-2 gap-6">
            <div className="border-r border-border pr-6">
              <div className="sticky top-0 bg-background pb-2 mb-2 border-b">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Original
                </span>
              </div>
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{
                  __html: article.content || article.summary || "",
                }}
              />
            </div>
            <div className="pl-2">
              <div className="sticky top-0 bg-background pb-2 mb-2 border-b">
                <span className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wider">
                  Translated
                </span>
              </div>
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{
                  __html: (translating
                    ? displayedContent
                    : translatedContent
                  ).replace(/\n/g, "<br/>"),
                }}
              />
            </div>
          </div>
        ) : viewMode === "translated" ? (
          // Translated view
          <div>
            {translating && (
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Icon icon="mdi:loading" className="animate-spin" />
                <span>Translating...</span>
                <span className="text-xs">
                  (
                  {Math.round(
                    (displayedContent.length /
                      (fullTranslationRef.current.length || 1)) *
                      100,
                  )}
                  %)
                </span>
              </div>
            )}
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{
                __html: (translating
                  ? displayedContent
                  : translatedContent
                ).replace(/\n/g, "<br/>"),
              }}
            />
          </div>
        ) : (
          // Original view
          <div>
            {!mainContent || mainContent.trim() === "" ? (
              <div className="text-muted-foreground text-center py-8">
                <Icon
                  icon="mdi:file-outline"
                  className="text-4xl mx-auto mb-2"
                />
                <p>No content available for this article.</p>
                <button
                  onClick={handleOpenOriginal}
                  className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/80 transition-colors"
                >
                  Open Original Article
                </button>
              </div>
            ) : (
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: mainContent }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
