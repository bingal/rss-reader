import { Hono } from "hono";
import { getDatabase } from "@/db/connection";

const app = new Hono();

// GET /api/settings/:key - Get setting value
app.get("/:key", (c) => {
  const { key } = c.req.param();
  const db = getDatabase();

  try {
    const query = db.query("SELECT value FROM settings WHERE key = ?");
    const result = query.get(key) as { value: string } | null;

    return c.json({ value: result?.value || null });
  } catch (error: any) {
    return c.json({ error: error.message || "Failed to get setting" }, 400);
  }
});

// PUT /api/settings/:key - Set setting value
app.put("/:key", async (c) => {
  const { key } = c.req.param();
  const { value } = await c.req.json();

  const db = getDatabase();

  try {
    const query = db.query(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    );
    query.run(key, value);

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || "Failed to set setting" }, 400);
  }
});

export default app;
