import { Hono } from 'hono';
import { getDatabase } from '@/db/connection';
import type { Article, ArticleFilter } from '@/types';
import { htmlToMarkdown } from '@/utils/htmlToMarkdown';

const app = new Hono();

/**
 * Check if content is HTML (contains HTML tags)
 */
function isHtmlContent(text: string): boolean {
  if (!text) return false;
  // Check for common HTML tags
  return /<[a-z][\s\S]*>/i.test(text);
}

/**
 * Ensure content is in Markdown format (convert if needed)
 */
function ensureMarkdown(content: string): string {
  if (!content) return content;
  
  // If content contains HTML tags, convert it
  if (isHtmlContent(content)) {
    return htmlToMarkdown(content);
  }
  
  // Already Markdown (or plain text)
  return content;
}

// GET /api/articles - Get articles with optional filters
app.get('/', (c) => {
  const feedId = c.req.query('feedId');
  const filter = c.req.query('filter') as ArticleFilter | undefined;
  const limit = parseInt(c.req.query('limit') || '100');
  const offset = parseInt(c.req.query('offset') || '0');
  
  const db = getDatabase();
  
  let queryStr = `
    SELECT 
      id, feed_id as feedId, title, link, content, summary, author, 
      pub_date as pubDate, is_read as isRead, is_starred as isStarred, 
      fetched_at as fetchedAt
    FROM articles
  `;
  
  const conditions: string[] = [];
  const params: any[] = [];
  
  if (feedId) {
    conditions.push('feed_id = ?');
    params.push(feedId);
  }
  
  if (filter === 'unread') {
    conditions.push('is_read = 0');
  } else if (filter === 'starred') {
    conditions.push('is_starred = 1');
  }
  
  if (conditions.length > 0) {
    queryStr += ' WHERE ' + conditions.join(' AND ');
  }
  
  queryStr += ' ORDER BY pub_date DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  const query = db.query(queryStr);
  const articles = query.all(...params) as Article[];
  
  // Convert HTML content to Markdown on-the-fly for legacy data
  const processedArticles = articles.map(article => ({
    ...article,
    content: ensureMarkdown(article.content),
    summary: ensureMarkdown(article.summary || '')
  }));
  
  return c.json(processedArticles);
});

// PATCH /api/articles/:id/read - Mark article as read/unread
app.patch('/:id/read', async (c) => {
  const { id } = c.req.param();
  const { read } = await c.req.json();
  
  const db = getDatabase();
  
  try {
    const query = db.query('UPDATE articles SET is_read = ? WHERE id = ?');
    query.run(read ? 1 : 0, id);
    
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to update article' }, 400);
  }
});

// PATCH /api/articles/:id/starred - Toggle article starred status
app.patch('/:id/starred', async (c) => {
  const { id } = c.req.param();
  const { starred } = await c.req.json();
  
  const db = getDatabase();
  
  try {
    const query = db.query('UPDATE articles SET is_starred = ? WHERE id = ?');
    query.run(starred ? 1 : 0, id);
    
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to update article' }, 400);
  }
});

export default app;
