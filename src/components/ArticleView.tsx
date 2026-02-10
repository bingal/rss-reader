import { useState, useEffect } from "react";
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

export function ArticleView({ article }: ArticleViewProps) {
  const { feeds, settings } = useAppStore();
  const [translating, setTranslating] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<string | null>(
    null,
  );
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Clear translation when article changes
  useEffect(() => {
    setTranslatedContent(null);
  }, [article?.id]);

  const addToast = (message: string, type: "success" | "error" | "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
    addToast("Starting translation...", "info");

    try {
      console.log("Translating with settings:", {
        baseUrl: settings.baseUrl,
        hasApiKey: !!settings.apiKey,
        contentLength: content.length,
      });

      const result = await invoke<string>("translate_text", {
        text: content.slice(0, 5000),
        targetLang: "zh",
      });

      setTranslatedContent(result);
      addToast("Translation completed!", "success");
    } catch (e) {
      console.error("Translation failed:", e);
      const errorMsg = e instanceof Error ? e.message : String(e);
      addToast(`Translation failed: ${errorMsg}`, "error");
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

  const clearTranslation = () => {
    setTranslatedContent(null);
    addToast("Translation cleared", "info");
  };

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

  const displayContent =
    translatedContent || article.content || article.summary || "";

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
                <Icon icon="mdi:newspaper-variant" className="text-sm" />{" "}
                {getFeedTitle(article.feedId)}
              </span>
              {article.author && (
                <span className="flex items-center gap-1">
                  <Icon icon="mdi:account" className="text-sm" />{" "}
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

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button
            onClick={handleOpenOriginal}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/80 hover:shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-1"
          >
            <Icon icon="mdi:open-in-new" className="text-sm" />
            Open Original
          </button>
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
                Translate to Chinese
              </>
            )}
          </button>
          {translatedContent && (
            <button
              onClick={clearTranslation}
              className="px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-all cursor-pointer flex items-center gap-1"
            >
              <Icon icon="mdi:close" className="text-sm" />
              Clear Translation
            </button>
          )}
        </div>
      </div>

      {/* Article content */}
      <div className="flex-1 overflow-y-auto p-6">
        {translatedContent && (
          <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-1">
                <Icon icon="mdi:file-document-edit" />
                Translated Content
              </p>
              <button
                onClick={clearTranslation}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <Icon icon="mdi:close" />
              </button>
            </div>
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-green-900 dark:text-green-100"
              dangerouslySetInnerHTML={{
                __html: translatedContent.replace(/\n/g, "<br/>"),
              }}
            />
          </div>
        )}
        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: displayContent }}
        />
      </div>
    </div>
  );
}
