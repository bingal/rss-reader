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

// Streaming text hook
function useStreamingText(
  fullText: string,
  isActive: boolean,
  speed: number = 15,
) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const indexRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    if (!isActive || !fullText) {
      setDisplayedText(fullText || "");
      setIsComplete(true);
      return;
    }

    indexRef.current = 0;
    setDisplayedText("");
    setIsComplete(false);
    lastTimeRef.current = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - lastTimeRef.current;

      if (elapsed >= speed) {
        const charsToAdd = Math.max(1, Math.floor(elapsed / speed));
        const newIndex = Math.min(
          indexRef.current + charsToAdd,
          fullText.length,
        );

        if (newIndex > indexRef.current) {
          setDisplayedText(fullText.slice(0, newIndex));
          indexRef.current = newIndex;
        }

        lastTimeRef.current = currentTime;
      }

      if (indexRef.current < fullText.length) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setIsComplete(true);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [fullText, isActive, speed]);

  return {
    displayedText,
    isComplete,
    progress: fullText ? indexRef.current / fullText.length : 0,
  };
}

export function ArticleView({ article }: ArticleViewProps) {
  const { feeds } = useAppStore();
  const [viewMode, setViewMode] = useState<ViewMode>("original");
  const [isTranslating, setIsTranslating] = useState(false);

  // Translation content
  const [translatedTitle, setTranslatedTitle] = useState<string>("");
  const [translatedContent, setTranslatedContent] = useState<string>("");
  const [hasTranslation, setHasTranslation] = useState(false);

  // Toasts - only for errors
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Streaming display
  const { displayedText: displayedTitle, isComplete: titleComplete } =
    useStreamingText(translatedTitle, isTranslating && !!translatedTitle, 20);
  const { displayedText: displayedContent, progress } = useStreamingText(
    translatedContent,
    isTranslating && !!translatedContent,
    10,
  );

  // Load saved translation when article changes
  useEffect(() => {
    if (article) {
      setViewMode("original");
      setTranslatedTitle("");
      setTranslatedContent("");
      setIsTranslating(false);
      loadSavedTranslation();
    } else {
      setTranslatedTitle("");
      setTranslatedContent("");
      setHasTranslation(false);
      setViewMode("original");
    }
  }, [article?.id]);

  const loadSavedTranslation = async () => {
    if (!article) return;
    try {
      const saved = await invoke<string | null>("get_translation", {
        articleId: article.id,
      });
      if (saved) {
        // Parse saved translation (format: title\n---\ncontent)
        const parts = saved.split("\n---\n");
        if (parts.length >= 2) {
          setTranslatedTitle(parts[0]);
          setTranslatedContent(parts.slice(1).join("\n---\n"));
        } else {
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

  const handleTranslate = async () => {
    if (!article || isTranslating) return;

    const content = article.content || article.summary || "";
    const title = article.title || "";

    if (!content.trim() && !title.trim()) {
      addErrorToast("No content to translate");
      return;
    }

    // Immediately switch to translated view
    setViewMode("translated");
    setIsTranslating(true);
    setTranslatedTitle("");
    setTranslatedContent("");

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

      setTranslatedTitle(titleResult);
      setTranslatedContent(contentResult);
      setHasTranslation(true);

      // Save translation
      const combined = `${titleResult}\n---\n${contentResult}`;
      await invoke("save_translation", {
        articleId: article.id,
        content: combined,
      });
    } catch (e) {
      console.error("Translation failed:", e);
      const errorMsg = e instanceof Error ? e.message : String(e);
      addErrorToast(`Translation failed: ${errorMsg}`);
      setViewMode("original");
    } finally {
      setIsTranslating(false);
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

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
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
            <h1 className="text-xl font-semibold mb-2 transition-all duration-300">
              {displayTitle}
              {viewMode === "translated" && isTranslating && !titleComplete && (
                <span className="inline-block w-2 h-5 ml-1 bg-primary animate-pulse" />
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

          {/* View mode toggle - only show when has translation or translating */}
          {(hasTranslation || isTranslating) && (
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
                {isTranslating ? "Translating..." : "Translated"}
              </button>
            </div>
          )}

          {/* Translate / Re-translate button */}
          <button
            onClick={handleTranslate}
            disabled={isTranslating}
            className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/70 hover:shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
            title={hasTranslation ? "Re-translate" : "Translate"}
          >
            {isTranslating ? (
              <Icon icon="mdi:loading" className="animate-spin" />
            ) : hasTranslation ? (
              <Icon icon="mdi:refresh" />
            ) : (
              <Icon icon="mdi:translate" />
            )}
            {isTranslating
              ? "Translating..."
              : hasTranslation
                ? "Re-translate"
                : "Translate"}
          </button>
        </div>
      </div>

      {/* Article content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isTranslating && viewMode === "translated" && (
          <div className="mb-4 flex items-center gap-3 text-sm text-muted-foreground">
            <Icon icon="mdi:loading" className="animate-spin" />
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span>Translating...</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-100"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
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
