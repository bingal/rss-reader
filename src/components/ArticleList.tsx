import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useQuery } from '@tanstack/react-query';
import { useAppStore, Article } from '@/stores/useAppStore';
import { cn } from '@/lib/utils';

interface ArticleListProps {
  onSelectArticle: (article: Article) => void;
  selectedArticleId: string | null;
}

export function ArticleList({ onSelectArticle, selectedArticleId }: ArticleListProps) {
  const { selectedFeedId, markArticleAsRead } = useAppStore();
  const [limit] = useState(50);

  const { data: articles, isLoading } = useQuery({
    queryKey: ['articles', selectedFeedId, limit],
    queryFn: async () => {
      const result = await invoke<Article[]>('fetch_articles', { 
        feedId: selectedFeedId, 
        limit, 
        offset: 0 
      });
      return result;
    },
  });

  const handleSelect = (article: Article) => {
    if (!article.isRead) {
      markArticleAsRead(article.id);
      invoke('mark_read', { id: article.id, read: true }).catch(console.error);
    }
    onSelectArticle(article);
  };

  const formatArticleDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);
    const days = hours / 24;
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${Math.floor(hours)}h ago`;
    if (days < 7) return `${Math.floor(days)}d ago`;
    return formatDate(timestamp * 1000);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="w-80 border-r border-border flex flex-col h-full bg-muted/10">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <h2 className="font-medium text-sm">
          {selectedFeedId ? 'Feed Articles' : 'All Articles'}
        </h2>
      </div>

      {/* Article list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading...</div>
        ) : articles?.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            No articles yet. Add some feeds to get started!
          </div>
        ) : (
          <div className="divide-y divide-border">
            {articles?.map((article) => (
              <article
                key={article.id}
                onClick={() => handleSelect(article)}
                className={cn(
                  'p-3 cursor-pointer transition-colors hover:bg-muted/50',
                  selectedArticleId === article.id && 'bg-muted',
                  article.isRead === 0 && !selectedArticleId && 'bg-background'
                )}
              >
                <h3 className={cn(
                  'text-sm font-medium mb-1 line-clamp-2',
                  article.isRead ? 'text-muted-foreground' : 'text-foreground'
                )}>
                  {article.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {article.author && (
                    <>
                      <span className="truncate max-w-[100px]">{article.author}</span>
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
