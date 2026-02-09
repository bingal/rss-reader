# RSS Reader - Agent Guide

This document provides essential information for AI coding agents working on the RSS Reader project.

## Project Overview

RSS Reader is a fast, comfortable desktop RSS reader application built with **Tauri 2.x** (Rust backend + Web frontend). It allows users to subscribe to RSS feeds, read articles, star favorites, and manage subscriptions via OPML import/export.

### Technology Stack

- **Frontend**: React 19, TypeScript 5, Vite 7
- **Styling**: Tailwind CSS v4, shadcn/ui (New York style)
- **State Management**: Zustand (persistent), React Query (server state)
- **Backend**: Tauri 2.x (Rust), SQLite via rusqlite
- **RSS Parsing**: feed-rs crate
- **Testing**: Vitest, React Testing Library
- **Build Tooling**: Cargo (Rust), npm (Node.js)

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
├── src-tauri/                 # Rust backend (Tauri)
│   ├── src/
│   │   ├── lib.rs             # Tauri commands & entry
│   │   ├── db.rs              # SQLite database operations
│   │   └── rss.rs             # RSS feed fetching & parsing
│   ├── icons/                 # App icons
│   ├── capabilities/          # Tauri permissions
│   ├── Cargo.toml             # Rust dependencies
│   └── tauri.conf.json        # Tauri configuration
├── .github/workflows/         # CI/CD
│   └── build.yml              # Multi-platform build
├── package.json               # Node.js dependencies
├── vite.config.ts             # Vite + Vitest config
├── tsconfig.json              # TypeScript config
├── eslint.config.js           # ESLint config
└── components.json            # shadcn/ui config
```

## Build and Development Commands

```bash
# Development (Vite dev server only)
npm run dev

# Development (with Tauri desktop app)
npm run tauri dev

# Build frontend for production
npm run build

# Build desktop app for production
npm run tauri build

# Run tests
npm run test              # Watch mode
npm run test:run          # Single run

# Code quality
npm run lint              # ESLint
npm run format            # Prettier (write)
npm run format:check      # Prettier (check)
npx tsc --noEmit          # TypeScript type check

# Preview production build
npm run preview
```

## Architecture Details

### Frontend-Backend Communication

The frontend communicates with the Rust backend via **Tauri Commands** using `invoke()`:

```typescript
import { invoke } from "@tauri-apps/api/core";

// Example: Fetch all feeds
const feeds = await invoke<Feed[]>("get_all_feeds");

// Example: Add new feed
await invoke<Feed>("add_new_feed", { title, url, description, category });
```

Available commands (defined in `src-tauri/src/lib.rs`):
- `get_all_feeds` - List all subscribed feeds
- `add_new_feed` - Subscribe to a new feed
- `delete_feed` - Remove a feed and its articles
- `fetch_articles` - Get articles with optional feed/filter
- `refresh_feed` - Fetch new articles from specific feed
- `refresh_all_feeds` - Refresh all feeds
- `mark_read` - Mark article as read/unread
- `toggle_starred` - Toggle article star status
- `get_app_setting` / `set_app_setting` - App settings
- `translate_text` - Translate content via LibreTranslate

### Database Schema (SQLite)

Three main tables managed in `src-tauri/src/db.rs`:

**feeds**: RSS subscriptions
- `id` (TEXT PRIMARY KEY)
- `title`, `url` (TEXT, UNIQUE)
- `description`, `image_url`, `category` (TEXT, optional)
- `created_at`, `updated_at` (INTEGER, unix timestamp)

**articles**: Feed entries
- `id` (TEXT PRIMARY KEY)
- `feed_id` (TEXT, FOREIGN KEY)
- `title`, `link`, `content`, `summary` (TEXT)
- `author` (TEXT, optional)
- `pub_date`, `fetched_at` (INTEGER)
- `is_read`, `is_starred` (INTEGER, 0/1)

**settings**: Key-value store for app settings
- `key` (TEXT PRIMARY KEY)
- `value` (TEXT)

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

| Key | Action |
|-----|--------|
| `j` / `↓` | Next article |
| `k` / `↑` | Previous article |
| `o` / `Enter` | Open in browser |
| `r` | Refresh all feeds |
| `m` | Toggle theme |
| `s` | Toggle star |
| `?` | Show shortcuts (placeholder) |

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

### Rust

- Error handling: Use `Result<T, String>` for Tauri commands
- Database: rusqlite with `?` placeholders
- async: Uses `reqwest::blocking` for HTTP requests

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
   - Format check (`npm run format:check`)
   - Lint (`npm run lint`)
   - TypeScript check
   - Unit tests (`npm run test:run`)

2. **Build jobs** (parallel, needs: check):
   - **macOS**: Builds for aarch64 and x86_64, produces `.dmg`
   - **Windows**: Produces `.msi` and `.exe`
   - **Linux**: Produces `.deb`, `.rpm`, `.AppImage`

3. **Release job** (on tag `v*`):
   - Creates GitHub release with all artifacts

Triggers: Push to `main`, PRs to `main`, release tags

## Security Considerations

1. **CSP**: Currently `null` in `tauri.conf.json` (development-friendly, tighten for production)
2. **Translation API**: Uses public LibreTranslate endpoint (rate-limited, consider proxy)
3. **Database**: SQLite stored in user's data directory (`dirs::data_dir()`)
4. **Update Keys**: Public key embedded in `tauri.conf.json` for auto-updater

## Common Development Tasks

### Adding a New Tauri Command

1. Add command function in `src-tauri/src/lib.rs` (or appropriate module)
2. Export from module if in separate file
3. Register in `tauri::generate_handler![]` macro
4. Call from frontend via `invoke("command_name", args)`
5. Add types for return value in frontend

### Adding a New Component

1. Create file in `src/components/ComponentName.tsx`
2. Use shadcn/ui patterns (if applicable)
3. Import from `@/components/ComponentName`
4. Add to parent component or route

### Database Migrations

The project uses automatic schema creation in `init_db()`. To modify schema:
1. Update `init_db()` SQL in `src-tauri/src/db.rs`
2. Consider adding migration logic for existing users
3. Test with fresh and existing databases

## Dependencies to Know

### Key Frontend Dependencies
- `@tauri-apps/api` - Tauri bridge
- `@tanstack/react-query` - Server state management
- `zustand` - Client state management
- `tailwindcss` v4 - Styling
- `clsx` + `tailwind-merge` - Conditional classes

### Key Rust Dependencies
- `tauri` - Desktop framework
- `rusqlite` - SQLite bindings
- `feed-rs` - RSS/Atom parsing
- `reqwest` - HTTP client
- `chrono` - Date/time handling
- `uuid` - ID generation

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

**Database locked errors**:
- Each operation opens/closes connection; ensure no long-running transactions
- Check for connection leaks in custom code

**Tauri API not found in tests**:
- Mock is in `src/test/setup.ts`
- Ensure `vi.mock()` is at top of test file

## License

MIT License - See LICENSE file
