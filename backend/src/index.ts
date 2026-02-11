import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { dbRetryMiddleware } from "@/middleware/dbRetry";
import { initializeDatabase, getDatabaseStatus } from "@/db/connection";
import feedsRouter from "./routes/feeds";
import articlesRouter from "./routes/articles";
import settingsRouter from "./routes/settings";
import translationRouter from "./routes/translation";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());

// Health check - no database required
app.get("/health", (c) =>
  c.json({
    status: "ok",
    timestamp: Date.now(),
    database: getDatabaseStatus(),
  }),
);

// Try to initialize database on startup (but don't block if it fails)
console.log("[Server] Attempting initial database setup...");
initializeDatabase();

// Database retry middleware - ensures database is ready for API routes
app.use("/api/*", dbRetryMiddleware);

// API routes
app.route("/api/feeds", feedsRouter);
app.route("/api/articles", articlesRouter);
app.route("/api/settings", settingsRouter);
app.route("/api/translate", translationRouter);
app.route("/api/translations", translationRouter);

// Get port from args or use random port
const args = Bun.argv.slice(2);
const portArg = args.find((arg) => arg.startsWith("--port="));
const port = portArg ? parseInt(portArg.split("=")[1]) : 0;

// Start server
const server = Bun.serve({
  port,
  fetch: app.fetch,
  development: process.env.NODE_ENV !== "production",
});

console.log(
  `🚀 RSS Reader Backend is running on http://localhost:${server.port}`,
);

// Write port to stdout for Tauri to read
if (port === 0) {
  console.log(`PORT:${server.port}`);
}

// Global error handlers to prevent crashes
process.on("uncaughtException", (error) => {
  console.error("[Server] Uncaught Exception:", error);
  // Don't exit - keep the server running
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Server] Unhandled Rejection at:", promise, "reason:", reason);
  // Don't exit - keep the server running
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down gracefully...");
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n👋 Shutting down gracefully...");
  server.stop();
  process.exit(0);
});
