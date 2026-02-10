import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore, Article } from "@/stores/useAppStore";
import { cn } from "@/lib/utils";
import { Icon } from "@iconify-icon/react";
import { api } from "@/lib/api";

interface ArticleListProps {
  onSelectArticle: (article: Article) => void;
  selectedArticleId: string | null;
}

export function ArticleList({
  onSelectArticle,
  selectedArticleId,
}: ArticleListProps) {
  const { selectedFeedId, filter, setFilter, markArticleAsRead } =
    useAppStore();
  const [limit] = useState(50);
  const queryClient = useQueryClient();

  const { data: articles, isLoading } = useQuery({
    queryKey: ["articles", selectedFeedId, filter, limit],
    queryFn: async () => {
      const result = await api.articles.fetch({
        feedId: selectedFeedId || undefined,
        filter,
        limit,
        offset: 0,
      });
      // Debug: log first article date
      if (result && result.length > 0) {
        console.log("[ArticleList] First article:", {
          title: result[0].title,
          pubDate: result[0].pubDate,
          pubDateType: typeof result[0].pubDate,
        });
      }
      return result;
    },
  });

  const handleSelect = (article: Article) => {
    if (!article.isRead) {
      // Optimistically update local state
      markArticleAsRead(article.id);
      
      // Update backend and refresh article list
      api.articles.markRead(article.id, true)
        .then(() => {
          // Invalidate articles cache to refresh read status
          queryClient.invalidateQueries({ queryKey: ["articles"] });
        })
        .catch(console.error);
    }
    onSelectArticle(article);
  };

  const formatArticleDate = (timestamp: number | null | undefined) => {
    // Handle null/undefined
    if (timestamp === null || timestamp === undefined) return "Unknown";

    const ts =
      typeof timestamp === "string"
        ? parseInt(timestamp, 10)
        : Number(timestamp);
    if (!isFinite(ts) || ts <= 0) return "Unknown";

    const date = new Date(ts * 1000);
    if (isNaN(date.getTime())) return "Unknown";

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);
    const days = hours / 24;

    if (hours < 1) return "Just now";
    if (hours < 24) return `${Math.floor(hours)}h ago`;
    if (days < 7) return `${Math.floor(days)}d ago`;
    return formatDate(ts);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="w-80 border-r border-border flex flex-col h-full bg-muted/10">
      {/* Header with filter */}
      <div className="p-2 border-b border-border">
        <div className="flex gap-1">
          {(["all", "unread", "starred"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex-1 px-2 py-1 text-xs rounded transition-colors capitalize",
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Article list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading...</div>
        ) : articles?.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            No {filter === "all" ? "" : filter} articles
          </div>
        ) : (
          <div className="divide-y divide-border">
            {articles?.map((article) => (
              <article
                key={article.id}
                onClick={() => handleSelect(article)}
                className={cn(
                  "p-3 cursor-pointer transition-colors hover:bg-muted/50 relative",
                  selectedArticleId === article.id && "bg-muted",
                  article.isRead === 0 && !selectedArticleId && "bg-background",
                )}
              >
                {/* Star indicator */}
                {article.isStarred === 1 && (
                  <span className="absolute top-2 right-2 text-yellow-500">
                    <Icon icon="mdi:star" className="text-base" />
                  </span>
                )}

                <h3
                  className={cn(
                    "text-sm font-medium mb-1 line-clamp-2 pr-6",
                    article.isRead
                      ? "text-muted-foreground"
                      : "text-foreground",
                  )}
                >
                  {article.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {article.author && (
                    <>
                      <span className="truncate max-w-[80px]">
                        {article.author}
                      </span>
                      <span>•</span>
                    </>
                  )}
                  <span>{formatArticleDate(article.pubDate)}</span>
                </div>
                {article.summary && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {article.summary}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
