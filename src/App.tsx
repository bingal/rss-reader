import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { ArticleList } from "./components/ArticleList";
import { ArticleView } from "./components/ArticleView";
import { OPMLImport } from "./components/OPMLImport";
import { Settings } from "./components/Settings";
import { KeyboardShortcutsHelp } from "./components/KeyboardShortcutsHelp";
import { useAppStore, Article } from "@/stores/useAppStore";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

function App() {
  const { theme, setTheme, updateSettings, selectedFeedId, filter } =
    useAppStore();
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showOPML, setShowOPML] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const queryClient = useQueryClient();

  // Load settings from backend on startup
  useEffect(() => {
    async function loadSettings() {
      try {
        const baseUrl = await api.settings.get("translation_base_url");
        const apiKey = await api.settings.get("translation_api_key");
        const model = await api.settings.get("translation_model");
        const prompt = await api.settings.get("translation_prompt");

        updateSettings({
          baseUrl: baseUrl.value || "https://libretranslate.com",
          apiKey: apiKey.value || "",
          model: model.value || "gpt-3.5-turbo",
          prompt: prompt.value || "Translate the following text to Chinese:",
        });
      } catch (e) {
        console.error("Failed to load settings:", e);
      } finally {
        // Hide loading screen
        setTimeout(() => {
          const loadingScreen = document.getElementById("loading-screen");
          if (loadingScreen) {
            loadingScreen.classList.add("hidden");
          }
        }, 100);
      }
    }

    loadSettings();
  }, [updateSettings]);

  // Fetch articles for keyboard navigation - use same query key as ArticleList
  const limit = 50;
  const { data: articlesData } = useQuery({
    queryKey: ["articles", selectedFeedId, filter, limit],
    queryFn: async () => {
      return await api.articles.fetch({
        feedId: selectedFeedId || undefined,
        filter,
        limit,
        offset: 0,
      });
    },
  });
  const articles = articlesData || [];

  // Apply theme
  document.documentElement.classList.remove("light", "dark");
  if (theme === "system") {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
      .matches
      ? "dark"
      : "light";
    document.documentElement.classList.add(systemTheme);
  } else {
    document.documentElement.classList.add(theme);
  }

  const handleRefresh = async () => {
    if (isRefreshing) return; // Prevent double clicks
    setIsRefreshing(true);
    try {
      const result = await api.feeds.refreshAll();
      console.log(`Refreshed ${result.count} articles`);
      // Invalidate and refetch articles
      await queryClient.invalidateQueries({ queryKey: ["articles"] });
    } catch (e) {
      console.error("Refresh failed:", e);
      // Show error to user
      alert(`Refresh failed: ${e}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleTheme = () => {
    const themes: ("light" | "dark" | "system")[] = ["light", "dark", "system"];
    const currentIndex = themes.indexOf(theme);
    setTheme(themes[(currentIndex + 1) % themes.length]);
  };

  const handleToggleStar = async (
    articleId: string,
    currentStarred: boolean,
  ) => {
    try {
      await api.articles.toggleStarred(articleId, !currentStarred);
      // Invalidate articles cache to refresh star status
      await queryClient.invalidateQueries({ queryKey: ["articles"] });
    } catch (e) {
      console.error("Failed to toggle star:", e);
    }
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    articles,
    selectedArticleId: selectedArticle?.id || null,
    onSelectArticle: setSelectedArticle,
    onRefresh: handleRefresh,
    onToggleTheme: handleToggleTheme,
    onToggleStar: handleToggleStar,
    onShowShortcuts: () => setShowShortcuts(true),
  });

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          onShowOPML={() => setShowOPML(true)}
          onShowSettings={() => setShowSettings(true)}
          onRefresh={handleRefresh}
          onToggleTheme={handleToggleTheme}
          isRefreshing={isRefreshing}
        />
        <ArticleList
          onSelectArticle={setSelectedArticle}
          selectedArticleId={selectedArticle?.id || null}
        />
        <ArticleView article={selectedArticle} />
      </div>

      {/* Status bar */}
      <footer className="h-6 flex items-center justify-between px-4 border-t border-border bg-muted/20 text-xs text-muted-foreground">
        <span>
          {articles.length} articles
          {selectedArticle && " • Selected"}
        </span>
        <button
          onClick={() => setShowShortcuts(true)}
          className="transition-colors hover:text-foreground"
        >
          Press ? for keyboard shortcuts
        </button>
      </footer>

      {/* OPML Modal */}
      <OPMLImport isOpen={showOPML} onClose={() => setShowOPML(false)} />

      {/* Settings Modal */}
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  );
}

export default App;
