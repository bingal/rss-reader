import { invoke } from '@tauri-apps/api/core';
import { useAppStore, Article } from '@/stores/useAppStore';

interface ArticleViewProps {
  article: Article | null;
}

export function ArticleView({ article }: ArticleViewProps) {
  const { feeds } = useAppStore();

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFeedTitle = (feedId: string) => {
    const feed = feeds.find((f: { id: string }) => f.id === feedId);
    return feed?.title || 'Unknown Feed';
  };

  const handleOpenOriginal = () => {
    if (article) {
      invoke('open', { path: article.link }).catch(console.error);
    }
  };

  const handleTranslate = async () => {
    // Placeholder for translation feature
    console.log('Translation not implemented yet');
  };

  if (!article) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-4xl mb-4">📰</p>
          <p>Select an article to read</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Article header */}
      <div className="p-4 border-b border-border">
        <h1 className="text-xl font-semibold mb-2">{article.title}</h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <span>📰</span> {getFeedTitle(article.feedId)}
          </span>
          {article.author && (
            <span className="flex items-center gap-1">
              <span>👤</span> {article.author}
            </span>
          )}
          <span>{formatDate(article.pubDate)}</span>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={handleOpenOriginal}
            className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            Open Original
          </button>
          <button
            onClick={handleTranslate}
            className="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors"
          >
            Translate
          </button>
        </div>
      </div>

      {/* Article content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div 
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ 
            __html: article.content || article.summary || '' 
          }}
        />
      </div>
    </div>
  );
}
