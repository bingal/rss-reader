import TurndownService from "turndown";
import { JSDOM } from "jsdom";

// Create and configure turndown service
const turndownService = new TurndownService({
  headingStyle: "atx", // Use # for headings
  hr: "---",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "_",
  strongDelimiter: "**",
});

// Add custom rules for better conversion
turndownService.addRule("strikethrough", {
  filter: ["del", "s", "strike"],
  replacement: (content) => `~~${content}~~`,
});

// Preserve images with alt text
turndownService.addRule("image", {
  filter: "img",
  replacement: (content, node) => {
    const element = node as any;
    const alt = element.getAttribute("alt") || "";
    const src = element.getAttribute("src") || "";
    const title = element.getAttribute("title") || "";

    if (!src) return "";

    const titlePart = title ? ` "${title}"` : "";
    return `![${alt}](${src}${titlePart})`;
  },
});

// Preserve videos
turndownService.addRule("video", {
  filter: "video",
  replacement: (content, node) => {
    const element = node as any;
    const src =
      element.getAttribute("src") ||
      element.querySelector("source")?.getAttribute("src") ||
      "";

    if (!src) return content;

    return `\n[🎬 Video](${src})\n`;
  },
});

// Preserve iframes (YouTube, etc.)
turndownService.addRule("iframe", {
  filter: "iframe",
  replacement: (content, node) => {
    const element = node as any;
    const src = element.getAttribute("src") || "";

    if (!src) return "";

    return `\n[🎬 Embedded Content](${src})\n`;
  },
});

/**
 * Convert HTML content to Markdown
 * @param html HTML string to convert
 * @returns Markdown string
 */
export function htmlToMarkdown(html: string): string {
  if (!html || html.trim() === "") {
    return "";
  }

  try {
    // Clean up common RSS HTML issues
    const cleaned = html
      .replace(/<br\s*\/?>/gi, "\n") // Convert <br> to newlines
      .replace(/&nbsp;/g, " ") // Convert &nbsp; to spaces
      .trim();

    // Use JSDOM to parse HTML properly in Node.js/Bun environment
    const dom = new JSDOM(cleaned);
    const document = dom.window.document;
    const body = document.body;

    // Convert to markdown using the parsed DOM
    const markdown = turndownService.turndown(body.innerHTML);

    // Post-process: clean up excessive newlines
    return markdown
      .replace(/\n{3,}/g, "\n\n") // Max 2 consecutive newlines
      .trim();
  } catch (error) {
    console.error("Failed to convert HTML to Markdown:", error);
    // Fallback: return original HTML
    return html;
  }
}
