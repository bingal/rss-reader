# AGENTS.md

This file provides guidance to Qoder (qoder.com) when working with code in this repository.

## RSS Reader - Agent Guide

This document provides essential information for AI coding agents working on the RSS Reader project.

## Project Overview

RSS Reader is a fast, comfortable desktop RSS reader application built with **Tauri 2.x + Bun sidecar architecture**. It allows users to subscribe to RSS feeds, read articles, star favorites, and manage subscriptions via OPML import/export.

### Technology Stack

- **Frontend**: React 19, TypeScript 5, Vite 7
- **Styling**: Tailwind CSS v4, shadcn/ui (New York style)
- **State Management**: Zustand (persistent), React Query (server state)
- **Backend**: Bun (TypeScript) with Hono framework, bundled as external binary
- **Desktop Shell**: Tauri 2.x (Rust) - lightweight wrapper that runs the Bun backend
- **RSS Parsing**: rss-parser npm package
- **Testing**: Vitest, React Testing Library
- **Build Tooling**: Bun (backend compilation), Cargo (Tauri shell), npm/bun (frontend)

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
│   │   ├── utils.ts           # cn() helper, date formatters
│   │   ├── opml.ts            # OPML import/export logic
│   │   └── opml.test.ts       # OPML tests
│   ├── stores/                # Zustand state stores
│   │   ├── useAppStore.ts     # Main app state
│   │   └── useAppStore.test.ts
│   ├── test/                  # Test setup
│   │   └── setup.ts           # Vitest mocks
│   ├── App.tsx                # Root component
│   ├── main.tsx               # Entry point
│   └── index.css              # Tailwind CSS variables
├── backend/                   # Bun backend (TypeScript + Hono)
│   ├── src/
│   │   ├── index.ts           # Backend API server entry point
│   │   ├── db/                # SQLite database connection & schema
│   │   ├── routes/            # API route handlers
│   │   │   ├── feeds.ts       # Feed management endpoints
│   │   │   ├── articles.ts    # Article endpoints
│   │   │   ├── settings.ts    # Settings endpoints
│   │   │   └── translation.ts # Translation endpoints
│   │   ├── services/          # Business logic (RSS parsing, etc.)
│   │   ├── types/             # TypeScript type definitions
│   │   └── utils/             # Utility functions
│   └── package.json           # Backend dependencies (hono, rss-parser)
├── src-tauri/                 # Tauri shell (Rust wrapper)
│   ├── src/
│   │   └── lib.rs             # Tauri entry point (launches backend sidecar)
│   ├── binaries/              # Compiled Bun backend binaries
│   │   ├── backend-aarch64-apple-darwin
│   │   ├── backend-x86_64-apple-darwin
│   │   ├── backend-x86_64-pc-windows-msvc.exe
│   │   └── backend-x86_64-unknown-linux-gnu
│   ├── icons/                 # App icons
│   ├── capabilities/          # Tauri permissions (shell-sidecar)
│   ├── Cargo.toml             # Rust dependencies (minimal)
│   └── tauri.conf.json        # Tauri configuration
├── .github/workflows/         # CI/CD
│   └── build.yml              # Multi-platform build
├── package.json               # Frontend dependencies
├── vite.config.ts             # Vite + Vitest config
├── tsconfig.json              # TypeScript config
├── eslint.config.js           # ESLint config
└── components.json            # shadcn/ui config
```

## Build and Development Commands

```bash
# Development (Vite dev server only)
npm run dev
bun run dev               # Alternative with Bun

# Development (with Tauri desktop app)
npm run tauri dev
bun run tauri dev         # Alternative with Bun

# Backend development (standalone)
cd backend && bun run dev

# Build frontend for production
npm run build
bun run build             # Alternative with Bun

# Build desktop app for production
npm run tauri build
bun run tauri build       # Alternative with Bun

# Run tests
npm run test              # Watch mode
npm run test:run          # Single run
bun run test              # Watch mode with Bun
bun run test:run          # Single run with Bun

# Code quality
npm run lint              # ESLint
npm run format            # Prettier (write)
npm run format:check      # Prettier (check)
bun run lint              # ESLint with Bun
bun run format            # Prettier (write) with Bun
bun run format:check      # Prettier (check) with Bun
npx tsc --noEmit          # TypeScript type check
bunx tsc --noEmit         # TypeScript type check with Bun

# Preview production build
npm run preview
bun run preview           # Alternative with Bun
```

## Architecture Details

### Overview

This project uses a **Tauri + Bun sidecar** architecture:

1. **Frontend**: React app bundled with Vite
2. **Tauri Shell**: Minimal Rust wrapper that launches the Bun backend as a sidecar process
3. **Bun Backend**: Compiled TypeScript server (Hono framework) that handles RSS parsing and data management
4. **Communication**: Frontend → HTTP API (localhost) → Bun Backend

### Frontend-Backend Communication

The frontend communicates with the Bun backend via **HTTP API**:

1. **Dynamic Port Discovery**: Tauri launches the backend on a random port (port 0) to avoid conflicts
2. **Port Communication**: Backend writes `PORT:<number>` to stdout, Tauri reads it
3. **Tauri Command**: Frontend calls `invoke("get_backend_port")` to get the dynamic port
4. **HTTP Requests**: Frontend makes fetch requests to `http://localhost:<port>/api/*`

```typescript
// src/lib/api.ts - Dynamic port discovery
import { invoke } from "@tauri-apps/api/core";

// Get dynamic backend port from Tauri
const port = await invoke<number>("get_backend_port");
const baseUrl = `http://localhost:${port}`;

// Make API request
const response = await fetch(`${baseUrl}/api/feeds`);
const feeds = await response.json();
```

**Key Point**: There is ONE Tauri command (`get_backend_port`) - all other communication is via HTTP API.

```typescript
import { invoke } from "@tauri-apps/api/core";

// Example: Fetch all feeds
const feeds = await invoke<Feed[]>("get_all_feeds");

// Example: Add new feed
await invoke<Feed>("add_new_feed", { title, url, description, category });
```

Backend API endpoints (defined in `backend/src/routes/`):

**Feeds** (`routes/feeds.ts`):
- `GET /api/feeds` - List all subscribed feeds
- `POST /api/feeds` - Subscribe to a new feed
- `DELETE /api/feeds/:id` - Remove a feed and its articles
- `POST /api/feeds/:id/refresh` - Fetch new articles from specific feed
- `POST /api/feeds/refresh-all` - Refresh all feeds

**Articles** (`routes/articles.ts`):
- `GET /api/articles` - Get articles with optional query params (feedId, filter, limit, offset)
- `PATCH /api/articles/:id/read` - Mark article as read/unread
- `PATCH /api/articles/:id/starred` - Toggle article star status

**Settings** (`routes/settings.ts`):
- `GET /api/settings/:key` - Get app setting
- `PUT /api/settings/:key` - Set app setting

**Translation** (`routes/translation.ts`):
- `POST /api/translate` - Translate text to target language
- `POST /api/translations/save` - Save translation for article
- `GET /api/translations/:articleId` - Get saved translation

### Backend Architecture

The backend is a **Bun server** using the **Hono** framework:

- **Runtime**: Bun (fast TypeScript runtime)
- **Framework**: Hono (lightweight web framework)
- **Database**: SQLite (via Bun's native sqlite3)
- **RSS Parsing**: `rss-parser` npm package
- **Deployment**: Compiled to standalone executables for each platform
- **Execution**: Runs as a Tauri sidecar process (external binary)
- **Port**: Dynamic (port 0) to avoid conflicts

**Database Schema** (in `backend/src/db/`):
- **feeds**: RSS subscriptions (id, title, url, description, imageUrl, category, createdAt, updatedAt)
- **articles**: Feed entries (id, feedId, title, link, content, summary, author, pubDate, isRead, isStarred, fetchedAt)
- **settings**: Key-value store (key, value)
- **translations**: Saved translations (articleId, content)

### State Management

**Zustand** (`useAppStore`): Client-side state

- Theme (light/dark/system)
- Selected feed ID
- Article filter (all/unread/starred)
- Read article tracking (Set<string>)
- Feed cache
- Persisted to localStorage

**React Query**: Server state (from Tauri/SQLite)

- Feed list (`["feeds"]`)
- Articles (`["articles", feedId, filter, limit]`)
- Auto-refetch on mutations

### Keyboard Shortcuts

Vim-style shortcuts implemented in `useKeyboardShortcuts.ts`:

| Key           | Action                       |
| ------------- | ---------------------------- |
| `j` / `↓`     | Next article                 |
| `k` / `↑`     | Previous article             |
| `o` / `Enter` | Open in browser              |
| `r`           | Refresh all feeds            |
| `m`           | Toggle theme                 |
| `s`           | Toggle star                  |
| `?`           | Show shortcuts (placeholder) |

## Code Style Guidelines

### TypeScript

- Strict mode enabled (`strict: true` in tsconfig.json)
- Path alias `@/` maps to `./src/`
- Unused locals/parameters must be avoided (`noUnusedLocals: true`)
- Functional components with explicit prop types

### Naming Conventions

- **Components**: PascalCase (`ArticleList.tsx`)
- **Hooks**: camelCase starting with `use` (`useKeyboardShortcuts.ts`)
- **Utilities**: camelCase (`utils.ts`)
- **Types/Interfaces**: PascalCase (`Feed`, `Article`)

### CSS/Styling

- Tailwind CSS v4 with CSS variables for theming
- Use `cn()` utility from `@/lib/utils` for conditional classes
- Color tokens: `--color-background`, `--color-foreground`, etc.
- Dark mode via `.dark` class on `<html>`

### Backend (TypeScript/Bun)

- Framework: Hono (Express-like web framework)
- RSS Parsing: `rss-parser` npm package
- Runtime: Bun (compiled to standalone executable)
- Error handling: Standard try-catch with HTTP status codes

### Rust (Tauri Shell)

- Minimal code - only launches the Bun backend sidecar and exposes one command
- `get_backend_port` command: Returns the dynamic port the backend is running on
- Tauri configuration in `tauri.conf.json`
- External binary configuration: `externalBin: ["binaries/backend"]`
- Backend startup: Launches with `--port=0`, reads `PORT:<number>` from stdout

## Testing Strategy

### Frontend Tests (Vitest)

```bash
# Run all tests
npm run test:run

# Specific test file
npx vitest run src/lib/opml.test.ts
```

**Test files pattern**: `src/**/*.{test,spec}.{js,ts,jsx,tsx}`

**Key testing patterns**:

- Mock Tauri API in `src/test/setup.ts`
- Mock `window.matchMedia` for theme tests
- Use `@testing-library/react` for component tests
- Zustand store tests use `act()` for state updates

### Example Test Structure

```typescript
import { describe, it, expect } from "vitest";

describe("Feature", () => {
  it("should do something", () => {
    expect(result).toBe(expected);
  });
});
```

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/build.yml`):

1. **Check job** (ubuntu-latest):
   - Format check (`bun run format:check`)
   - Lint (`bun run lint`)
   - TypeScript check (`bunx tsc --noEmit`)
   - Unit tests (`bun run test:run`)

2. **Build jobs** (parallel, needs: check):
   - **macOS**: 
     - Compiles Bun backend for aarch64 and x86_64
     - Builds Tauri app for both architectures separately
     - Merges into universal binary using `lipo`
     - Produces `.dmg`
   - **Windows**: 
     - Compiles Bun backend for x86_64
     - Builds Tauri app
     - Produces `.msi` and `.exe`
   - **Linux**: 
     - Compiles Bun backend for x86_64
     - Builds Tauri app
     - Produces `.deb`, `.rpm`, `.AppImage`

3. **Release job** (on tag `v*`):
   - Creates GitHub release with all artifacts

**Important**: Backend binaries must be compiled BEFORE running `tauri build`

Triggers: Push to `main`, PRs to `main`, release tags

## Security Considerations

1. **CSP**: Currently `null` in `tauri.conf.json` (development-friendly, tighten for production)
2. **Backend Port**: Backend runs on localhost only, not exposed to network
3. **Sidecar Permissions**: Backend runs as external binary with `shell-sidecar` capability
4. **Update Keys**: Public key embedded in `tauri.conf.json` for auto-updater
5. **External Binary**: Backend is bundled inside the app, not downloaded at runtime

## Common Development Tasks

### Adding a New Backend API Endpoint

1. Add route handler in `backend/src/index.ts`
2. Use Hono's routing: `app.get('/api/endpoint', async (c) => { ... })`
3. Call from frontend via `fetch('http://localhost:3000/api/endpoint')`
4. Add TypeScript types for request/response

### Adding a New Component

1. Create file in `src/components/ComponentName.tsx`
2. Use shadcn/ui patterns (if applicable)
3. Import from `@/components/ComponentName`
4. Add to parent component or route

### Building Backend Binaries for CI/CD

The backend must be compiled for each platform before Tauri build:

```bash
# macOS (both architectures)
cd backend
bun build src/index.ts --compile --target=bun-darwin-arm64 --outfile ../src-tauri/binaries/backend-aarch64-apple-darwin
bun build src/index.ts --compile --target=bun-darwin-x64 --outfile ../src-tauri/binaries/backend-x86_64-apple-darwin

# Windows
bun build src/index.ts --compile --target=bun-windows-x64 --outfile ../src-tauri/binaries/backend-x86_64-pc-windows-msvc.exe

# Linux
bun build src/index.ts --compile --target=bun-linux-x64 --outfile ../src-tauri/binaries/backend-x86_64-unknown-linux-gnu
```

For macOS universal binary, use `lipo` to merge both architectures.

## Dependencies to Know

### Key Frontend Dependencies

- `@tauri-apps/api` - Tauri bridge
- `@tanstack/react-query` - Server state management
- `zustand` - Client state management
- `tailwindcss` v4 - Styling
- `clsx` + `tailwind-merge` - Conditional classes

### Key Backend Dependencies (Bun)

- `hono` - Web framework for API endpoints
- `rss-parser` - RSS/Atom feed parsing
- `bun-types` - TypeScript types for Bun runtime

### Key Rust Dependencies (Tauri Shell)

- `tauri` - Desktop framework (minimal usage)
- `tauri-plugin-shell` - For launching backend sidecar
- `tauri-plugin-opener` - For opening external links

## Troubleshooting

### Common Issues

**Build fails with Rust errors**:

```bash
# Clean and rebuild
cd src-tauri && cargo clean && cd ..
npm run tauri dev
```

**TypeScript path resolution issues**:

- Ensure `@/*` imports use correct casing
- Check `tsconfig.json` paths config

**Backend not starting**:

- Check if backend binary exists in `src-tauri/binaries/` with correct name for your platform
- Check Tauri logs (stderr output) for backend startup messages
- Ensure backend binary has execute permissions (chmod +x on Unix)
- Verify backend can write to stdout (port announcement)

**Frontend can't connect to backend**:

- Backend may still be starting - check `get_backend_port` returns a valid port
- Verify backend is listening on the returned port
- Check browser console for CORS errors (backend has CORS enabled)
- Fallback URL in api.ts is `http://localhost:3456`

**Backend binary missing**:

```bash
cd backend
bun build src/index.ts --compile --target=bun-darwin-arm64 --outfile ../src-tauri/binaries/backend-aarch64-apple-darwin
```

**Tauri API not found in tests**:

- Mock is in `src/test/setup.ts`
- Ensure `vi.mock()` is at top of test file

**macOS universal build fails with "target not found"**:

- Don't use `--target universal-apple-darwin` directly
- Build both architectures separately, then merge with `lipo`

## License

MIT License - See LICENSE file
