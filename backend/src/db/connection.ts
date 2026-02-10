import { Database } from "bun:sqlite";
import { join } from "path";
import { homedir } from "os";
import { mkdirSync, existsSync } from "fs";

let db: Database | null = null;
let lastError: Error | null = null;
let isInitializing = false;

/**
 * Get database directory path
 * Uses ~/.rss-reader/ to avoid macOS permission issues with Library/Application Support
 */
function getDbDir(): string {
  // Use hidden folder in home directory to avoid permission issues
  const dataDir = join(homedir(), ".rss-reader");

  if (!existsSync(dataDir)) {
    try {
      mkdirSync(dataDir, { recursive: true });
      console.log("[DB] Created data directory:", dataDir);
    } catch (error: any) {
      console.error("[DB] Failed to create data directory:", error.message);
      throw error;
    }
  }

  return dataDir;
}

function getDbPath(): string {
  return join(getDbDir(), "data.db");
}

export function initializeDatabase(): boolean {
  // Prevent concurrent initialization attempts
  if (isInitializing) {
    console.log("[DB] Initialization already in progress...");
    return false;
  }

  // If already initialized successfully, no need to reinitialize
  if (db && !lastError) {
    return true;
  }

  isInitializing = true;
  console.log("[DB] Starting database initialization...");

  try {
    // Close existing connection if any
    if (db) {
      try {
        db.close();
      } catch {
        // Ignore close errors
      }
      db = null;
    }

    const dbPath = getDbPath();
    console.log("[DB] Opening database at:", dbPath);

    db = new Database(dbPath, { create: true });
    db.exec("PRAGMA journal_mode = WAL");
    initializeSchema(db);

    lastError = null;
    console.log("[DB] Database initialized successfully");
    return true;
  } catch (error: any) {
    lastError = error;
    console.error("[DB] Failed to initialize database:", error.message);
    db = null;
    return false;
  } finally {
    isInitializing = false;
  }
}

export function getDatabase(): Database {
  // Try to initialize if not ready
  if (!db || lastError) {
    const success = initializeDatabase();
    if (!success || !db) {
      throw lastError || new Error("Database not initialized");
    }
  }
  return db;
}

export function resetDatabase(): void {
  console.log("[DB] Resetting database connection...");
  if (db) {
    try {
      db.close();
    } catch {
      // Ignore close errors
    }
    db = null;
  }
  lastError = null;
  isInitializing = false;
}

export function getDatabaseStatus(): {
  initialized: boolean;
  error: string | null;
  isInitializing: boolean;
  dbPath: string;
} {
  return {
    initialized: db !== null && lastError === null,
    error: lastError?.message || null,
    isInitializing,
    dbPath: getDbPath(),
  };
}

function initializeSchema(database: Database): void {
  // Create feeds table
  database.exec(`
    CREATE TABLE IF NOT EXISTS feeds (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      description TEXT,
      image_url TEXT,
      category TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )
  `);

  // Create articles table
  database.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      feed_id TEXT NOT NULL,
      title TEXT NOT NULL,
      link TEXT NOT NULL,
      content TEXT,
      summary TEXT,
      author TEXT,
      pub_date INTEGER,
      is_read INTEGER DEFAULT 0,
      is_starred INTEGER DEFAULT 0,
      fetched_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (feed_id) REFERENCES feeds(id)
    )
  `);

  // Create settings table
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Create translations table
  database.exec(`
    CREATE TABLE IF NOT EXISTS translations (
      article_id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_articles_feed ON articles(feed_id);
    CREATE INDEX IF NOT EXISTS idx_articles_date ON articles(pub_date DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_starred ON articles(is_starred);
    CREATE INDEX IF NOT EXISTS idx_articles_read ON articles(is_read);
  `);
}

export function closeDatabase(): void {
  if (db) {
    try {
      db.close();
      console.log("[DB] Database connection closed");
    } catch {
      // Ignore close errors
    }
    db = null;
  }
  lastError = null;
  isInitializing = false;
}
