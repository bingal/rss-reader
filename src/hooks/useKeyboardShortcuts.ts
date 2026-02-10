import { useEffect, useCallback } from "react";
import { Article } from "@/stores/useAppStore";

interface UseKeyboardShortcutsProps {
  articles: Article[];
  selectedArticleId: string | null;
  onSelectArticle: (article: Article | null) => void;
  onRefresh?: () => void;
  onToggleTheme?: () => void;
  onToggleStar?: (articleId: string, currentStarred: boolean) => void;
  onShowShortcuts?: () => void;
}

export function useKeyboardShortcuts({
  articles,
  selectedArticleId,
  onSelectArticle,
  onRefresh,
  onToggleTheme,
  onToggleStar,
  onShowShortcuts,
}: UseKeyboardShortcutsProps) {
  const navigate = useCallback(
    (direction: "up" | "down") => {
      if (!articles.length) return;

      const currentIndex = selectedArticleId
        ? articles.findIndex((a) => a.id === selectedArticleId)
        : -1;

      let nextIndex: number;

      if (direction === "down") {
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
    },
    [articles, selectedArticleId, onSelectArticle],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if typing in input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case "j":
        case "arrowdown":
          event.preventDefault();
          navigate("down");
          break;
        case "k":
        case "arrowup":
          event.preventDefault();
          navigate("up");
          break;
        case "o":
        case "enter":
          event.preventDefault();
          if (selectedArticleId) {
            window.open(
              articles.find((a) => a.id === selectedArticleId)?.link,
              "_blank",
            );
          }
          break;
        case "r":
          event.preventDefault();
          onRefresh?.();
          break;
        case "m":
          event.preventDefault();
          onToggleTheme?.();
          break;
        case "s":
          // Only handle 's' key when not combined with Ctrl or Meta (avoid triggering on Ctrl+S / Cmd+S)
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            if (selectedArticleId) {
              const article = articles.find((a) => a.id === selectedArticleId);
              if (article && onToggleStar) {
                onToggleStar(selectedArticleId, article.isStarred === 1);
              }
            }
          }
          break;
        case "?":
          event.preventDefault();
          onShowShortcuts?.();
          break;
      }
    },
    [
      articles,
      selectedArticleId,
      navigate,
      onRefresh,
      onToggleTheme,
      onToggleStar,
      onShowShortcuts,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
