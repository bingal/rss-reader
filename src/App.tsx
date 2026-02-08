import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ArticleList } from './components/ArticleList';
import { ArticleView } from './components/ArticleView';
import { useAppStore } from '@/stores/useAppStore';

interface Article {
  id: string;
  feedId: string;
  title: string;
  link: string;
  content: string;
  summary?: string;
  author?: string;
  pubDate: number;
  isRead: number;
  isStarred: number;
  fetchedAt: number;
}

function App() {
  const { theme, setTheme } = useAppStore();
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Apply theme
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Refresh logic would go here
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Title bar */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-lg">📡</span>
          <span className="font-semibold">RSS Reader</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            title="Refresh"
          >
            {isRefreshing ? '⏳' : '🔄'}
          </button>
          
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
            className="bg-transparent text-sm border border-border rounded px-2 py-1"
          >
            <option value="system">🌙 Auto</option>
            <option value="light">☀️ Light</option>
            <option value="dark">🌙 Dark</option>
          </select>
          
          <button
            className="p-1.5 rounded hover:bg-muted transition-colors"
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <ArticleList 
          onSelectArticle={setSelectedArticle}
          selectedArticleId={selectedArticle?.id || null}
        />
        <ArticleView article={selectedArticle} />
      </div>

      {/* Status bar */}
      <footer className="h-6 flex items-center justify-between px-4 border-t border-border bg-muted/20 text-xs text-muted-foreground">
        <span>Ready</span>
        <span>RSS Reader v0.1.0</span>
      </footer>
    </div>
  );
}

export default App;
