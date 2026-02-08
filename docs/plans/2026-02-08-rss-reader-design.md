# RSS Reader Design Document

> Created: 2026-02-08
> Status: Approved

## Overview

A fast, comfortable RSS reader desktop application built with Tauri 2.x, React, TypeScript, and Tailwind CSS v4.

## Target Users

- Personal users who value fast, clean reading experience
- Focus on speed (A) and reading comfort (B)

## Core Features

### MVP Features

| Priority | Feature             | Description                                |
| -------- | ------------------- | ------------------------------------------ |
| P0       | RSS Subscription    | Add/remove RSS feeds by URL                |
| P0       | Article List        | Two-column layout, chronological order     |
| P0       | Article Reader      | Clean reading view with lazy image loading |
| P0       | Theme System        | Light/Dark/System auto-switch              |
| P0       | OPML Import/Export  | Batch import/export feed subscriptions     |
| P1       | Keyboard Shortcuts  | j/k navigation, basic shortcuts            |
| P1       | Article Translation | Built-in translation support               |
| P1       | Keyboard Shortcuts  | j/k navigation                             |
| P2       | Starred Articles    | Bookmark important articles                |

### Out of Scope (MVP)

- Cloud sync
- Offline reading
- Advanced filtering rules
- Multiple layouts

## Technical Stack

### Frontend

- **Framework**: React 18 + TypeScript
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS v4
- **State Management**: React Query (data) + Zustand (local)
- **RSS Parsing**: feed npm package

### Backend (Tauri 2.x)

- **Language**: Rust
- **Database**: SQLite
- **IPC**: Tauri commands

### Build & Deploy

- **Platforms**: Windows, macOS, Linux
- **Installer**: NSIS (Windows), DMG (macOS), DEB/RPM (Linux)

## Architecture

```
rss-reader/
├── src/
│   ├── components/          # React components
│   │   ├── App.tsx         # Main app container
│   │   ├── Sidebar.tsx     # Feed list sidebar
│   │   ├── ArticleList.tsx  # Article list
│   │   ├── ArticleView.tsx  # Article reader
│   │   ├── ThemeToggle.tsx  # Theme switcher
│   │   ├── FeedManager.tsx  # Feed management dialog
│   │   └── OPMLImport.tsx   # OPML import/export
│   ├── hooks/               # Custom React hooks
│   ├── stores/              # Zustand stores
│   ├── utils/               # Utility functions
│   ├── lib/                 # Third-party configs
│   └── main.tsx            # Entry point
├── src-tauri/              # Tauri Rust backend
│   ├── src/
│   │   ├── commands.rs     # Tauri commands
│   │   ├── db.rs           # SQLite operations
│   │   └── rss.rs          # RSS fetching/parsing
│   └── Cargo.toml
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## Data Model

### SQLite Schema

```sql
-- Feeds table
CREATE TABLE IF NOT EXISTS feeds (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    category TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
);

-- Articles table
CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    feed_id TEXT NOT NULL,
    title TEXT NOT NULL,
    link TEXT NOT NULL,
    content TEXT,
    summary TEXT,
    author TEXT,
    pub_date INTEGER,
    is_read INTEGER DEFAULT 0,
    is_starred INTEGER DEFAULT 0,
    fetched_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (feed_id) REFERENCES feeds(id)
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_articles_feed ON articles(feed_id);
CREATE INDEX IF NOT EXISTS idx_articles_date ON articles(pub_date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_read ON articles(is_read);
```

### TypeScript Types

```typescript
interface Feed {
  id: string;
  title: string;
  url: string;
  description?: string;
  imageUrl?: string;
  category?: string;
  createdAt: number;
  updatedAt: number;
}

interface Article {
  id: string;
  feedId: string;
  title: string;
  link: string;
  content: string;
  summary?: string;
  author?: string;
  pubDate: number;
  isRead: boolean;
  isStarred: boolean;
  fetchedAt: number;
}

type Theme = "light" | "dark" | "system";

interface AppSettings {
  theme: Theme;
  refreshInterval: number; // in minutes
  autoFetchOnStartup: boolean;
  lazyLoadImages: boolean;
  keyboardShortcuts: boolean;
}
```

## UI Design

### Layout

```
┌─────────────────────────────────────────────────────┐
│ [≡] RSS Reader                      🔆🌙🔄 ⚙️     │
├──────────────────┬──────────────────────────────────┤
│                  │                                  │
│  📁 全部订阅      │  ┌────────────────────────────┐ │
│  📁 技术资讯      │  │ 📰 文章标题                │ │
│  📁 博客          │  │ 🕐 2026-02-08 10:30       │ │
│  📁 社交媒体      │  │                            │ │
│                  │  │ 文章摘要内容...            │ │
│  ─────────────   │  │                            │ │
│  🔄 刷新         │  │ [阅读更多 →]               │ │
│  ➕ 添加源       │  └────────────────────────────┘ │
│                  │                                  │
│  ─────────────   │  ┌────────────────────────────┐ │
│  ⚙️ OPML 导入    │  │ 📰 下一篇文章标题          │ │
│                  │  │ ...                        │ │
│                  │  └────────────────────────────┘ │
│                  │                                  │
├──────────────────┴──────────────────────────────────┤
│ 🦶 状态栏：📊 120 篇未读 | 📶 已同步            │
└─────────────────────────────────────────────────────┘
```

### Color Palette (Dark Mode)

```css
:root {
  --background: #0a0a0a;
  --foreground: #ededed;
  --card: #1a1a1a;
  --card-foreground: #ededed;
  --border: #2e2e2e;
  --muted: #262626;
  --muted-foreground: #a1a1aa;
  --primary: #3b82f6;
  --primary-foreground: #ffffff;
  --secondary: #27272a;
  --secondary-foreground: #ffffff;
  --accent: #27272a;
  --accent-foreground: #ffffff;
  --destructive: #7f1d1d;
  --destructive-foreground: #fafafa;
}
```

## API Design (Tauri Commands)

| Command                | Description   | Arguments                                            | Returns          |
| ---------------------- | ------------- | ---------------------------------------------------- | ---------------- |
| `feeds:list`           | Get all feeds | -                                                    | `Feed[]`         |
| `feeds:add`            | Add new feed  | `{ url: string }`                                    | `Feed`           |
| `feeds:remove`         | Remove feed   | `{ id: string }`                                     | `void`           |
| `feeds:import_opml`    | Import OPML   | `{ content: string }`                                | `number`         |
| `feeds:export_opml`    | Export OPML   | -                                                    | `string`         |
| `articles:get`         | Get articles  | `{ feedId?: string, limit: number, offset: number }` | `Article[]`      |
| `articles:mark_read`   | Mark as read  | `{ id: string, read: boolean }`                      | `void`           |
| `articles:toggle_star` | Toggle star   | `{ id: string, starred: boolean }`                   | `void`           |
| `settings:get`         | Get setting   | `{ key: string }`                                    | `string \| null` |
| `settings:set`         | Set setting   | `{ key: string, value: string }`                     | `void`           |

## Keyboard Shortcuts

| Shortcut | Action           |
| -------- | ---------------- |
| `j`      | Next article     |
| `k`      | Previous article |
| `v`      | Open in browser  |
| `r`      | Refresh feeds    |
| `m`      | Toggle theme     |
| `s`      | Toggle star      |
| `?`      | Show help        |

## Milestones

### Phase 1: Project Setup

- [ ] Initialize Tauri project with React + TypeScript
- [ ] Configure Tailwind CSS v4 + shadcn/ui
- [ ] Set up SQLite database in Rust backend
- [ ] Create basic project structure

### Phase 2: Core Features

- [ ] Implement feeds CRUD (add/remove feeds)
- [ ] Build article list view
- [ ] Build article reader view
- [ ] Implement RSS parsing and fetching
- [ ] Add theme switching (light/dark/system)

### Phase 3: Advanced Features

- [ ] Implement OPML import/export
- [ ] Add keyboard shortcuts
- [ ] Add article translation feature
- [ ] Add starred articles

### Phase 4: Polish & Testing

- [ ] Performance optimization
- [ ] Bug fixing and QA
- [ ] Write documentation
- [ ] Create release builds

## Testing Plan

### Functional Tests

| Feature          | Test Case                | Expected Result           |
| ---------------- | ------------------------ | ------------------------- |
| RSS Subscription | Add valid RSS URL        | Articles displayed        |
| OPML Import      | Import standard OPML     | All feeds imported        |
| Theme Switch     | Toggle light/dark/system | Colors update             |
| Article Reading  | Click article            | Content renders correctly |
| Lazy Loading     | Default state            | Images not loaded         |
| Keyboard         | Press j/k                | Focus moves correctly     |
| Persistence      | Restart app              | Data retained             |

### Performance Targets

| Metric                    | Target      |
| ------------------------- | ----------- |
| App startup               | < 2 seconds |
| Article list (1000 items) | < 500ms     |
| RSS refresh (10 feeds)    | < 5 seconds |
| Memory usage              | < 100MB     |

## GitHub Repository

- URL: https://github.com/bingal/rss-reader
- Initial commit: After design approval
- Branch strategy: main + feature branches

## Open Questions

None. Design approved.

---

**Document Version**: 1.0
**Last Updated**: 2026-02-08
**Status**: Ready for Implementation
