import { Hono } from "hono";
import { randomUUID } from "crypto";
import { getDatabase, resetDatabase, getDatabaseStatus } from "@/db/connection";
import { fetchFeed } from "@/services/rss";
import type { Feed } from "@/types";

const app = new Hono();

// GET /api/feeds/status - Check database status and try to reinitialize if needed
app.get("/status", (c) => {
  const status = getDatabaseStatus();

  // If not initialized, try to reset and initialize
  if (!status.initialized) {
    try {
      resetDatabase();
      getDatabase();
      return c.json({
        initialized: true,
        error: null,
        message: "Database reinitialized successfully",
        dbPath: status.dbPath,
      });
    } catch (error: any) {
      return c.json(
        {
          initialized: false,
          error: error.message,
          message: "Failed to reinitialize database",
          dbPath: status.dbPath,
        },
        500,
      );
    }
  }

  return c.json(status);
});

// GET /api/feeds - Get all feeds
app.get("/", (c) => {
  try {
    const db = getDatabase();
    const query = db.query(`
      SELECT id, title, url, description, image_url as imageUrl, category, created_at as createdAt, updated_at as updatedAt
      FROM feeds
      ORDER BY title
    `);
    const feeds = query.all() as Feed[];
    return c.json(feeds);
  } catch (error: any) {
    console.error("[Feeds] Failed to get feeds:", error.message);
    return c.json({ error: error.message || "Failed to get feeds" }, 500);
  }
});

// POST /api/feeds - Add new feed
app.post("/", async (c) => {
  const { title, url, description, category } = await c.req.json();

  try {
    const db = getDatabase();
    const id = randomUUID();
    const now = Math.floor(Date.now() / 1000);

    const query = db.query(`
      INSERT INTO feeds (id, title, url, description, category, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    query.run(id, title, url, description || null, category || null, now, now);

    const feed: Feed = {
      id,
      title,
      url,
      description,
      category,
      createdAt: now,
      updatedAt: now,
    };

    return c.json(feed, 201);
  } catch (error: any) {
    console.error("[Feeds] Failed to add feed:", error.message);
    return c.json({ error: error.message || "Failed to add feed" }, 400);
  }
});

// DELETE /api/feeds/:id - Delete feed
app.delete("/:id", (c) => {
  const { id } = c.req.param();

  try {
    const db = getDatabase();

    // Delete articles first
    db.query("DELETE FROM articles WHERE feed_id = ?").run(id);

    // Delete feed
    const result = db.query("DELETE FROM feeds WHERE id = ?").run(id);

    if (result.changes === 0) {
      return c.json({ error: "Feed not found" }, 404);
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error("[Feeds] Failed to delete feed:", error.message);
    return c.json({ error: error.message || "Failed to delete feed" }, 400);
  }
});

// POST /api/feeds/:id/refresh - Refresh specific feed
app.post("/:id/refresh", async (c) => {
  const { id } = c.req.param();

  try {
    const db = getDatabase();

    // Get feed info
    const query = db.query("SELECT url, title FROM feeds WHERE id = ?");
    const feed = query.get(id) as { url: string; title: string } | null;

    if (!feed) {
      return c.json({ error: "Feed not found" }, 404);
    }

    // Fetch articles with 5s timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Timeout")), 5000);
    });

    const articles = await Promise.race([fetchFeed(feed.url), timeoutPromise]);
    const now = Math.floor(Date.now() / 1000);

    // Get existing article links
    const linksQuery = db.query("SELECT link FROM articles WHERE feed_id = ?");
    const existingLinks = new Set(
      (linksQuery.all(id) as { link: string }[]).map((row) => row.link),
    );

    let savedCount = 0;
    const insertQuery = db.query(`
      INSERT OR IGNORE INTO articles 
      (id, feed_id, title, link, content, summary, author, pub_date, is_read, is_starred, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
    `);

    for (const article of articles) {
      if (existingLinks.has(article.link)) {
        continue;
      }

      insertQuery.run(
        article.id,
        id,
        article.title,
        article.link,
        article.content,
        article.summary || null,
        article.author || null,
        article.pubDate || now,
        now,
      );

      savedCount++;
    }

    db.query("UPDATE feeds SET updated_at = ? WHERE id = ?").run(now, id);

    return c.json({
      success: true,
      count: savedCount,
      total: articles.length,
      title: feed.title,
    });
  } catch (error: any) {
    const db = getDatabase();
    const feedQuery = db.query("SELECT title FROM feeds WHERE id = ?");
    const feedInfo = feedQuery.get(id) as { title: string } | null;

    console.error("[Feeds] Failed to refresh feed:", error.message);
    return c.json(
      {
        success: false,
        error: error.message || "Failed to refresh feed",
        title: feedInfo?.title || "Unknown",
      },
      400,
    );
  }
});

// Helper function to refresh a single feed with timeout
async function refreshSingleFeed(
  feedId: string,
  url: string,
  title: string,
  db: any,
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Feed refresh timeout (5s)")), 5000);
    });

    const articles = await Promise.race([fetchFeed(url), timeoutPromise]);
    const now = Math.floor(Date.now() / 1000);

    const linksQuery = db.query("SELECT link FROM articles WHERE feed_id = ?");
    const existingLinks = new Set(
      (linksQuery.all(feedId) as { link: string }[]).map((row) => row.link),
    );

    let savedCount = 0;
    const insertQuery = db.query(`
      INSERT OR IGNORE INTO articles 
      (id, feed_id, title, link, content, summary, author, pub_date, is_read, is_starred, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
    `);

    for (const article of articles) {
      if (existingLinks.has(article.link)) {
        continue;
      }

      insertQuery.run(
        article.id,
        feedId,
        article.title,
        article.link,
        article.content,
        article.summary || null,
        article.author || null,
        article.pubDate || now,
        now,
      );

      savedCount++;
    }

    db.query("UPDATE feeds SET updated_at = ? WHERE id = ?").run(now, feedId);

    return { success: true, count: savedCount };
  } catch (error: any) {
    const errorMsg = error.message || "Unknown error";
    console.error(`[Feeds] Failed to refresh feed '${title}': ${errorMsg}`);
    return { success: false, count: 0, error: `${title}: ${errorMsg}` };
  }
}

// POST /api/feeds/refresh-all - Refresh all feeds
app.post("/refresh-all", async (c) => {
  console.log("[Feeds] Starting refresh-all...");

  try {
    const db = getDatabase();
    const feedsQuery = db.query("SELECT id, url, title FROM feeds");
    const feeds = feedsQuery.all() as {
      id: string;
      url: string;
      title: string;
    }[];

    console.log(`[Feeds] Found ${feeds.length} feeds to refresh`);

    // Process feeds with concurrency limit (5 at a time) for speed
    const CONCURRENCY = 5;
    let totalCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < feeds.length; i += CONCURRENCY) {
      const batch = feeds.slice(i, i + CONCURRENCY);
      console.log(
        `[Feeds] Processing batch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(feeds.length / CONCURRENCY)}`,
      );

      const results = await Promise.all(
        batch.map((feed) =>
          refreshSingleFeed(feed.id, feed.url, feed.title, db),
        ),
      );

      for (const result of results) {
        if (result.success) {
          totalCount += result.count;
        } else {
          errors.push(result.error!);
        }
      }
    }

    console.log(
      `[Feeds] Refresh-all complete: ${totalCount} new articles, ${errors.length} errors`,
    );

    // Always return 200 with results, even if some feeds failed
    return c.json({
      count: totalCount,
      errors: errors.length > 0 ? errors : undefined,
      totalFeeds: feeds.length,
      successCount: feeds.length - errors.length,
      failedCount: errors.length,
    });
  } catch (error: any) {
    console.error("[Feeds] Critical error in refresh-all:", error.message);
    return c.json({ error: error.message || "Failed to refresh feeds" }, 500);
  }
});

export default app;
