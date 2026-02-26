# AGENTS.md

This file provides guidance to AI coding agents when working on code in this repository.

## RSS Reader - Agent Guide

This document provides essential information for AI coding agents working on the RSS Reader project.

## Project Overview

RSS Reader is a fast, comfortable desktop RSS reader application built with **ElectroBun**. It allows users to subscribe to RSS feeds, read articles, star favorites, and manage subscriptions via OPML import/export.

### Technology Stack

- **Frontend**: React 19, TypeScript 5, Vite 7
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand (persistent), React Query (server state)
- **Desktop Framework**: ElectroBun (Bun + Native WebView)
- **Backend**: Bun + Hono (integrated in ElectroBun process)
- **Database**: SQLite (via Bun's native sqlite3)
- **RSS Parsing**: rss-parser npm package
- **Communication**: ElectroBun RPC (typed, secure)
- **Testing**: Vitest, React Testing Library
- **Build Tooling**: Bun

## Project Structure

```
rss-reader/
├── src/                        # Frontend source (React + TypeScript)
│   ├── components/            # React components
│   │   ├── Sidebar.tsx        # Feed list & add feed UI
│   │   ├── ArticleList.tsx    # Article list with filtering
│   │   ├── ArticleView.tsx    # Article reader view
│   │   ├── OPMLImport.tsx     # Import/export modal
│   │   └── ThemeProvider.tsx  # Theme context provider
│   ├── hooks/                 # Custom React hooks
│   │   └── useKeyboardShortcuts.ts  # Vim-style keyboard shortcuts
│   ├── lib/                   # Utility functions
│   │   ├── api.ts             # ElectroBun RPC client
│   │   ├── utils.ts           # cn() helper, date formatters
│   │   └── opml.ts            # OPML import/export logic
│   ├── stores/                # Zustand state stores
│   │   └── useAppStore.ts     # Main app state
│   ├── shared/               # Shared types
│   │   ├── rpc-schema.ts     # ElectroBun RPC schema
│   │   └── types.ts           # TypeScript types
│   ├── App.tsx                # Root component
│   ├── main.tsx               # Entry point
│   └── index.css              # Tailwind CSS variables
├── src/bun/                   # ElectroBun entry point
│   └── index.ts               # Main process (window + RPC handlers)
├── backend/                   # Backend source (TypeScript + Hono)
│   ├── src/
│   │   ├── db/                # SQLite database connection & schema
│   │   ├── routes/            # API route handlers
│   │   │   ├── feeds.ts       # Feed management endpoints
│   │   │   ├── articles.ts    # Article endpoints
│   │   │   ├── settings.ts    # Settings endpoints
│   │   │   └── translation.ts # Translation endpoints
│   │   ├── services/          # Business logic (RSS parsing)
│   │   └── types/             # TypeScript type definitions
├── dist/                      # Build output
│   └── rss-reader            # Compiled ElectroBun app
├── package.json               # Dependencies
├── electrobun.config.ts       # ElectroBun configuration
├── vite.config.ts             # Vite config
└── tsconfig.json              # TypeScript config
```

## Architecture

### ElectroBun RPC Communication

The app uses ElectroBun's typed RPC for frontend-backend communication:

```
┌─────────────────────────────┐      RPC       ┌─────────────────────────────┐
│      React Frontend         │ ◄──────────────► │   Bun Main Process          │
│   (Browser WebView)         │   (typed API)  │   + Hono HTTP Server        │
│                             │                 │   + SQLite Database        │
└─────────────────────────────┘                 └─────────────────────────────┘
```

- **Frontend** uses `api.ts` to call backend methods via RPC
- **Backend** defines handlers in `src/bun/index.ts`
- **Schema** is shared in `src/shared/rpc-schema.ts`

### Key Benefits

- Type-safe API calls (full TypeScript support)
- No HTTP overhead (local IPC)
- Secure communication (encrypted)
- Smaller bundle size (~14MB vs 150MB+ for Electron)

## Build and Development Commands

```bash
# Development - Frontend only (hot reload)
bun run dev

# Development - Full ElectroBun app (window + backend)
bun run dev:electron

# Build frontend
bun run build

# Build ElectroBun app (standalone executable)
bun run build:electron

# Run tests
bun run test:run

# Code quality
bun run format        # Format code
bun run lint          # Lint
bunx tsc --noEmit    # Type check
```

## Pre-Commit Checklist

**IMPORTANT**: Before committing changes to GitHub, ALWAYS run these commands:

```bash
# 1. Format code with Prettier
bun run format

# 2. Check formatting (should pass after step 1)
bun run format:check

# 3. Run linter
bun run lint

# 4. Type check
bunx tsc --noEmit

# 5. Run tests
bun run test:run
```

**Quick validation** - Run all checks at once:

```bash
bun run format && bun run format:check && bun run lint && bunx tsc --noEmit && bun run test:run
```

If any of these fail, fix the issues before committing. The CI/CD pipeline will run the same checks and fail if they don't pass.

## RPC API Reference

All API calls go through ElectroBun RPC:

```typescript
import { api } from "@/lib/api";

// Feeds
const feeds = await api.feeds.getAll();
const newFeed = await api.feeds.add({ title, url, description });
await api.feeds.delete(id);
const result = await api.feeds.refresh(id);
const allResult = await api.feeds.refreshAll();

// Articles
const articles = await api.articles.fetch({ feedId, filter, limit, offset });
await api.articles.markRead(id, true);
await api.articles.toggleStarred(id, true);

// Settings
const setting = await api.settings.get(key);
await api.settings.set(key, value);

// Translation
const translated = await api.translation.translate(text, targetLang);
await api.translation.save(articleId, content);
const saved = await api.translation.get(articleId);
```

## Database

- **Location**: `~/Library/Application Support/rss-reader/data.db` (macOS)
- **Engine**: SQLite via Bun's native support
- **Tables**: feeds, articles, settings, translations

## Keyboard Shortcuts

| Key           | Action            |
| ------------- | ----------------- |
| `j` / `↓`     | Next article      |
| `k` / `↑`     | Previous article  |
| `o` / `Enter` | Open in browser   |
| `r`           | Refresh all feeds |
| `m`           | Toggle theme      |
| `s`           | Toggle star       |

## Common Development Tasks

### Adding a New Backend RPC Handler

1. Add handler in `src/bun/index.ts` using `defineElectrobunRPC`
2. Update `src/shared/rpc-schema.ts` with the new method
3. Frontend can now call it via `api.*`

### Adding a New Component

1. Create file in `src/components/ComponentName.tsx`
2. Import from `@/components/ComponentName`
3. Add to parent component

## Dependencies

- **Frontend**: react, zustand, @tanstack/react-query, tailwindcss
- **Backend (Bun)**: hono, rss-parser, better-sqlite3 (built-in)
- **Desktop**: electrobun

## License

MIT License
