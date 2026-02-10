import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore, Feed } from "@/stores/useAppStore";
import { cn } from "@/lib/utils";
import { Icon } from "@iconify-icon/react";

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
}

export function Sidebar() {
  const { feeds, setFeeds, selectedFeedId, setSelectedFeedId } = useAppStore();
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
      const result = await invoke<Feed[]>("get_all_feeds");
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

  const deleteFeedMutation = useMutation({
    mutationFn: async (feedId: string) => {
      await invoke("delete_feed", { id: feedId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feeds"] });
      if (selectedFeedId === deleteConfirm?.feedId) {
        setSelectedFeedId(null);
      }
      setDeleteConfirm(null);
    },
  });

  const renameFeedMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      // Get current feed data
      const feed = feeds.find((f) => f.id === id);
      if (!feed) throw new Error("Feed not found");

      // Delete and re-add with new title (simple approach)
      // In production, you'd want an update_feed command
      await invoke("delete_feed", { id });
      await invoke<Feed>("add_new_feed", {
        title,
        url: feed.url,
        description: feed.description || null,
        category: feed.category || null,
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
            <Icon icon="mdi:plus" className="text-base" /> Add Feed
          </button>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.show && (
        <div
          ref={contextMenuRef}
          className="fixed bg-background border border-border rounded-md shadow-lg py-1 z-50 min-w-[120px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
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
