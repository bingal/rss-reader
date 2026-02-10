import { Database } from "bun:sqlite";
import { join } from "path";
import { homedir } from "os";
import { mkdirSync, existsSync } from "fs";

let db: Database | null = null;
let initError: Error | null = null;

function getDbPath(): string {
  const dataDir = join(
    homedir(),
    "Library",
    "Application Support",
    "rss-reader",
  );

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  return join(dataDir, "data.db");
}

export function getDatabase(): Database {
  // If there was a previous error, try to reinitialize
  if (db && initError) {
    console.log(
      "[DB] Previous init error detected, attempting to reinitialize...",
    );
    closeDatabase();
  }

  if (!db) {
    try {
      const dbPath = getDbPath();
      console.log("[DB] Initializing database at:", dbPath);
      db = new Database(dbPath, { create: true });
      db.exec("PRAGMA journal_mode = WAL");
      initializeSchema(db);
      initError = null;
      console.log("[DB] Database initialized successfully");
    } catch (error: any) {
      initError = error;
      console.error("[DB] Failed to initialize database:", error.message);
      throw error;
    }
  }
  return db;
}

export function resetDatabase(): void {
  console.log("[DB] Resetting database connection...");
  closeDatabase();
  initError = null;
}

export function getDatabaseStatus(): {
  initialized: boolean;
  error: string | null;
} {
  return {
    initialized: db !== null && initError === null,
    error: initError?.message || null,
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
    } catch (error) {
      console.error("[DB] Error closing database:", error);
    }
    db = null;
  }
}
