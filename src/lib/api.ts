const API_BASE_URL_KEY = 'rss_reader_api_base_url';

let cachedApiBaseUrl: string | null = null;
let portPromise: Promise<number> | null = null;

export async function getApiBaseUrl(): Promise<string> {
  if (cachedApiBaseUrl) {
    return cachedApiBaseUrl;
  }

  // Check if we're in Tauri environment
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      // Only create one promise for getting the port
      if (!portPromise) {
        portPromise = (async () => {
          const { invoke } = await import('@tauri-apps/api/core');
          return await invoke<number>('get_backend_port');
        })();
      }
      
      const port = await portPromise;
      cachedApiBaseUrl = `http://localhost:${port}`;
      console.log('[API] Using backend at:', cachedApiBaseUrl);
      return cachedApiBaseUrl;
    } catch (error) {
      console.error('[API] Failed to get backend port from Tauri:', error);
      // Retry after a short delay
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const port = await invoke<number>('get_backend_port');
        cachedApiBaseUrl = `http://localhost:${port}`;
        console.log('[API] Retry successful, using backend at:', cachedApiBaseUrl);
        return cachedApiBaseUrl;
      } catch (retryError) {
        console.error('[API] Retry failed:', retryError);
      }
    }
  }

  // Fallback to localStorage or default
  const stored = localStorage.getItem(API_BASE_URL_KEY);
  cachedApiBaseUrl = stored || 'http://localhost:3456';
  console.log('[API] Using fallback backend at:', cachedApiBaseUrl);
  return cachedApiBaseUrl;
}

export interface Feed {
  id: string;
  title: string;
  url: string;
  description?: string;
  imageUrl?: string;
  category?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Article {
  id: string;
  feedId: string;
  title: string;
  link: string;
  content: string;
  summary?: string;
  author?: string;
  pubDate?: number;
  isRead: number;
  isStarred: number;
  fetchedAt: number;
}

export type ArticleFilter = 'all' | 'unread' | 'starred';

export const api = {
  feeds: {
    getAll: async (): Promise<Feed[]> => {
      const baseUrl = await getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/feeds`);
      if (!response.ok) throw new Error('Failed to fetch feeds');
      return response.json();
    },
    
    add: async (data: { title: string; url: string; description?: string; category?: string }): Promise<Feed> => {
      const baseUrl = await getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/feeds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to add feed');
      return response.json();
    },
    
    delete: async (id: string): Promise<void> => {
      const baseUrl = await getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/feeds/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete feed');
    },
    
    refresh: async (id: string): Promise<{ count: number }> => {
      const baseUrl = await getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/feeds/${id}/refresh`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to refresh feed');
      return response.json();
    },
    
    refreshAll: async (): Promise<{ count: number; errors?: string[] }> => {
      const baseUrl = await getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/feeds/refresh-all`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to refresh all feeds');
      return response.json();
    }
  },
  
  articles: {
    fetch: async (params: { feedId?: string; filter?: ArticleFilter; limit?: number; offset?: number }): Promise<Article[]> => {
      const baseUrl = await getApiBaseUrl();
      const queryParams = new URLSearchParams();
      if (params.feedId) queryParams.set('feedId', params.feedId);
      if (params.filter) queryParams.set('filter', params.filter);
      if (params.limit) queryParams.set('limit', params.limit.toString());
      if (params.offset) queryParams.set('offset', params.offset.toString());
      
      const response = await fetch(`${baseUrl}/api/articles?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch articles');
      return response.json();
    },
    
    markRead: async (id: string, read: boolean): Promise<void> => {
      const baseUrl = await getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/articles/${id}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read })
      });
      if (!response.ok) throw new Error('Failed to mark article as read');
    },
    
    toggleStarred: async (id: string, starred: boolean): Promise<void> => {
      const baseUrl = await getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/articles/${id}/starred`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred })
      });
      if (!response.ok) throw new Error('Failed to toggle article star');
    }
  },
  
  settings: {
    get: async (key: string): Promise<{ value: string | null }> => {
      const baseUrl = await getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/settings/${key}`);
      if (!response.ok) throw new Error('Failed to get setting');
      return response.json();
    },
    
    set: async (key: string, value: string): Promise<void> => {
      const baseUrl = await getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/settings/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });
      if (!response.ok) throw new Error('Failed to set setting');
    }
  },
  
  translation: {
    translate: async (text: string, targetLang: string = 'zh'): Promise<{ translatedText: string }> => {
      const baseUrl = await getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLang })
      });
      if (!response.ok) throw new Error('Translation failed');
      return response.json();
    },
    
    save: async (articleId: string, content: string): Promise<void> => {
      const baseUrl = await getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/translations/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, content })
      });
      if (!response.ok) throw new Error('Failed to save translation');
    },
    
    get: async (articleId: string): Promise<{ content: string | null }> => {
      const baseUrl = await getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/translations/${articleId}`);
      if (!response.ok) throw new Error('Failed to get translation');
      return response.json();
    }
  }
};
