const API_BASE_URL = "http://localhost:3456";

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
  pubDate: number | null;
  isRead: number;
  isStarred: number;
  fetchedAt: number;
}

export type ArticleFilter = "all" | "unread" | "starred";

export const api = {
  feeds: {
    getAll: async (): Promise<Feed[]> => {
      const response = await fetch(`${API_BASE_URL}/api/feeds`);
      if (!response.ok) throw new Error("Failed to fetch feeds");
      return response.json();
    },

    add: async (data: {
      title: string;
      url: string;
      description?: string;
      category?: string;
    }): Promise<Feed> => {
      const response = await fetch(`${API_BASE_URL}/api/feeds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to add feed");
      return response.json();
    },

    delete: async (id: string): Promise<void> => {
      const response = await fetch(`${API_BASE_URL}/api/feeds/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete feed");
    },

    refresh: async (
      id: string,
    ): Promise<{
      success: boolean;
      count: number;
      total?: number;
      title?: string;
      error?: string;
    }> => {
      const response = await fetch(`${API_BASE_URL}/api/feeds/${id}/refresh`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          count: 0,
          error: data.error || "Failed to refresh feed",
        };
      }
      return { ...data, success: true };
    },

    refreshAll: async (): Promise<{ count: number; errors?: string[] }> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(`${API_BASE_URL}/api/feeds/refresh-all`, {
          method: "POST",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const data = await response.json();
        if (!response.ok) {
          if (data.code === "DB_NOT_INITIALIZED") {
            throw new Error(
              "Database permission required. Please grant access to Application Support folder and try again.",
            );
          }
          throw new Error(data.error || "Failed to refresh all feeds");
        }
        return data;
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === "AbortError") {
          throw new Error(
            "Refresh request timed out (30s). Some feeds may be slow to respond.",
          );
        }
        throw error;
      }
    },
  },

  articles: {
    fetch: async (params: {
      feedId?: string;
      filter?: ArticleFilter;
      limit?: number;
      offset?: number;
    }): Promise<Article[]> => {
      const queryParams = new URLSearchParams();
      if (params.feedId) queryParams.set("feedId", params.feedId);
      if (params.filter) queryParams.set("filter", params.filter);
      if (params.limit) queryParams.set("limit", params.limit.toString());
      if (params.offset) queryParams.set("offset", params.offset.toString());

      const response = await fetch(`${API_BASE_URL}/api/articles?${queryParams}`);
      if (!response.ok) throw new Error("Failed to fetch articles");
      return response.json();
    },

    markRead: async (id: string, read: boolean): Promise<void> => {
      const response = await fetch(`${API_BASE_URL}/api/articles/${id}/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read }),
      });
      if (!response.ok) throw new Error("Failed to mark article as read");
    },

    toggleStarred: async (id: string, starred: boolean): Promise<void> => {
      const response = await fetch(`${API_BASE_URL}/api/articles/${id}/starred`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred }),
      });
      if (!response.ok) throw new Error("Failed to toggle article star");
    },
  },

  settings: {
    get: async (key: string): Promise<{ value: string | null }> => {
      const response = await fetch(`${API_BASE_URL}/api/settings/${key}`);
      if (!response.ok) throw new Error("Failed to get setting");
      return response.json();
    },

    set: async (key: string, value: string): Promise<void> => {
      const response = await fetch(`${API_BASE_URL}/api/settings/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!response.ok) throw new Error("Failed to set setting");
    },
  },

  translation: {
    translate: async (
      text: string,
      targetLang: string = "zh",
    ): Promise<{ translatedText: string }> => {
      const response = await fetch(`${API_BASE_URL}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLang }),
      });
      if (!response.ok) throw new Error("Translation failed");
      return response.json();
    },

    save: async (articleId: string, content: string): Promise<void> => {
      const response = await fetch(`${API_BASE_URL}/api/translations/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, content }),
      });
      if (!response.ok) throw new Error("Failed to save translation");
    },

    get: async (articleId: string): Promise<{ content: string | null }> => {
      const response = await fetch(`${API_BASE_URL}/api/translations/${articleId}`);
      if (!response.ok) throw new Error("Failed to get translation");
      return response.json();
    },
  },
};
