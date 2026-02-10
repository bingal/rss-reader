import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { ArticleList } from "./components/ArticleList";
import { ArticleView } from "./components/ArticleView";
import { OPMLImport } from "./components/OPMLImport";
import { Settings } from "./components/Settings";
import { useAppStore, Article } from "@/stores/useAppStore";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify-icon/react";

function App() {
  const { theme, setTheme, updateSettings } = useAppStore();
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showOPML, setShowOPML] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const queryClient = useQueryClient();

  // Load settings from backend on startup
  useEffect(() => {
    async function loadSettings() {
      try {
        const baseUrl = await invoke<string | null>("get_app_setting", {
          key: "translation_base_url",
        });
        const apiKey = await invoke<string | null>("get_app_setting", {
          key: "translation_api_key",
        });
        const prompt = await invoke<string | null>("get_app_setting", {
          key: "translation_prompt",
        });

        updateSettings({
          baseUrl: baseUrl || "https://libretranslate.com",
          apiKey: apiKey || "",
          prompt: prompt || "Translate the following text to Chinese:",
        });
      } catch (e) {
        console.error("Failed to load settings:", e);
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
      const result = await invoke<number>("refresh_all_feeds");
      console.log(`Refreshed ${result} articles`);
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
      {/* Title bar */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:rss-box" className="text-xl text-primary" />
          <span className="font-semibold">RSS Reader</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOPML(true)}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            title="Import/Export OPML"
          >
            <Icon icon="mdi:database-import" className="text-lg" />
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            title="Refresh (R)"
          >
            {isRefreshing ? (
              <Icon icon="mdi:loading" className="text-lg animate-spin" />
            ) : (
              <Icon icon="mdi:refresh" className="text-lg" />
            )}
          </button>

          <button
            onClick={handleToggleTheme}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            title="Toggle Theme (M)"
          >
            {theme === "dark" ? (
              <Icon icon="mdi:white-balance-sunny" className="text-lg" />
            ) : (
              <Icon icon="mdi:moon-waning-crescent" className="text-lg" />
            )}
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            title="Settings"
          >
            <Icon icon="mdi:cog" className="text-lg" />
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
