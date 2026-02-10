import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { ArticleList } from "./components/ArticleList";
import { ArticleView } from "./components/ArticleView";
import { OPMLImport } from "./components/OPMLImport";
import { Settings } from "./components/Settings";
import { useAppStore, Article } from "@/stores/useAppStore";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

function App() {
  const { theme, setTheme, updateSettings } = useAppStore();
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showOPML, setShowOPML] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isReady, setIsReady] = useState(false);
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
        // Mark as ready and hide loading screen
        setIsReady(true);
        setTimeout(() => {
          const loadingScreen = document.getElementById('loading-screen');
          if (loadingScreen) {
            loadingScreen.classList.add('hidden');
          }
        }, 100);
      }
    }

    loadSettings();
  }, [updateSettings]);

  // Get articles from query cache for keyboard navigation
  const articlesData =
    queryClient.getQueryData<Article[]>(["articles", null, 50]) || [];
  const articles = Array.isArray(articlesData) ? articlesData : [];

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

  // Keyboard shortcuts
  useKeyboardShortcuts({
    articles,
    selectedArticleId: selectedArticle?.id || null,
    onSelectArticle: setSelectedArticle,
    onRefresh: handleRefresh,
    onToggleTheme: handleToggleTheme,
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
        <span>Press ? for keyboard shortcuts</span>
      </footer>

      {/* OPML Modal */}
      <OPMLImport isOpen={showOPML} onClose={() => setShowOPML(false)} />

      {/* Settings Modal */}
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}

export default App;
