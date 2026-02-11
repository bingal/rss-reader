import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/stores/useAppStore";
import { cn } from "@/lib/utils";
import { Icon } from "@iconify-icon/react";
import { api } from "@/lib/api";

// Extract domain from URL to use as default feed name
function extractDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return "New Feed";
  }
}

interface ContextMenuState {
  show: boolean;
  x: number;
  y: number;
  feedId: string | null;
  feedTitle: string;
  isAllFeeds: boolean;
}

interface SidebarProps {
  onShowOPML: () => void;
  onShowSettings: () => void;
  onRefresh: () => void;
  onToggleTheme: () => void;
  isRefreshing: boolean;
  onRefreshFeed?: (
    feedId: string,
    feedName: string,
  ) => Promise<{ count: number }>;
}

export function Sidebar({
  onShowOPML,
  onShowSettings,
  onRefresh,
  onToggleTheme,
  isRefreshing,
  onRefreshFeed,
}: SidebarProps) {
  const { feeds, setFeeds, selectedFeedId, setSelectedFeedId, theme } =
    useAppStore();
  const [newFeedUrl, setNewFeedUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingFeed, setEditingFeed] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    show: false,
    x: 0,
    y: 0,
    feedId: null,
    feedTitle: "",
    isAllFeeds: false,
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    feedId: string;
    feedTitle: string;
  } | null>(null);
  const queryClient = useQueryClient();
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const { data: feedsData, isLoading } = useQuery({
    queryKey: ["feeds"],
    queryFn: async () => {
      const result = await api.feeds.getAll();
      return result;
    },
  });

  useEffect(() => {
    if (feedsData) {
      setFeeds(feedsData);
    }
  }, [feedsData, setFeeds]);

  // Close context menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target as Node)
      ) {
        setContextMenu((prev) => ({ ...prev, show: false }));
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addFeedMutation = useMutation({
    mutationFn: async (url: string) => {
      const title = extractDomainFromUrl(url);
      await api.feeds.add({
        title,
        url,
        description: undefined,
        category: undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feeds"] });
      setIsAdding(false);
      setNewFeedUrl("");
    },
  });

  const deleteFeedMutation = useMutation({
    mutationFn: async (feedId: string) => {
      await api.feeds.delete(feedId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feeds"] });
      if (selectedFeedId === deleteConfirm?.feedId) {
        setSelectedFeedId(null);
      }
      setDeleteConfirm(null);
    },
  });

  const refreshFeedMutation = useMutation({
    mutationFn: async ({
      feedId,
      feedName,
    }: {
      feedId: string;
      feedName: string;
    }) => {
      if (onRefreshFeed) {
        return await onRefreshFeed(feedId, feedName);
      } else {
        const result = await api.feeds.refresh(feedId);
        return result;
      }
    },
    onSuccess: () => {
      setContextMenu((prev) => ({ ...prev, show: false }));
    },
    onError: () => {
      setContextMenu((prev) => ({ ...prev, show: false }));
    },
  });

  const renameFeedMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      // Get current feed data
      const feed = feeds.find((f) => f.id === id);
      if (!feed) throw new Error("Feed not found");

      // Delete and re-add with new title (simple approach)
      // In production, you'd want an update_feed command
      await api.feeds.delete(id);
      await api.feeds.add({
        title,
        url: feed.url,
        description: feed.description,
        category: feed.category,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feeds"] });
      setEditingFeed(null);
    },
  });

  const handleAddFeed = () => {
    if (newFeedUrl.trim()) {
      addFeedMutation.mutate(newFeedUrl.trim());
      setNewFeedUrl("");
    }
  };

  const handleContextMenu = (
    e: React.MouseEvent,
    feedId: string,
    feedTitle: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      feedId,
      feedTitle,
      isAllFeeds: false,
    });
  };

  const handleAllFeedsContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      feedId: null,
      feedTitle: "All Articles",
      isAllFeeds: true,
    });
  };

  const handleDeleteClick = () => {
    if (contextMenu.feedId) {
      setDeleteConfirm({
        show: true,
        feedId: contextMenu.feedId,
        feedTitle: contextMenu.feedTitle,
      });
      setContextMenu((prev) => ({ ...prev, show: false }));
    }
  };

  const handleRenameClick = () => {
    if (contextMenu.feedId) {
      setEditingFeed({
        id: contextMenu.feedId,
        title: contextMenu.feedTitle,
      });
      setContextMenu((prev) => ({ ...prev, show: false }));
    }
  };

  const handleRefreshFeedClick = () => {
    if (contextMenu.feedId) {
      refreshFeedMutation.mutate({
        feedId: contextMenu.feedId,
        feedName: contextMenu.feedTitle,
      });
    }
  };

  const handleRefreshAllClick = () => {
    setContextMenu((prev) => ({ ...prev, show: false }));
    onRefresh();
  };

  return (
    <div className="w-64 bg-muted/30 border-r border-border flex flex-col h-full">
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
              onContextMenu={handleAllFeedsContextMenu}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
                selectedFeedId === null
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted",
              )}
            >
              <Icon
                icon="mdi:newspaper-variant-multiple"
                className="text-base"
              />
              All Articles
            </button>

            {/* Individual feeds */}
            {feeds.map((feed) => (
              <div key={feed.id} className="relative">
                {editingFeed?.id === feed.id ? (
                  <div className="px-2 py-1">
                    <input
                      type="text"
                      value={editingFeed.title}
                      onChange={(e) =>
                        setEditingFeed({
                          ...editingFeed,
                          title: e.target.value,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          renameFeedMutation.mutate({
                            id: feed.id,
                            title: editingFeed.title,
                          });
                        } else if (e.key === "Escape") {
                          setEditingFeed(null);
                        }
                      }}
                      onBlur={() => setEditingFeed(null)}
                      className="w-full px-2 py-1 text-sm border border-input rounded bg-background"
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedFeedId(feed.id)}
                    onContextMenu={(e) =>
                      handleContextMenu(e, feed.id, feed.title)
                    }
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm transition-colors truncate",
                      selectedFeedId === feed.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted",
                    )}
                  >
                    {feed.title}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom action buttons */}
      <div className="p-2 border-t border-border">
        <div className="flex items-center justify-around gap-1">
          <button
            onClick={() => setIsAdding(true)}
            className="p-2 rounded hover:bg-muted transition-colors flex-1 flex items-center justify-center"
            title="Add Feed"
          >
            <Icon icon="mdi:plus" className="text-xl" />
          </button>

          <button
            onClick={onShowOPML}
            className="p-2 rounded hover:bg-muted transition-colors flex-1 flex items-center justify-center"
            title="Import/Export OPML"
          >
            <Icon icon="mdi:database-import" className="text-xl" />
          </button>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded hover:bg-muted transition-colors flex-1 flex items-center justify-center disabled:opacity-50"
            title="Refresh (R)"
          >
            {isRefreshing ? (
              <Icon icon="mdi:loading" className="text-xl animate-spin" />
            ) : (
              <Icon icon="mdi:refresh" className="text-xl" />
            )}
          </button>

          <button
            onClick={onToggleTheme}
            className="p-2 rounded hover:bg-muted transition-colors flex-1 flex items-center justify-center"
            title="Toggle Theme (M)"
          >
            {theme === "dark" ? (
              <Icon icon="mdi:white-balance-sunny" className="text-xl" />
            ) : (
              <Icon icon="mdi:moon-waning-crescent" className="text-xl" />
            )}
          </button>

          <button
            onClick={onShowSettings}
            className="p-2 rounded hover:bg-muted transition-colors flex-1 flex items-center justify-center"
            title="Settings"
          >
            <Icon icon="mdi:cog" className="text-xl" />
          </button>
        </div>
      </div>

      {/* Add feed modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md border border-border">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold">Add RSS Feed</h2>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewFeedUrl("");
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <Icon icon="mdi:close" className="text-xl" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter the URL of the RSS feed you want to subscribe to.
              </p>

              <input
                type="url"
                placeholder="https://example.com/feed.xml"
                value={newFeedUrl}
                onChange={(e) => setNewFeedUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFeedUrl.trim()) {
                    handleAddFeed();
                  } else if (e.key === "Escape") {
                    setIsAdding(false);
                    setNewFeedUrl("");
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-input rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />

              {addFeedMutation.isError && (
                <div className="p-3 rounded text-sm bg-destructive/10 text-destructive">
                  Failed to add feed. Please check the URL and try again.
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setNewFeedUrl("");
                  }}
                  className="px-4 py-2 text-sm bg-muted rounded hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddFeed}
                  disabled={!newFeedUrl.trim() || addFeedMutation.isPending}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                >
                  {addFeedMutation.isPending ? "Adding..." : "Add Feed"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.show && (
        <div
          ref={contextMenuRef}
          className="fixed bg-background border border-border rounded-md shadow-lg py-1 z-50 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.isAllFeeds ? (
            // All Articles context menu
            <button
              onClick={handleRefreshAllClick}
              disabled={isRefreshing}
              className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 disabled:opacity-50"
            >
              {isRefreshing ? (
                <Icon icon="mdi:loading" className="text-sm animate-spin" />
              ) : (
                <Icon icon="mdi:refresh" className="text-sm" />
              )}
              {isRefreshing ? "Refreshing..." : "Refresh All"}
            </button>
          ) : (
            // Individual feed context menu
            <>
              <button
                onClick={handleRefreshFeedClick}
                disabled={refreshFeedMutation.isPending}
                className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 disabled:opacity-50"
              >
                {refreshFeedMutation.isPending ? (
                  <Icon icon="mdi:loading" className="text-sm animate-spin" />
                ) : (
                  <Icon icon="mdi:refresh" className="text-sm" />
                )}
                {refreshFeedMutation.isPending ? "Refreshing..." : "Refresh"}
              </button>
              <div className="h-px bg-border mx-2 my-1" />
              <button
                onClick={handleRenameClick}
                className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
              >
                <Icon icon="mdi:pencil" className="text-sm" />
                Rename
              </button>
              <button
                onClick={handleDeleteClick}
                className="w-full px-3 py-2 text-sm text-left hover:bg-muted text-destructive flex items-center gap-2"
              >
                <Icon icon="mdi:delete" className="text-sm" />
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm?.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-sm border border-border p-4">
            <h3 className="text-lg font-semibold mb-2">Delete Feed</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete &quot;{deleteConfirm.feedTitle}
              &quot;? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-sm bg-muted rounded hover:bg-muted/80"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteFeedMutation.mutate(deleteConfirm.feedId)}
                disabled={deleteFeedMutation.isPending}
                className="px-3 py-1.5 text-sm bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleteFeedMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
