export default {
  app: {
    name: "RSSReader",
    identifier: "com.rssreader.app",
    version: "0.2.3",
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
  },
  release: {
    baseUrl: "https://github.com/bingal/rss-reader/releases",
  },
};
