import { useEffect, useCallback } from 'react';
import { Article } from '@/stores/useAppStore';

interface UseKeyboardShortcutsProps {
  articles: Article[];
  selectedArticleId: string | null;
  onSelectArticle: (article: Article | null) => void;
  onRefresh?: () => void;
  onToggleTheme?: () => void;
}

export function useKeyboardShortcuts({
  articles,
  selectedArticleId,
  onSelectArticle,
  onRefresh,
  onToggleTheme,
}: UseKeyboardShortcutsProps) {
  const navigate = useCallback((direction: 'up' | 'down') => {
    if (!articles.length) return;
    
    const currentIndex = selectedArticleId 
      ? articles.findIndex(a => a.id === selectedArticleId)
      : -1;
    
    let nextIndex: number;
    
    if (direction === 'down') {
      if (currentIndex === -1) {
        nextIndex = 0;
      } else if (currentIndex < articles.length - 1) {
        nextIndex = currentIndex + 1;
      } else {
        return;
      }
    } else {
      if (currentIndex <= 0) {
        return;
      }
      nextIndex = currentIndex - 1;
    }
    
    onSelectArticle(articles[nextIndex]);
  }, [articles, selectedArticleId, onSelectArticle]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignore if typing in input
    if (event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (event.key.toLowerCase()) {
      case 'j':
      case 'arrowdown':
        event.preventDefault();
        navigate('down');
        break;
      case 'k':
      case 'arrowup':
        event.preventDefault();
        navigate('up');
        break;
      case 'o':
      case 'enter':
        event.preventDefault();
        if (selectedArticleId) {
          window.open(articles.find(a => a.id === selectedArticleId)?.link, '_blank');
        }
        break;
      case 'r':
        event.preventDefault();
        onRefresh?.();
        break;
      case 'm':
        event.preventDefault();
        onToggleTheme?.();
        break;
      case 's':
        event.preventDefault();
        if (!event.ctrlKey && !event.metaKey) {
          onSelectArticle(
            articles.find(a => a.id === selectedArticleId) || null
          );
        }
        break;
      case '?':
        event.preventDefault();
        // Show help (not implemented)
        break;
    }
  }, [articles, selectedArticleId, navigate, onRefresh, onToggleTheme, onSelectArticle]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
