import { BrowserWindow, defineElectrobunRPC } from "electrobun/bun";
import { initializeDatabase } from "../backend/db/connection";
import feedsHandlers from "../backend/routes/feeds";
import articlesHandlers from "../backend/routes/articles";
import settingsHandlers from "../backend/routes/settings";
import translationHandlers from "../backend/routes/translation";
import type { RSSReaderSchema } from "../shared/rpc-schema";

// Initialize database first
console.log("[Server] Initializing database...");
initializeDatabase();

// Create RPC with handlers
const rpc = defineElectrobunRPC<RSSReaderSchema, "bun">({
  handlers: {
    requests: {
      // Feeds
      "feeds:getAll": async () => feedsHandlers.getAll(),
      "feeds:add": async (params) => feedsHandlers.add(params),
      "feeds:delete": async (params) => feedsHandlers.deleteFeed(params),
      "feeds:refresh": async (params) => feedsHandlers.refresh(params),
      "feeds:refreshAll": async () => feedsHandlers.refreshAll(),

      // Articles
      "articles:fetch": async (params) => articlesHandlers.fetch(params),
      "articles:markRead": async (params) => articlesHandlers.markRead(params),
      "articles:toggleStarred": async (params) =>
        articlesHandlers.toggleStarred(params),

      // Settings
      "settings:get": async (params) => settingsHandlers.get(params),
      "settings:set": async (params) => settingsHandlers.set(params),

      // Translation
      "translation:translate": async (params) =>
        translationHandlers.translate(params),
      "translation:save": async (params) => translationHandlers.save(params),
      "translation:get": async (params) => translationHandlers.get(params),
    },
  },
});

console.log("[RPC] RSS Reader RPC handlers registered");

// Determine the frontend URL
const isDev = process.env.NODE_ENV !== "production";
const frontendUrl = isDev ? "http://localhost:5173" : "http://localhost:4173";

console.log(`[Electrobun] Opening RSS Reader at ${frontendUrl}`);

// Create and open the window with RPC
new BrowserWindow({
  title: "RSS Reader",
  url: frontendUrl,
  rpc: rpc,
});

console.log(`[Electrobun] Window opened with RPC enabled`);

// Global error handlers
process.on("uncaughtException", (error) => {
  console.error("[Server] Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Server] Unhandled Rejection at:", promise, "reason:", reason);
});
