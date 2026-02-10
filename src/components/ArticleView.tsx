import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore, Article } from "@/stores/useAppStore";
import { Icon } from "@iconify-icon/react";

interface ArticleViewProps {
  article: Article | null;
}

export function ArticleView({ article }: ArticleViewProps) {
  const { feeds } = useAppStore();
  const [translating, setTranslating] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<string | null>(
    null,
  );

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
      invoke("open_link", { url: article.link }).catch(console.error);
    }
  };

  const handleTranslate = async () => {
    if (!article || translating) return;

    setTranslating(true);
    try {
      const content = article.content || article.summary || "";
      const result = await invoke<string>("translate_text", {
        text: content.slice(0, 5000), // Limit to 5000 chars
        targetLang: "zh",
      });
      setTranslatedContent(result);
    } catch (e) {
      console.error("Translation failed:", e);
    }
    setTranslating(false);
  };

  const handleToggleStar = async () => {
    if (!article) return;
    const newStarred = article.isStarred === 0;
    await invoke("toggle_starred", { id: article.id, starred: newStarred });
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
    <div className="flex-1 flex flex-col h-full overflow-hidden">
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
            className="text-xl transition-transform hover:scale-110 cursor-pointer"
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
            className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/80 hover:shadow-md active:scale-95 transition-all cursor-pointer"
          >
            Open Original
          </button>
          <button
            onClick={handleTranslate}
            disabled={translating}
            className="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/70 hover:shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
          >
            {translating ? (
              <>
                <Icon icon="mdi:loading" className="animate-spin" />{" "}
                Translating...
              </>
            ) : (
              <>
                <Icon icon="mdi:translate" /> Translate to Chinese
              </>
            )}
          </button>
        </div>
      </div>

      {/* Article content */}
      <div className="flex-1 overflow-y-auto p-6">
        {translatedContent && (
          <div className="mb-4 p-3 bg-muted rounded text-sm">
            <p className="text-muted-foreground mb-2 flex items-center gap-1">
              <Icon icon="mdi:file-document-edit" /> Translated content:
            </p>
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
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
