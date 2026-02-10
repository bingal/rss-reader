import { Hono } from 'hono';
import { getDatabase } from '@/db/connection';
import { translateText } from '@/services/translate';
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

// POST /api/translate - Translate text
app.post('/', async (c) => {
  const { text, targetLang } = await c.req.json();
  
  if (!text) {
    return c.json({ error: 'Text is required' }, 400);
  }
  
  const db = getDatabase();
  
  try {
    // Get translation settings
    const getSettingValue = (key: string, defaultValue: string): string => {
      const query = db.query('SELECT value FROM settings WHERE key = ?');
      const result = query.get(key) as { value: string } | null;
      return result?.value || defaultValue;
    };
    
    const settings = {
      baseUrl: getSettingValue('translation_base_url', 'https://libretranslate.com'),
      apiKey: getSettingValue('translation_api_key', ''),
      model: getSettingValue('translation_model', 'gpt-3.5-turbo'),
      prompt: getSettingValue('translation_prompt', 'Translate the following text to Chinese:')
    };
    
    const translated = await translateText(text, targetLang || 'zh', settings);
    
    return c.json({ translatedText: translated });
  } catch (error: any) {
    return c.json({ error: error.message || 'Translation failed' }, 400);
  }
});

// POST /api/translations - Save translation for article
app.post('/save', async (c) => {
  const { articleId, content } = await c.req.json();
  
  if (!articleId || !content) {
    return c.json({ error: 'Article ID and content are required' }, 400);
  }
  
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  
  try {
    const query = db.query('INSERT OR REPLACE INTO translations (article_id, content, created_at) VALUES (?, ?, ?)');
    query.run(articleId, content, now);
    
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to save translation' }, 400);
  }
});

// GET /api/translations/:articleId - Get translation for article
app.get('/:articleId', (c) => {
  const { articleId } = c.req.param();
  const db = getDatabase();
  
  try {
    const query = db.query('SELECT content FROM translations WHERE article_id = ?');
    const result = query.get(articleId) as { content: string } | null;
    
    // Convert HTML to Markdown if needed for legacy data
    const content = result?.content ? ensureMarkdown(result.content) : null;
    
    return c.json({ content });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get translation' }, 400);
  }
});

export default app;
