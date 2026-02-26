// Frontend API client using ElectroBun RPC
// Uses typed RPC when available, falls back to HTTP

import type { Feed, Article, ArticleFilter } from "../shared/types";
import type { RSSReaderSchema } from "../shared/rpc-schema";

// Try to get ElectroBun RPC, otherwise use HTTP fallback
let rpcPromise: Promise<any> | null = null;

async function getRPC() {
  if (!rpcPromise) {
    rpcPromise = (async () => {
      try {
        // Dynamic import - only works in ElectroBun environment
        const { createRPC } = await import("electrobun/view");
        
        // Create RPC client with the same schema
        const rpc = createRPC<RSSReaderSchema>();
        return rpc;
      } catch (error) {
        console.warn("[API] ElectroBun RPC not available, using HTTP fallback");
        return null;
      }
    })();
  }
  return rpcPromise;
}

// HTTP fallback
const API_BASE = "http://localhost:3456";

const api = {
  feeds: {
    getAll: async (): Promise<Feed[]> => {
      const rpc = await getRPC();
      if (rpc) {
        return await rpc["feeds:getAll"]();
      }
      // Fallback
      const response = await fetch(`${API_BASE}/api/feeds`);
      if (!response.ok) throw new Error("Failed to fetch feeds");
      return response.json();
    },

    add: async (data: { title: string; url: string; description?: string; category?: string }): Promise<Feed> => {
      const rpc = await getRPC();
      if (rpc) {
        return await rpc["feeds:add"](data);
      }
      const response = await fetch(`${API_BASE}/api/feeds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to add feed");
      return response.json();
    },

    delete: async (id: string): Promise<void> => {
      const rpc = await getRPC();
      if (rpc) {
        return await rpc["feeds:delete"]({ id });
      }
      const response = await fetch(`${API_BASE}/api/feeds/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete feed");
    },

    refresh: async (id: string) => {
      const rpc = await getRPC();
      if (rpc) {
        return await rpc["feeds:refresh"]({ id });
      }
      const response = await fetch(`${API_BASE}/api/feeds/${id}/refresh`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, count: 0, error: data.error || "Failed to refresh feed" };
      }
      return { ...data, success: true };
    },

    refreshAll: async () => {
      const rpc = await getRPC();
      if (rpc) {
        return await rpc["feeds:refreshAll"]();
      }
      const response = await fetch(`${API_BASE}/api/feeds/refresh-all`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to refresh all feeds");
      }
      return data;
    },
  },

  articles: {
    fetch: async (params: { feedId?: string; filter?: ArticleFilter; limit?: number; offset?: number }): Promise<Article[]> => {
      const rpc = await getRPC();
      if (rpc) {
        return await rpc["articles:fetch"](params);
      }
      const queryParams = new URLSearchParams();
      if (params.feedId) queryParams.set("feedId", params.feedId);
      if (params.filter) queryParams.set("filter", params.filter);
      if (params.limit) queryParams.set("limit", params.limit.toString());
      if (params.offset) queryParams.set("offset", params.offset.toString());
      const response = await fetch(`${API_BASE}/api/articles?${queryParams}`);
      if (!response.ok) throw new Error("Failed to fetch articles");
      return response.json();
    },

    markRead: async (id: string, read: boolean): Promise<void> => {
      const rpc = await getRPC();
      if (rpc) {
        return await rpc["articles:markRead"]({ id, read });
      }
      const response = await fetch(`${API_BASE}/api/articles/${id}/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read }),
      });
      if (!response.ok) throw new Error("Failed to mark article as read");
    },

    toggleStarred: async (id: string, starred: boolean): Promise<void> => {
      const rpc = await getRPC();
      if (rpc) {
        return await rpc["articles:toggleStarred"]({ id, starred });
      }
      const response = await fetch(`${API_BASE}/api/articles/${id}/starred`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred }),
      });
      if (!response.ok) throw new Error("Failed to toggle article star");
    },
  },

  settings: {
    get: async (key: string): Promise<{ value: string | null }> => {
      const rpc = await getRPC();
      if (rpc) {
        return await rpc["settings:get"]({ key });
      }
      const response = await fetch(`${API_BASE}/api/settings/${key}`);
      if (!response.ok) throw new Error("Failed to get setting");
      return response.json();
    },

    set: async (key: string, value: string): Promise<void> => {
      const rpc = await getRPC();
      if (rpc) {
        return await rpc["settings:set"]({ key, value });
      }
      const response = await fetch(`${API_BASE}/api/settings/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!response.ok) throw new Error("Failed to set setting");
    },
  },

  translation: {
    translate: async (text: string, targetLang: string = "zh"): Promise<{ translatedText: string }> => {
      const rpc = await getRPC();
      if (rpc) {
        return await rpc["translation:translate"]({ text, targetLang });
      }
      const response = await fetch(`${API_BASE}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLang }),
      });
      if (!response.ok) throw new Error("Translation failed");
      return response.json();
    },

    save: async (articleId: string, content: string): Promise<void> => {
      const rpc = await getRPC();
      if (rpc) {
        return await rpc["translation:save"]({ articleId, content });
      }
      const response = await fetch(`${API_BASE}/api/translations/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, content }),
      });
      if (!response.ok) throw new Error("Failed to save translation");
    },

    get: async (articleId: string): Promise<{ content: string | null }> => {
      const rpc = await getRPC();
      if (rpc) {
        return await rpc["translation:get"]({ articleId });
      }
      const response = await fetch(`${API_BASE}/api/translations/${articleId}`);
      if (!response.ok) throw new Error("Failed to get translation");
      return response.json();
    },
  },
};

export { api };
export type { Feed, Article, ArticleFilter };
