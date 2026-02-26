# 📡 RSS Reader

A fast, comfortable RSS reader desktop app built with **ElectroBun**.

![RSS Reader](./docs/icon.svg)

## ✨ Features

- **📦 RSS Subscription** - Add and manage RSS feed subscriptions
- **📰 Article List** - Clean, time-sorted article listing
- **📖 Reader View** - Distraction-free reading experience
- **🌙 Theme Support** - Light, Dark, or System preference
- **📥 OPML Import/Export** - Migrate from other RSS readers
- **⌨️ Keyboard Shortcuts** - Navigate efficiently
- **⭐ Star Articles** - Save important articles
- **🏷️ Filter Articles** - View all, unread, or starred
- **🌐 Translation** - Translate articles to Chinese

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) 1.3+

### Installation

```bash
# Clone the repository
git clone https://github.com/bingal/rss-reader.git
cd rss-reader

# Install dependencies
bun install

# Run in development mode (frontend only - hot reload)
bun run dev

# Run with ElectroBun desktop app
bun run dev:electron

# Build for production
bun run build:electron
```

## 🏗️ Architecture

Built with **ElectroBun** - a modern desktop app framework:

```
┌─────────────────────────────────────────────────────────┐
│                  ElectroBun App                          │
│  ┌──────────────────┐    ┌──────────────────────────┐ │
│  │  BrowserWindow   │    │   Bun + Hono Backend     │ │
│  │  (React Frontend)│◄──►│   - SQLite Database      │ │
│  │                  │ RPC │   - RSS Parser           │ │
│  │                  │    │   - Translation API       │ │
│  └──────────────────┘    └──────────────────────────┘ │
│                                                         │
│  System WebView (WebKit/Edge)                         │
└─────────────────────────────────────────────────────────┘
```

### Key Benefits

- **Ultra-fast**: <50ms startup time
- **Tiny bundle**: ~14MB (vs 150MB+ for Electron)
- **Type-safe**: Full TypeScript RPC between frontend and backend
- **No Rust**: Pure TypeScript/Bun

## 📖 Usage

### Keyboard Shortcuts

| Key       | Action            |
| --------- | ----------------- |
| `j` / `↓` | Next article      |
| `k` / `↑` | Previous article  |
| `o`       | Open in browser   |
| `r`       | Refresh all feeds |
| `m`       | Toggle theme      |
| `s`       | Toggle star       |

## 🛠️ Development

```bash
# Format code
bun run format

# Lint
bun run lint

# Run tests
bun run test:run

# Type check
bunx tsc --noEmit
```

## 📁 Project Structure

```
rss-reader/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── lib/               # API client (RPC)
│   └── stores/            # Zustand state
├── src/bun/               # ElectroBun entry point
├── backend/               # Backend handlers
│   └── src/
│       ├── db/            # SQLite
│       └── routes/        # API handlers
└── dist/                  # Built app
```

## 📄 License

MIT
