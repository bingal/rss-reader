import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { ArticleList } from "./components/ArticleList";
import { ArticleView } from "./components/ArticleView";
import { OPMLImport } from "./components/OPMLImport";
import { Settings } from "./components/Settings";
import { KeyboardShortcutsHelp } from "./components/KeyboardShortcutsHelp";
import { Toast } from "./components/Toast";
import { useAppStore, Article } from "@/stores/useAppStore";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface ToastState {
  show: boolean;
  message: string;
  subMessage: string;
  type: "success" | "info" | "error";
}

function App() {
  const { theme, setTheme, updateSettings, selectedFeedId, filter } =
    useAppStore();
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showOPML, setShowOPML] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: "",
    subMessage: "",
    type: "info",
  });
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

  // Fetch total article count (without filter)
  const { data: totalCountData } = useQuery({
    queryKey: ["articles", "total-count"],
    queryFn: async () => {
      // Get total count by fetching with a large limit
      const allArticles = await api.articles.fetch({
        limit: 999999,
        offset: 0,
      });
      return allArticles.length;
    },
    staleTime: 30000, // 30 seconds
  });
  const totalCount = totalCountData || 0;

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

  const showToast = (
    message: string,
    subMessage: string,
    type: "success" | "info" | "error" = "info",
  ) => {
    setToast({ show: true, message, subMessage, type });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, show: false }));
  };

  const handleRefresh = async () => {
    if (isRefreshing) return; // Prevent double clicks
    setIsRefreshing(true);
    try {
      const result = await api.feeds.refreshAll();
      console.log(`Refreshed ${result.count} articles`);
      // Invalidate and refetch articles
      await queryClient.invalidateQueries({ queryKey: ["articles"] });

      // Show toast notification
      const newCount = result.count;
      const hasErrors = result.errors && result.errors.length > 0;

      if (hasErrors) {
        // Partial success - some feeds failed
        const errorCount = result.errors!.length;
        if (newCount > 0) {
          showToast(
            `Added ${newCount} new article${newCount > 1 ? "s" : ""}`,
            `${errorCount} feed${errorCount > 1 ? "s" : ""} failed to refresh`,
            "info",
          );
        } else {
          showToast(
            "No new articles",
            `${errorCount} feed${errorCount > 1 ? "s" : ""} failed to refresh`,
            "info",
          );
        }
      } else if (newCount > 0) {
        showToast(
          `Added ${newCount} new article${newCount > 1 ? "s" : ""}`,
          `Total ${totalCount + newCount} articles`,
          "success",
        );
      } else {
        showToast("No new articles", `Total ${totalCount} articles`, "info");
      }
    } catch (e) {
      console.error("Refresh failed:", e);
      showToast("Refresh failed", String(e), "error");
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

  const handleRefreshFeed = async (feedId: string) => {
    try {
      const result = await api.feeds.refresh(feedId);
      await queryClient.invalidateQueries({ queryKey: ["articles"] });

      const newCount = result.count;
      if (newCount > 0) {
        showToast(
          `Added ${newCount} new article${newCount > 1 ? "s" : ""}`,
          `Total ${totalCount + newCount} articles`,
          "success",
        );
      } else {
        showToast("No new articles", `Total ${totalCount} articles`, "info");
      }
      return result;
    } catch (e) {
      console.error("Failed to refresh feed:", e);
      showToast("Failed to refresh feed", String(e), "error");
      throw e;
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
          onRefreshFeed={handleRefreshFeed}
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

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        subMessage={toast.subMessage}
        type={toast.type}
        isVisible={toast.show}
        onClose={hideToast}
        duration={3000}
      />
    </div>
  );
}

export default App;
