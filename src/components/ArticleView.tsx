import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore, Article } from "@/stores/useAppStore";
import { Icon } from "@iconify-icon/react";

interface ArticleViewProps {
  article: Article | null;
}

interface Toast {
  id: number;
  message: string;
  type: "error";
}

type ViewMode = "original" | "translated";

// Format translation for storage: title + separator + content
const SEPARATOR = "\n\n===CONTENT===\n\n";

export function ArticleView({ article }: ArticleViewProps) {
  const { feeds } = useAppStore();
  const [viewMode, setViewMode] = useState<ViewMode>("original");
  const [isTranslating, setIsTranslating] = useState(false);

  // Translation content
  const [translatedTitle, setTranslatedTitle] = useState<string>("");
  const [translatedContent, setTranslatedContent] = useState<string>("");
  const [displayedTitle, setDisplayedTitle] = useState<string>("");
  const [displayedContent, setDisplayedContent] = useState<string>("");
  const [hasTranslation, setHasTranslation] = useState(false);

  // Toasts - only for errors
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Streaming refs
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCancelledRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, []);

  // Load saved translation when article changes
  useEffect(() => {
    if (article) {
      setViewMode("original");
      stopStreaming();
      resetTranslationState();
      loadSavedTranslation();
    } else {
      resetTranslationState();
    }
  }, [article?.id]);

  const resetTranslationState = () => {
    setTranslatedTitle("");
    setTranslatedContent("");
    setDisplayedTitle("");
    setDisplayedContent("");
    setHasTranslation(false);
    setIsTranslating(false);
    isCancelledRef.current = false;
  };

  const stopStreaming = () => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
  };

  // Stream text with smooth animation
  const streamText = (
    fullText: string,
    setDisplay: (text: string) => void,
    speed: number = 15,
  ) => {
    return new Promise<void>((resolve) => {
      let index = 0;
      setDisplay("");

      streamIntervalRef.current = setInterval(() => {
        if (isCancelledRef.current) {
          stopStreaming();
          resolve();
          return;
        }

        // Add multiple characters at once for smoother appearance
        const charsToAdd = Math.max(1, Math.floor(speed / 5));
        const newIndex = Math.min(index + charsToAdd, fullText.length);

        if (newIndex > index) {
          setDisplay(fullText.slice(0, newIndex));
          index = newIndex;
        }

        if (index >= fullText.length) {
          stopStreaming();
          resolve();
        }
      }, speed);
    });
  };

  const loadSavedTranslation = async () => {
    if (!article) return;
    try {
      const saved = await invoke<string | null>("get_translation", {
        articleId: article.id,
      });
      if (saved) {
        // Parse saved translation
        const separatorIndex = saved.indexOf(SEPARATOR);
        if (separatorIndex >= 0) {
          setTranslatedTitle(saved.slice(0, separatorIndex));
          setTranslatedContent(saved.slice(separatorIndex + SEPARATOR.length));
        } else {
          // Legacy format - no separator, treat as content only
          setTranslatedContent(saved);
        }
        setHasTranslation(true);
      }
    } catch (e) {
      console.error("Failed to load translation:", e);
    }
  };

  const addErrorToast = (message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type: "error" }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

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
      invoke("open_link", { url: article.link }).catch((e) => {
        addErrorToast(`Failed to open: ${e}`);
      });
    }
  };

  const performTranslation = async () => {
    if (!article || isTranslating) return false;

    const content = article.content || article.summary || "";
    const title = article.title || "";

    if (!content.trim() && !title.trim()) {
      addErrorToast("No content to translate");
      return false;
    }

    setIsTranslating(true);
    isCancelledRef.current = false;

    try {
      // Translate title and content in parallel
      const [titleResult, contentResult] = await Promise.all([
        title.trim()
          ? invoke<string>("translate_text", {
              text: title.slice(0, 200),
              targetLang: "zh",
            })
          : Promise.resolve(""),
        content.trim()
          ? invoke<string>("translate_text", {
              text: content.slice(0, 5000),
              targetLang: "zh",
            })
          : Promise.resolve(""),
      ]);

      if (isCancelledRef.current) return false;

      setTranslatedTitle(titleResult);
      setTranslatedContent(contentResult);
      setHasTranslation(true);

      // Save translation
      const combined = titleResult + SEPARATOR + contentResult;
      await invoke("save_translation", {
        articleId: article.id,
        content: combined,
      });

      // Start streaming display
      if (titleResult) {
        await streamText(titleResult, setDisplayedTitle, 20);
      }
      if (contentResult && !isCancelledRef.current) {
        await streamText(contentResult, setDisplayedContent, 8);
      }

      return true;
    } catch (e) {
      console.error("Translation failed:", e);
      const errorMsg = e instanceof Error ? e.message : String(e);
      addErrorToast(`Translation failed: ${errorMsg}`);
      return false;
    } finally {
      setIsTranslating(false);
    }
  };

  // Handle view mode change
  const handleViewModeChange = async (mode: ViewMode) => {
    if (mode === "translated" && !hasTranslation && !isTranslating) {
      // Switch to translated view and start translation
      setViewMode("translated");
      const success = await performTranslation();
      if (!success) {
        setViewMode("original");
      }
    } else {
      setViewMode(mode);
      if (mode === "translated" && hasTranslation) {
        // Show full translated content immediately
        setDisplayedTitle(translatedTitle);
        setDisplayedContent(translatedContent);
      }
    }
  };

  // Handle re-translate - reset and translate again with streaming
  const handleRetranslate = async () => {
    if (!article || isTranslating) return;

    // Reset translation state
    setTranslatedTitle("");
    setTranslatedContent("");
    setDisplayedTitle("");
    setDisplayedContent("");
    setHasTranslation(false);

    // Switch to translated view and start translation
    setViewMode("translated");
    const success = await performTranslation();
    if (!success) {
      setViewMode("original");
    }
  };

  const handleToggleStar = async () => {
    if (!article) return;
    const newStarred = article.isStarred === 0;
    try {
      await invoke("toggle_starred", { id: article.id, starred: newStarred });
    } catch (e) {
      addErrorToast("Failed to toggle star");
    }
  };

  // Determine what to display
  const displayTitle =
    viewMode === "translated"
      ? (isTranslating ? displayedTitle : translatedTitle) ||
        article?.title ||
        ""
      : article?.title || "";

  const displayContent =
    viewMode === "translated"
      ? (isTranslating ? displayedContent : translatedContent) ||
        article?.content ||
        article?.summary ||
        ""
      : article?.content || article?.summary || "";

  if (!article) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Icon
            icon="mdi:newspaper-variant"
            className="text-6xl mx-auto mb-4"
          />
          <p>Select an article to read</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* Error Toast Notifications */}
      <div className="fixed top-16 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="px-4 py-2 rounded-lg shadow-lg text-sm font-medium bg-red-500 text-white animate-in slide-in-from-right"
          >
            <div className="flex items-center gap-2">
              <Icon icon="mdi:alert-circle" className="text-lg" />
              {toast.message}
            </div>
          </div>
        ))}
      </div>

      {/* Article header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold mb-2 min-h-[1.75rem]">
              {displayTitle}
              {viewMode === "translated" &&
                isTranslating &&
                displayedTitle.length < translatedTitle.length && (
                  <span className="inline-block w-0.5 h-5 ml-0.5 bg-primary animate-pulse align-middle" />
                )}
            </h1>
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
            className="text-xl transition-transform hover:scale-110 cursor-pointer p-1 rounded hover:bg-muted flex-shrink-0"
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

          {/* View mode toggle - always show when has translation or is translating */}
          {(hasTranslation || isTranslating) && (
            <div className="flex rounded-md overflow-hidden border border-border">
              <button
                onClick={() => handleViewModeChange("original")}
                disabled={isTranslating}
                className={`px-3 py-1.5 text-sm flex items-center gap-1 transition-colors disabled:opacity-50 ${
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
                disabled={isTranslating}
                className={`px-3 py-1.5 text-sm flex items-center gap-1 transition-colors border-l border-border disabled:opacity-50 ${
                  viewMode === "translated"
                    ? "bg-green-600 text-white"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                <Icon icon="mdi:translate" className="text-sm" />
                {isTranslating ? "Translating..." : "Translated"}
              </button>
            </div>
          )}

          {/* Translate / Re-translate button - show if not translating */}
          {!isTranslating && (
            <button
              onClick={
                hasTranslation
                  ? handleRetranslate
                  : () => handleViewModeChange("translated")
              }
              className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/70 hover:shadow-md active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
              title={hasTranslation ? "Re-translate" : "Translate"}
            >
              {hasTranslation ? (
                <>
                  <Icon icon="mdi:refresh" />
                  Re-translate
                </>
              ) : (
                <>
                  <Icon icon="mdi:translate" />
                  Translate
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Article content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isTranslating && viewMode === "translated" && (
          <div className="mb-4 flex items-center gap-3 text-sm text-muted-foreground">
            <Icon icon="mdi:loading" className="animate-spin" />
            <span>Translating...</span>
            {displayedContent.length > 0 && translatedContent.length > 0 && (
              <span className="text-xs">
                (
                {Math.round(
                  (displayedContent.length / translatedContent.length) * 100,
                )}
                %)
              </span>
            )}
          </div>
        )}

        {!displayContent || displayContent.trim() === "" ? (
          <div className="text-muted-foreground text-center py-8">
            <Icon icon="mdi:file-outline" className="text-4xl mx-auto mb-2" />
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
            dangerouslySetInnerHTML={{
              __html: displayContent.replace(/\n/g, "<br/>"),
            }}
          />
        )}
      </div>
    </div>
  );
}
