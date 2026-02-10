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
      });
    } catch (error: any) {
      return c.json(
        {
          initialized: false,
          error: error.message,
          message: "Failed to reinitialize database",
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

  const db = getDatabase();
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  try {
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
    return c.json({ error: error.message || "Failed to add feed" }, 400);
  }
});

// DELETE /api/feeds/:id - Delete feed
app.delete("/:id", (c) => {
  const { id } = c.req.param();
  const db = getDatabase();

  try {
    // Delete articles first
    db.query("DELETE FROM articles WHERE feed_id = ?").run(id);

    // Delete feed
    const result = db.query("DELETE FROM feeds WHERE id = ?").run(id);

    if (result.changes === 0) {
      return c.json({ error: "Feed not found" }, 404);
    }

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || "Failed to delete feed" }, 400);
  }
});

// POST /api/feeds/:id/refresh - Refresh specific feed
app.post("/:id/refresh", async (c) => {
  const { id } = c.req.param();
  const db = getDatabase();

  try {
    // Get feed URL
    const query = db.query("SELECT url FROM feeds WHERE id = ?");
    const feed = query.get(id) as { url: string } | null;

    if (!feed) {
      return c.json({ error: "Feed not found" }, 404);
    }

    // Fetch articles
    const articles = await fetchFeed(feed.url);
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

    // Update feed timestamp
    db.query("UPDATE feeds SET updated_at = ? WHERE id = ?").run(now, id);

    return c.json({ count: savedCount });
  } catch (error: any) {
    return c.json({ error: error.message || "Failed to refresh feed" }, 400);
  }
});

// POST /api/feeds/refresh-all - Refresh all feeds
app.post("/refresh-all", async (c) => {
  const db = getDatabase();

  try {
    const feedsQuery = db.query("SELECT id, url, title FROM feeds");
    const feeds = feedsQuery.all() as {
      id: string;
      url: string;
      title: string;
    }[];

    let totalCount = 0;
    const errors: string[] = [];

    for (const feed of feeds) {
      try {
        const articles = await fetchFeed(feed.url);
        const now = Math.floor(Date.now() / 1000);

        const linksQuery = db.query(
          "SELECT link FROM articles WHERE feed_id = ?",
        );
        const existingLinks = new Set(
          (linksQuery.all(feed.id) as { link: string }[]).map(
            (row) => row.link,
          ),
        );

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
            feed.id,
            article.title,
            article.link,
            article.content,
            article.summary || null,
            article.author || null,
            article.pubDate || now,
            now,
          );

          totalCount++;
        }

        db.query("UPDATE feeds SET updated_at = ? WHERE id = ?").run(
          now,
          feed.id,
        );
      } catch (error: any) {
        errors.push(`Failed to refresh feed '${feed.title}': ${error.message}`);
        console.error(errors[errors.length - 1]);
      }
    }

    if (totalCount === 0 && errors.length > 0) {
      return c.json(
        { error: `All feeds failed to refresh. First error: ${errors[0]}` },
        400,
      );
    }

    return c.json({
      count: totalCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    return c.json({ error: error.message || "Failed to refresh feeds" }, 400);
  }
});

export default app;
