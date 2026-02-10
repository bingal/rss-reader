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
});

export async function fetchFeed(
  url: string,
): Promise<Omit<Article, "feedId" | "isRead" | "isStarred" | "fetchedAt">[]> {
  const feed = await parser.parseURL(url);
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
