import Parser from "rss-parser";
import { randomUUID } from "crypto";
import type { Article } from "@/types";
import { htmlToMarkdown } from "../utils/htmlToMarkdown";

const parser = new Parser({
  customFields: {
    item: [
      ["content:encoded", "contentEncoded"],
      ["media:content", "mediaContent"],
    ],
  },
  // Set timeout options
  timeout: 10000, // 10 seconds timeout
});

const FETCH_TIMEOUT = 15000; // 15 seconds timeout for fetch

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "RSS-Reader/1.0",
        Accept:
          "application/rss+xml, application/xml, text/xml, application/atom+xml, */*",
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

export async function fetchFeed(
  url: string,
): Promise<Omit<Article, "feedId" | "isRead" | "isStarred" | "fetchedAt">[]> {
  let feed;

  try {
    // Try to fetch with timeout first
    const xml = await fetchWithTimeout(url, FETCH_TIMEOUT);
    feed = await parser.parseString(xml);
  } catch (fetchError: any) {
    // If fetch with timeout fails, try parser's default method as fallback
    try {
      feed = await parser.parseURL(url);
    } catch (parseError: any) {
      // If both fail, throw the original error
      throw new Error(
        `Failed to fetch feed: ${fetchError.message || parseError.message}`,
      );
    }
  }

  const now = Math.floor(Date.now() / 1000);

  return feed.items.map((item) => {
    const htmlContent =
      (item as any).contentEncoded || item.content || item.summary || "";
    const htmlSummary =
      item.summary && item.summary !== htmlContent ? item.summary : "";

    // Convert HTML to Markdown
    const content = htmlToMarkdown(htmlContent);
    const summary = htmlSummary
      ? htmlToMarkdown(htmlSummary)
      : createSummary(content);

    return {
      id: randomUUID(),
      title: item.title || "Untitled",
      link: item.link || item.guid || randomUUID(),
      content,
      summary,
      author: item.creator || feed.title,
      pubDate: item.isoDate
        ? Math.floor(new Date(item.isoDate).getTime() / 1000)
        : now,
    };
  });
}

function createSummary(markdown: string): string {
  // Markdown is already clean text, just limit length
  const text = markdown
    .replace(/[#*_[\]()]/g, "") // Remove markdown syntax
    .replace(/\s+/g, " ")
    .trim();

  const words = text.split(" ").slice(0, 100).join(" ");

  if (words.length > 200) {
    return words.slice(0, 200) + "...";
  }

  return words;
}
