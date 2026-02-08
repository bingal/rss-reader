import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore, Feed } from "@/stores/useAppStore";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { feeds, setFeeds, selectedFeedId, setSelectedFeedId } = useAppStore();
  const [newFeedUrl, setNewFeedUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const queryClient = useQueryClient();

  const { data: feedsData, isLoading } = useQuery({
    queryKey: ["feeds"],
    queryFn: async () => {
      const result = await invoke<Feed[]>("get_all_feeds");
      return result;
    },
  });

  useEffect(() => {
    if (feedsData) {
      setFeeds(feedsData);
    }
  }, [feedsData, setFeeds]);

  const addFeedMutation = useMutation({
    mutationFn: async (url: string) => {
      const title = "New Feed";
      await invoke<Feed>("add_new_feed", {
        title,
        url,
        description: null,
        category: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feeds"] });
      setIsAdding(false);
      setNewFeedUrl("");
    },
  });

  const handleAddFeed = () => {
    if (newFeedUrl.trim()) {
      addFeedMutation.mutate(newFeedUrl.trim());
    }
  };

  return (
    <div className="w-64 bg-muted/30 border-r border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <span className="text-primary">📡</span> RSS Reader
        </h1>
      </div>

      {/* Feed list */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="text-sm text-muted-foreground p-2">
            Loading feeds...
          </div>
        ) : (
          <div className="space-y-1">
            {/* All feeds */}
            <button
              onClick={() => setSelectedFeedId(null)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                selectedFeedId === null
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted",
              )}
            >
              📰 All Articles
            </button>

            {/* Individual feeds */}
            {feeds.map((feed) => (
              <button
                key={feed.id}
                onClick={() => setSelectedFeedId(feed.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm transition-colors truncate",
                  selectedFeedId === feed.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted",
                )}
              >
                {feed.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add feed */}
      <div className="p-2 border-t border-border">
        {isAdding ? (
          <div className="p-2 space-y-2">
            <input
              type="url"
              placeholder="RSS Feed URL"
              value={newFeedUrl}
              onChange={(e) => setNewFeedUrl(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-input rounded bg-background"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddFeed}
                disabled={!newFeedUrl.trim()}
                className="flex-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="px-2 py-1 text-xs bg-muted rounded hover:bg-muted/80"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors flex items-center gap-2"
          >
            <span>+</span> Add Feed
          </button>
        )}
      </div>
    </div>
  );
}
