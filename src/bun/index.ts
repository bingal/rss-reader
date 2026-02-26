import { BrowserWindow } from "electrobun/bun";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import feedsRouter from "../../backend/src/routes/feeds";
import articlesRouter from "../../backend/src/routes/articles";
import settingsRouter from "../../backend/src/routes/settings";
import translationRouter from "../../backend/src/routes/translation";
import { initializeDatabase, getDatabaseStatus } from "../../backend/src/db/connection";

// Initialize database first
console.log("[Server] Initializing database...");
initializeDatabase();

// Create Hono app for HTTP API
const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());

// Health check
app.get("/health", (c) =>
  c.json({
    status: "ok",
    timestamp: Date.now(),
    database: getDatabaseStatus(),
  }),
);

// API routes
app.route("/api/feeds", feedsRouter);
app.route("/api/articles", articlesRouter);
app.route("/api/settings", settingsRouter);
app.route("/api/translate", translationRouter);
app.route("/api/translations", translationRouter);

// Start HTTP server on fixed port
const SERVER_PORT = 3456;
const server = Bun.serve({
  port: SERVER_PORT,
  fetch: app.fetch,
  development: process.env.NODE_ENV !== "production",
});

console.log(`🚀 RSS Reader Backend is running on http://localhost:${server.port}`);

// Determine the frontend URL
const isDev = process.env.NODE_ENV !== "production";
const frontendUrl = isDev 
  ? "http://localhost:5173"  // Vite default dev port
  : "http://localhost:4173";  // Vite preview port

console.log(`[Electrobun] Opening RSS Reader at ${frontendUrl}`);

// Create and open the window
new BrowserWindow({
  title: "RSS Reader",
  url: frontendUrl,
});

console.log(`[Electrobun] Window opened`);

// Global error handlers
process.on("uncaughtException", (error) => {
  console.error("[Server] Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Server] Unhandled Rejection at:", promise, "reason:", reason);
});
