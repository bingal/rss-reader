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

interface RefreshProgress {
  current: number;
  total: number;
  feedName: string;
  status: "refreshing" | "success" | "error" | "idle";
  message: string;
}

function App() {
  const { theme, setTheme, updateSettings, selectedFeedId, filter } =
    useAppStore();
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showOPML, setShowOPML] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const queryClient = useQueryClient();

  // Refresh progress state
  const [progress, setProgress] = useState<RefreshProgress>({
    current: 0,
    total: 0,
    feedName: "",
    status: "idle",
    message: "",
  });

  const isRefreshing = progress.status === "refreshing";

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

  // Fetch all feeds
  const { data: feedsData } = useQuery({
    queryKey: ["feeds"],
    queryFn: async () => {
      return await api.feeds.getAll();
    },
  });
  const feeds = feedsData || [];

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
    if (isRefreshing || feeds.length === 0) return;

    const total = feeds.length;
    let successCount = 0;
    let errorCount = 0;
    let totalNewArticles = 0;
    const errors: string[] = [];

    setProgress({
      current: 0,
      total,
      feedName: "",
      status: "refreshing",
      message: `Starting refresh of ${total} feeds...`,
    });

    for (let i = 0; i < feeds.length; i++) {
      const feed = feeds[i];
      const currentNum = i + 1;

      setProgress({
        current: currentNum,
        total,
        feedName: feed.title,
        status: "refreshing",
        message: `(${currentNum}/${total}) ${feed.title}`,
      });

      try {
        const result = await api.feeds.refresh(feed.id);

        if (result.success) {
          successCount++;
          totalNewArticles += result.count;
          setProgress({
            current: currentNum,
            total,
            feedName: feed.title,
            status: "refreshing",
            message: `(${currentNum}/${total}) ${feed.title} - ${result.count} new`,
          });
        } else {
          errorCount++;
          errors.push(feed.title);
          setProgress({
            current: currentNum,
            total,
            feedName: feed.title,
            status: "refreshing",
            message: `(${currentNum}/${total}) ${feed.title} - Failed`,
          });
        }
      } catch (error: any) {
        errorCount++;
        errors.push(feed.title);
        setProgress({
          current: currentNum,
          total,
          feedName: feed.title,
          status: "refreshing",
          message: `(${currentNum}/${total}) ${feed.title} - Error`,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await queryClient.invalidateQueries({ queryKey: ["articles"] });

    const finalMessage =
      errorCount > 0
        ? `Done: ${totalNewArticles} new, ${errorCount} failed`
        : `Done: ${totalNewArticles} new articles`;

    setProgress({
      current: total,
      total,
      feedName: "",
      status: errorCount > 0 ? "error" : "success",
      message: finalMessage,
    });

    setTimeout(() => {
      setProgress({
        current: 0,
        total: 0,
        feedName: "",
        status: "idle",
        message: "",
      });
    }, 5000);
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

  const handleRefreshFeed = async (feedId: string, feedName?: string) => {
    const name = feedName || "Feed";

    setProgress({
      current: 1,
      total: 1,
      feedName: name,
      status: "refreshing",
      message: `Refreshing ${name}...`,
    });

    try {
      const result = await api.feeds.refresh(feedId);
      await queryClient.invalidateQueries({ queryKey: ["articles"] });

      if (result.success) {
        setProgress({
          current: 1,
          total: 1,
          feedName: name,
          status: "success",
          message: `${name}: ${result.count} new articles`,
        });
      } else {
        setProgress({
          current: 1,
          total: 1,
          feedName: name,
          status: "error",
          message: `${name}: Failed`,
        });
      }

      setTimeout(() => {
        setProgress({
          current: 0,
          total: 0,
          feedName: "",
          status: "idle",
          message: "",
        });
      }, 3000);

      return result;
    } catch (e) {
      setProgress({
        current: 1,
        total: 1,
        feedName: name,
        status: "error",
        message: `${name}: Error`,
      });

      setTimeout(() => {
        setProgress({
          current: 0,
          total: 0,
          feedName: "",
          status: "idle",
          message: "",
        });
      }, 3000);

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
      <footer className="h-6 flex items-center px-4 border-t border-border bg-muted/20 text-xs text-muted-foreground">
        <span>
          {articles.length} articles
          {selectedArticle && " • Selected"}
        </span>
        {progress.status !== "idle" && (
          <span className="ml-4 truncate">
            <span
              className={
                progress.status === "error"
                  ? "text-destructive"
                  : progress.status === "success"
                    ? "text-green-600"
                    : ""
              }
            >
              {progress.message}
            </span>
          </span>
        )}
        <div className="flex-1"></div>
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
