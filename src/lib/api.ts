// Frontend API client using ElectroBun RPC
// Only uses typed RPC - no HTTP fallback

import type { Feed, Article, ArticleFilter } from "../shared/types";

// Get ElectroBun RPC instance - any type to avoid complex type issues
let rpcPromise: Promise<any> | null = null;

async function getRPC(): Promise<any> {
  if (!rpcPromise) {
    rpcPromise = (async () => {
      try {
        // Dynamic import - only works in ElectroBun environment
        const { createRPC } = await import("electrobun/view");
        
        // Create RPC client
        const rpc = createRPC();
        console.log("[API] ElectroBun RPC connected");
        return rpc;
      } catch (error) {
        console.error("[API] Failed to initialize ElectroBun RPC:", error);
        return null;
      }
    })();
  }
  return rpcPromise;
}

// API client - uses ElectroBun RPC
export const api = {
  feeds: {
    getAll: async (): Promise<Feed[]> => {
      const rpc = await getRPC();
      if (!rpc) throw new Error("RPC not available");
      return await rpc["feeds:getAll"]();
    },

    add: async (data: { title: string; url: string; description?: string; category?: string }): Promise<Feed> => {
      const rpc = await getRPC();
      if (!rpc) throw new Error("RPC not available");
      return await rpc["feeds:add"](data);
    },

    delete: async (id: string): Promise<void> => {
      const rpc = await getRPC();
      if (!rpc) throw new Error("RPC not available");
      return await rpc["feeds:delete"]({ id });
    },

    refresh: async (id: string) => {
      const rpc = await getRPC();
      if (!rpc) throw new Error("RPC not available");
      return await rpc["feeds:refresh"]({ id });
    },

    refreshAll: async () => {
      const rpc = await getRPC();
      if (!rpc) throw new Error("RPC not available");
      return await rpc["feeds:refreshAll"]();
    },
  },

  articles: {
    fetch: async (params: { feedId?: string; filter?: ArticleFilter; limit?: number; offset?: number }): Promise<Article[]> => {
      const rpc = await getRPC();
      if (!rpc) throw new Error("RPC not available");
      return await rpc["articles:fetch"](params);
    },

    markRead: async (id: string, read: boolean): Promise<void> => {
      const rpc = await getRPC();
      if (!rpc) throw new Error("RPC not available");
      return await rpc["articles:markRead"]({ id, read });
    },

    toggleStarred: async (id: string, starred: boolean): Promise<void> => {
      const rpc = await getRPC();
      if (!rpc) throw new Error("RPC not available");
      return await rpc["articles:toggleStarred"]({ id, starred });
    },
  },

  settings: {
    get: async (key: string): Promise<{ value: string | null }> => {
      const rpc = await getRPC();
      if (!rpc) throw new Error("RPC not available");
      return await rpc["settings:get"]({ key });
    },

    set: async (key: string, value: string): Promise<void> => {
      const rpc = await getRPC();
      if (!rpc) throw new Error("RPC not available");
      return await rpc["settings:set"]({ key, value });
    },
  },

  translation: {
    translate: async (text: string, targetLang: string = "zh"): Promise<{ translatedText: string }> => {
      const rpc = await getRPC();
      if (!rpc) throw new Error("RPC not available");
      return await rpc["translation:translate"]({ text, targetLang });
    },

    save: async (articleId: string, content: string): Promise<void> => {
      const rpc = await getRPC();
      if (!rpc) throw new Error("RPC not available");
      return await rpc["translation:save"]({ articleId, content });
    },

    get: async (articleId: string): Promise<{ content: string | null }> => {
      const rpc = await getRPC();
      if (!rpc) throw new Error("RPC not available");
      return await rpc["translation:get"]({ articleId });
    },
  },
};

export type { Feed, Article, ArticleFilter };
