import { describe, it, expect } from "vitest";
import { exportToOPML, escapeXml } from "@/lib/opml";

describe("OPML Utilities", () => {
  const mockFeeds = [
    {
      id: "feed-1",
      title: "Tech Blog",
      url: "https://techblog.com/feed.xml",
      description: "A tech blog",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: "feed-2",
      title: "News",
      url: "https://news.com/feed.xml",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  describe("exportToOPML", () => {
    it("should generate valid OPML structure", async () => {
      const opml = await exportToOPML(mockFeeds);

      expect(opml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(opml).toContain('<opml version="2.0">');
      expect(opml).toContain("<head>");
      expect(opml).toContain("<title>RSS Reader Subscriptions</title>");
      expect(opml).toContain("<body>");
      expect(opml).toContain("</opml>");
    });

    it("should include all feeds", async () => {
      const opml = await exportToOPML(mockFeeds);

      expect(opml).toContain("Tech Blog");
      expect(opml).toContain("News");
      expect(opml).toContain("https://techblog.com/feed.xml");
      expect(opml).toContain("https://news.com/feed.xml");
    });

    it("should escape special XML characters", async () => {
      const feedsWithSpecialChars = [
        {
          id: "feed-1",
          title: 'Feed with <tags> & "quotes"',
          url: "https://example.com/feed.xml",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const opml = await exportToOPML(feedsWithSpecialChars);

      expect(opml).toContain("&lt;tags&gt;");
      expect(opml).toContain("&quot;quotes&quot;");
    });
  });

  describe("escapeXml", () => {
    it("should escape ampersands", () => {
      expect(escapeXml("A & B")).toBe("A &amp; B");
    });

    it("should escape less than", () => {
      expect(escapeXml("A < B")).toBe("A &lt; B");
    });

    it("should escape greater than", () => {
      expect(escapeXml("A > B")).toBe("A &gt; B");
    });

    it("should escape quotes", () => {
      expect(escapeXml('A "B"')).toBe("A &quot;B&quot;");
    });

    it("should escape apostrophes", () => {
      expect(escapeXml("A 'B'")).toBe("A &apos;B&apos;");
    });
  });
});
