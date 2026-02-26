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
  pubDate: number | null;
  isRead: number;
  isStarred: number;
  fetchedAt: number;
}

export type ArticleFilter = "all" | "unread" | "starred";
