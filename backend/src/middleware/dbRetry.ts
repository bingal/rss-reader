import type { MiddlewareHandler } from "hono";
import { resetDatabase, getDatabaseStatus } from "@/db/connection";

/**
 * Hono middleware to check database status and handle reinitialization
 * This should be used early in the middleware chain
 */
export const dbRetryMiddleware: MiddlewareHandler = async (_c, next) => {
  const status = getDatabaseStatus();

  // If database is not initialized, try to reset it
  if (!status.initialized) {
    console.log(
      "[DB Middleware] Database not initialized, attempting reset...",
    );
    try {
      resetDatabase();
      // Try to get database to verify it works
      const { getDatabase } = await import("@/db/connection");
      getDatabase();
      console.log("[DB Middleware] Database reinitialized successfully");
    } catch (error: any) {
      console.error(
        "[DB Middleware] Failed to reinitialize database:",
        error.message,
      );
      // Continue to the route - it will fail with proper error message
    }
  }

  await next();
};
