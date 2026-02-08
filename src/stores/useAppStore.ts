import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';
export type ArticleFilter = 'all' | 'unread' | 'starred';

export interface Feed {
  id: string;
  title: string;
  url: string;
  description?: string;
  imageUrl?: string;
  category?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Article {
  id: string;
  feedId: string;
  title: string;
  link: string;
  content: string;
  summary?: string;
  author?: string;
  pubDate: number;
  isRead: number;
  isStarred: number;
  fetchedAt: number;
}

interface AppState {
  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;
  
  // Selected feed
  selectedFeedId: string | null;
  setSelectedFeedId: (id: string | null) => void;
  
  // Filter
  filter: ArticleFilter;
  setFilter: (filter: ArticleFilter) => void;
  
  // View mode
  isSettingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  
  // Articles
  readArticleIds: Set<string>;
  markArticleAsRead: (id: string) => void;
  isArticleRead: (id: string) => boolean;
  
  // Feeds
  feeds: Feed[];
  setFeeds: (feeds: Feed[]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Theme
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      
      // Selected feed
      selectedFeedId: null,
      setSelectedFeedId: (id) => set({ selectedFeedId: id, filter: 'all' }),
      
      // Filter
      filter: 'all',
      setFilter: (filter) => set({ filter }),
      
      // View mode
      isSettingsOpen: false,
      setSettingsOpen: (open) => set({ isSettingsOpen: open }),
      
      // Articles
      readArticleIds: new Set(),
      markArticleAsRead: (id) =>
        set((state) => ({
          readArticleIds: new Set([...state.readArticleIds, id]),
        })),
      isArticleRead: (id) => get().readArticleIds.has(id),
      
      // Feeds
      feeds: [],
      setFeeds: (feeds) => set({ feeds }),
    }),
    {
      name: 'rss-reader-storage',
      partialize: (state) => ({
        theme: state.theme,
        readArticleIds: Array.from(state.readArticleIds),
        feeds: state.feeds,
      }),
    }
  )
);

// Helper to sync readArticleIds from Array to Set when loading
export const syncReadArticles = () => {
  const state = useAppStore.getState();
  if (Array.isArray(state.readArticleIds)) {
    useAppStore.setState({
      readArticleIds: new Set(state.readArticleIds as unknown as string[]),
    });
  }
};
