import type { MiddlewareHandler } from "hono";
import { getDatabaseStatus, initializeDatabase } from "@/db/connection";

/**
 * Hono middleware to ensure database is initialized before handling requests
 * If database is not ready, it will try to initialize it
 */
export const dbRetryMiddleware: MiddlewareHandler = async (c, next) => {
  const status = getDatabaseStatus();

  // If not initialized and not currently initializing, try to initialize
  if (!status.initialized && !status.isInitializing) {
    console.log(
      "[DB Middleware] Database not ready, attempting initialization...",
    );
    const success = initializeDatabase();

    if (!success) {
      console.error("[DB Middleware] Failed to initialize database");
      // Return 503 Service Unavailable with helpful message
      return c.json(
        {
          error: "Database not available",
          message:
            "Please grant the application permission to access Application Support folder and try again",
          code: "DB_NOT_INITIALIZED",
        },
        503,
      );
    }
  }

  // If currently initializing, return 503
  if (status.isInitializing) {
    return c.json(
      {
        error: "Database is initializing",
        message: "Please wait a moment and try again",
        code: "DB_INITIALIZING",
      },
      503,
    );
  }

  await next();
};
