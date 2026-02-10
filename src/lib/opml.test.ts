import { describe, it, expect, vi } from "vitest";
import { exportToOPML, importFromOPML, escapeXml } from "@/lib/opml";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

// Mock api module
vi.mock("@/lib/api", () => ({
  api: {
    feeds: {
      add: vi.fn().mockResolvedValue({
        id: "mock-id",
        title: "Mock Feed",
        url: "https://mock.com/feed",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    },
  },
  getApiBaseUrl: vi.fn().mockResolvedValue("http://localhost:3456"),
}));

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

  describe("importFromOPML", () => {
    it("should handle nested OPML structure", async () => {
      const nestedOPML = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Test</title></head>
  <body>
    <outline text="Category">
      <outline type="rss" text="Feed 1" xmlUrl="https://feed1.com/rss"/>
      <outline type="rss" text="Feed 2" xmlUrl="https://feed2.com/rss"/>
    </outline>
  </body>
</opml>`;

      const result = await importFromOPML(nestedOPML);
      expect(result.count).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle flat OPML structure", async () => {
      const flatOPML = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Test</title></head>
  <body>
    <outline type="rss" text="Feed 1" xmlUrl="https://feed1.com/rss"/>
    <outline type="rss" text="Feed 2" xmlUrl="https://feed2.com/rss"/>
  </body>
</opml>`;

      const result = await importFromOPML(flatOPML);
      expect(result.count).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle deeply nested structure", async () => {
      const deepOPML = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Test</title></head>
  <body>
    <outline text="Level 1">
      <outline text="Level 2">
        <outline type="rss" text="Deep Feed" xmlUrl="https://deep.com/rss"/>
      </outline>
    </outline>
  </body>
</opml>`;

      const result = await importFromOPML(deepOPML);
      expect(result.count).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle hn-blogs.opml format", async () => {
      // Simulate the actual hn-blogs.opml structure
      const hnBlogsOPML = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Blog Feeds</title>
  </head>
  <body>
    <outline text="Blogs" title="Blogs">
      <outline type="rss" text="simonwillison.net" title="simonwillison.net" xmlUrl="https://simonwillison.net/atom/everything/" htmlUrl="https://simonwillison.net"/>
      <outline type="rss" text="jeffgeerling.com" title="jeffgeerling.com" xmlUrl="https://www.jeffgeerling.com/blog.xml" htmlUrl="https://jeffgeerling.com"/>
    </outline>
  </body>
</opml>`;

      const result = await importFromOPML(hnBlogsOPML);
      expect(result.count).toBe(2);
      expect(result.errors).toHaveLength(0);
    });
  });
});
