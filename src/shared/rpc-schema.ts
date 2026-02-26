// RSS Reader RPC Schema - defines the typed interface between frontend and backend

import type { RPCSchema } from "electrobun";

// Define the schema for both sides of the RPC communication
export interface RSSReaderSchema extends RPCSchema {
  // What the frontend (webview) can call on the backend (bun)
  requests: {
    // Feeds
    "feeds:getAll": { params: void; response: import("./types").Feed[] };
    "feeds:add": {
      params: {
        title: string;
        url: string;
        description?: string;
        category?: string;
      };
      response: import("./types").Feed;
    };
    "feeds:delete": { params: { id: string }; response: void };
    "feeds:refresh": {
      params: { id: string };
      response: { success: boolean; count: number; error?: string };
    };
    "feeds:refreshAll": {
      params: void;
      response: { count: number; errors?: string[] };
    };

    // Articles
    "articles:fetch": {
      params: {
        feedId?: string;
        filter?: "all" | "unread" | "starred";
        limit?: number;
        offset?: number;
      };
      response: import("./types").Article[];
    };
    "articles:markRead": {
      params: { id: string; read: boolean };
      response: void;
    };
    "articles:toggleStarred": {
      params: { id: string; starred: boolean };
      response: void;
    };

    // Settings
    "settings:get": {
      params: { key: string };
      response: { value: string | null };
    };
    "settings:set": { params: { key: string; value: string }; response: void };

    // Translation
    "translation:translate": {
      params: { text: string; targetLang: string };
      response: { translatedText: string };
    };
    "translation:save": {
      params: { articleId: string; content: string };
      response: void;
    };
    "translation:get": {
      params: { articleId: string };
      response: { content: string | null };
    };
  };
  messages: {
    // Messages (one-way notifications)
    notification: { title: string; body: string };
  };
}
