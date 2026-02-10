import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore, Article } from "@/stores/useAppStore";
import { Icon } from "@iconify-icon/react";
import { api } from "@/lib/api";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface ArticleViewProps {
  article: Article | null;
}

interface Toast {
  id: number;
  message: string;
  type: "error";
}

type ViewMode = "original" | "translated";
type TranslationPhase =
  | "idle"
  | "loading"
  | "streaming"
  | "completed"
  | "error";

// Format translation for storage: title + separator + content
const SEPARATOR = "\n\n===CONTENT===\n\n";

export function ArticleView({ article }: ArticleViewProps) {
  const { feeds } = useAppStore();
  const [viewMode, setViewMode] = useState<ViewMode>("original");
  const [phase, setPhase] = useState<TranslationPhase>("idle");

  // Translation content
  const [translatedTitle, setTranslatedTitle] = useState<string>("");
  const [translatedContent, setTranslatedContent] = useState<string>("");
  const [displayedTitle, setDisplayedTitle] = useState<string>("");
  const [displayedContent, setDisplayedContent] = useState<string>("");
  const [hasTranslation, setHasTranslation] = useState(false);

  // Toasts - only for errors
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Refs for streaming control
  const abortControllerRef = useRef<AbortController | null>(null);
  const isActiveRef = useRef(true);

  // Cleanup
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Load saved translation when article changes
  useEffect(() => {
    if (article) {
      isActiveRef.current = true;
      setViewMode("original");
      setPhase("idle");
      // Don't clear translation states immediately - wait for loading
      setHasTranslation(false);
      
      // Load translation asynchronously
      const loadTranslation = async () => {
        // Clear previous translation
        setTranslatedTitle("");
        setTranslatedContent("");
        setDisplayedTitle("");
        setDisplayedContent("");
        
        // Load new translation
        await loadSavedTranslation();
      };
      
      loadTranslation();
    } else {
      isActiveRef.current = false;
      abortControllerRef.current?.abort();
    }
  }, [article?.id]);

  const loadSavedTranslation = async () => {
    if (!article) return;
    try {
      const result = await api.translation.get(article.id);
      const saved = result.content;
      
      console.log('[ArticleView] loadSavedTranslation:', {
        articleId: article.id,
        hasSaved: !!saved,
        savedLength: saved?.length || 0
      });
      
      if (saved && isActiveRef.current) {
        const separatorIndex = saved.indexOf(SEPARATOR);
        let title = "";
        let content = "";
        
        if (separatorIndex >= 0) {
          title = saved.slice(0, separatorIndex);
          content = saved.slice(separatorIndex + SEPARATOR.length);
        } else {
          content = saved;
        }
        
        console.log('[ArticleView] Setting translation:', {
          titleLength: title.length,
          contentLength: content.length
        });
        
        setTranslatedTitle(title);
        setTranslatedContent(content);
        setDisplayedTitle(title);
        setDisplayedContent(content);
        setHasTranslation(true);
      }
    } catch (e) {
      console.error("Failed to load translation:", e);
    }
  };

  const addErrorToast = useCallback((message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type: "error" }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  // Stream text with smooth animation using requestAnimationFrame
  const streamText = useCallback(
    (
      fullText: string,
      onUpdate: (text: string) => void,
      speed: number = 10,
    ): Promise<void> => {
      return new Promise((resolve) => {
        let index = 0;
        let lastTime = performance.now();
        let rafId: number;

        const animate = (currentTime: number) => {
          if (!isActiveRef.current) {
            cancelAnimationFrame(rafId);
            resolve();
            return;
          }

          const elapsed = currentTime - lastTime;

          if (elapsed >= speed) {
            const charsToAdd = Math.max(1, Math.floor(elapsed / speed));
            index = Math.min(index + charsToAdd, fullText.length);
            onUpdate(fullText.slice(0, index));
            lastTime = currentTime;
          }

          if (index < fullText.length) {
            rafId = requestAnimationFrame(animate);
          } else {
            resolve();
          }
        };

        onUpdate("");
        rafId = requestAnimationFrame(animate);
      });
    },
    [],
  );

  // Main translation effect - runs when phase changes to 'loading'
  useEffect(() => {
    if (phase !== "loading" || !article) return;

    const doTranslation = async () => {
      const content = article.content || article.summary || "";
      const title = article.title || "";

      if (!content.trim() && !title.trim()) {
        addErrorToast("No content to translate");
        setPhase("error");
        setViewMode("original");
        return;
      }

      abortControllerRef.current = new AbortController();

      try {
        // Start both translations
        const titlePromise = title.trim()
          ? api.translation.translate(title.slice(0, 200), "zh")
          : Promise.resolve({ translatedText: "" });

        const contentPromise = content.trim()
          ? api.translation.translate(content.slice(0, 5000), "zh")
          : Promise.resolve({ translatedText: "" });

        const [titleResult, contentResult] = await Promise.all([
          titlePromise,
          contentPromise,
        ]);

        if (!isActiveRef.current || abortControllerRef.current.signal.aborted)
          return;

        // Translation results are already in Markdown format (no need to clean)
        const translatedTitleText = titleResult.translatedText;
        const translatedContentText = contentResult.translatedText;

        setTranslatedTitle(translatedTitleText);
        setTranslatedContent(translatedContentText);
        setHasTranslation(true);
        setPhase("streaming");

        // Save translation (Markdown format)
        const combined = translatedTitleText + SEPARATOR + translatedContentText;
        await api.translation.save(article.id, combined);

        // Start streaming display with Markdown text
        if (translatedTitleText && isActiveRef.current) {
          await streamText(translatedTitleText, setDisplayedTitle, 15);
        }
        if (translatedContentText && isActiveRef.current) {
          await streamText(translatedContentText, setDisplayedContent, 8);
        }

        if (isActiveRef.current) {
          setPhase("completed");
        }
      } catch (e) {
        if (!isActiveRef.current) return;
        console.error("Translation failed:", e);
        const errorMsg = e instanceof Error ? e.message : String(e);
        addErrorToast(`Translation failed: ${errorMsg}`);
        setPhase("error");
        setViewMode("original");
      }
    };

    // Use setTimeout to ensure UI updates before starting translation
    const timeoutId = setTimeout(doTranslation, 50);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [phase, article, addErrorToast, streamText]);

  const formatDate = (timestamp: number | null | undefined) => {
    // Handle null, undefined, or invalid values
    if (timestamp === null || timestamp === undefined) return "Unknown date";

    // Ensure it's a number
    const ts =
      typeof timestamp === "string"
        ? parseInt(timestamp, 10)
        : Number(timestamp);

    if (!isFinite(ts) || ts <= 0) return "Unknown date";

    try {
      // Unix timestamp is in seconds, convert to milliseconds for Date
      const date = new Date(ts * 1000);

      // Check if date is valid
      if (isNaN(date.getTime())) return "Invalid date";

      return date.toLocaleDateString("zh-CN", {
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

  const handleOpenOriginal = async () => {
    if (article) {
      try {
        const { open } = await import('@tauri-apps/plugin-opener');
        await open(article.link);
      } catch (e) {
        addErrorToast(`Failed to open: ${e}`);
      }
    }
  };

  const handleTranslate = () => {
    if (!article || phase === "loading" || phase === "streaming") return;

    // Reset and start translation
    setTranslatedTitle("");
    setTranslatedContent("");
    setDisplayedTitle("");
    setDisplayedContent("");
    setViewMode("translated");
    setPhase("loading");
  };

  const handleViewModeChange = (mode: ViewMode) => {
    console.log('[ArticleView] handleViewModeChange:', {
      mode,
      hasTranslation,
      phase,
      translatedTitleLength: translatedTitle.length,
      translatedContentLength: translatedContent.length,
      displayedTitleLength: displayedTitle.length,
      displayedContentLength: displayedContent.length
    });
    
    if (mode === "translated" && !hasTranslation && phase === "idle") {
      handleTranslate();
    } else {
      setViewMode(mode);
      if (mode === "translated" && hasTranslation) {
        // When switching to translated mode with existing translation,
        // set both the displayed and full content
        console.log('[ArticleView] Setting displayed content from translated content');
        setDisplayedTitle(translatedTitle);
        setDisplayedContent(translatedContent);
      }
    }
  };

  const handleToggleStar = async () => {
    if (!article) return;
    const currentlyStarred = article.isStarred === 1;
    const newStarred = !currentlyStarred;

    try {
      await api.articles.toggleStarred(article.id, newStarred);
      article.isStarred = newStarred ? 1 : 0;
    } catch {
      addErrorToast("Failed to toggle star");
    }
  };

  // Determine what to display
  const isTranslating = phase === "loading" || phase === "streaming";

  const displayTitle =
    viewMode === "translated"
      ? (phase === "streaming" ? displayedTitle : translatedTitle) ||
        article?.title ||
        ""
      : article?.title || "";

  const displayContent =
    viewMode === "translated"
      ? (phase === "streaming" ? displayedContent : translatedContent) ||
        article?.content ||
        article?.summary ||
        ""
      : article?.content || article?.summary || "";
  
  console.log('[ArticleView] Render:', {
    viewMode,
    phase,
    hasTranslation,
    displayTitleLength: displayTitle.length,
    displayContentLength: displayContent.length
  });

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
                phase === "streaming" &&
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

          {/* View mode toggle - show when has translation or translating */}
          {(hasTranslation || isTranslating) && (
            <div className="flex rounded-md overflow-hidden border border-border">
              <button
                onClick={() => handleViewModeChange("original")}
                disabled={phase === "loading"}
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
                disabled={phase === "loading"}
                className={`px-3 py-1.5 text-sm flex items-center gap-1 transition-colors border-l border-border disabled:opacity-50 ${
                  viewMode === "translated"
                    ? "bg-green-600 text-white"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                <Icon icon="mdi:translate" className="text-sm" />
                {phase === "loading" ? "Loading..." : "Translated"}
              </button>
            </div>
          )}

          {/* Translate / Re-translate button */}
          {phase !== "loading" && phase !== "streaming" && (
            <button
              onClick={handleTranslate}
              className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/70 hover:shadow-md active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
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
        {/* Loading state */}
        {phase === "loading" && viewMode === "translated" && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Icon icon="mdi:loading" className="text-4xl animate-spin mb-4" />
            <p className="text-lg">Translating...</p>
            <p className="text-sm mt-2">This may take a few seconds</p>
          </div>
        )}

        {/* Streaming or completed content */}
        {(phase === "streaming" ||
          phase === "completed" ||
          viewMode === "original" ||
          (viewMode === "translated" && hasTranslation)) && (
          <>
            {!displayContent || displayContent.trim() === "" ? (
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
              <MarkdownRenderer content={displayContent} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
