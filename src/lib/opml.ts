import { Feed } from "@/stores/useAppStore";
import { api } from "@/lib/api";

export interface OPMLOutline {
  "@_text"?: string;
  "@_title"?: string;
  "@_xmlUrl"?: string;
  "@_htmlUrl"?: string;
  "@_type"?: string;
  outline?: OPMLOutline[];
}

export async function exportToOPML(feeds: Feed[]): Promise<string> {
  const outlines = feeds.map((feed) => ({
    "@_text": feed.title,
    "@_title": feed.title,
    "@_xmlUrl": feed.url,
    "@_type": "rss",
  }));

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>RSS Reader Subscriptions</title>
  </head>
  <body>
${outlines.map((o) => `    <outline type="rss" text="${escapeXml(o["@_text"] || "")}" title="${escapeXml(o["@_title"] || "")}" xmlUrl="${escapeXml(o["@_xmlUrl"] || "")}"/>`).join("\n")}
  </body>
</opml>`;
}

export async function importFromOPML(
  opmlContent: string,
): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];
  let count = 0;

  try {
    // Use DOMParser to properly handle nested OPML structures
    const parser = new DOMParser();
    const doc = parser.parseFromString(opmlContent, "text/xml");

    // Check for parsing errors
    const parseError = doc.querySelector("parsererror");
    if (parseError) {
      throw new Error("XML parsing failed");
    }

    // Recursively extract all RSS feeds from nested outline structures
    const rssOutlines: Array<{ title: string; url: string }> = [];

    function extractOutlines(node: Element) {
      if (node.tagName === "outline") {
        const type = node.getAttribute("type");
        const xmlUrl = node.getAttribute("xmlUrl");
        const text =
          node.getAttribute("text") || node.getAttribute("title") || "Unknown";

        if (type === "rss" && xmlUrl) {
          rssOutlines.push({ title: text, url: xmlUrl });
        }

        // Recursively process child outline elements
        for (const child of Array.from(node.children)) {
          extractOutlines(child);
        }
      }
    }

    // Start from body element and process all outlines
    const body = doc.querySelector("body");
    if (body) {
      for (const child of Array.from(body.children)) {
        extractOutlines(child);
      }
    } else {
      // Fallback: query all outline elements
      for (const outline of Array.from(doc.querySelectorAll("outline"))) {
        extractOutlines(outline);
      }
    }

    // Import extracted feeds
    for (const { title, url } of rssOutlines) {
      try {
        await api.feeds.add({
          title,
          url,
          description: undefined,
          category: undefined,
        });
        count++;
      } catch (e) {
        errors.push(`Failed to import ${title}: ${e}`);
      }
    }
  } catch (e) {
    errors.push(`Failed to parse OPML: ${e}`);
  }

  return { count, errors };
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Download OPML file
export function downloadOPML(
  content: string,
  filename: string = "subscriptions.opml",
) {
  const blob = new Blob([content], { type: "text/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
