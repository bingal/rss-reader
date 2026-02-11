# 📡 RSS Reader

A fast, comfortable RSS reader desktop app built with Tauri 2.x + Bun sidecar architecture.

![RSS Reader](./src-tauri/icons/icon.svg)

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

- [Node.js](https://nodejs.org/) 18+ or [Bun](https://bun.sh/) 1.0+
- [Rust](https://rustup.rs/) 1.70+
- [Tauri Prerequisites](https://tauri.app/v2/guides/getting-started/prerequisites)

### Installation

```bash
# Clone the repository
git clone https://github.com/bingal/rss-reader.git
cd rss-reader

# Install dependencies
npm install
# Or with Bun
bun install

# Install backend dependencies
cd backend && npm install && cd ..
# Or with Bun
cd backend && bun install && cd ..

# Run in development mode (frontend only)
bun run dev

# Run with Tauri desktop app
bun run tauri dev

# Build for production
bun run build

# Run tests
bun run test:run
```

### Desktop App

```bash
# Development mode (with hot reload)
bun run tauri dev

# Or with Bun
bun run tauri build

# Note: Backend binary must be built first for production builds
cd backend
bun build src/index.ts --compile --target=bun-darwin-arm64 --outfile ../src-tauri/binaries/backend-aarch64-apple-darwin
# See CI/CD section for all platform targets
```

## 📖 Usage

### Adding Feeds

1. Click the + button in the sidebar
2. Enter the RSS feed URL
3. Give it a name (optional)

### Keyboard Shortcuts

| Key           | Action           |
| ------------- | ---------------- |
| `j` / `↓`     | Next article     |
| `k` / `↑`     | Previous article |
| `o` / `Enter` | Open in browser  |
| `r`           | Refresh feeds    |
| `m`           | Toggle theme     |
| `s`           | Toggle star      |
| `?`           | Show shortcuts   |

### OPML Import/Export

1. Click the import/export button (📥)
2. Choose Import to add feeds from another reader
3. Choose Export to backup your subscriptions

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript 5, Vite 7
- **Styling**: Tailwind CSS v4, shadcn/ui
- **State Management**: Zustand, React Query
- **Backend**: Bun (TypeScript) with Hono framework
- **Desktop Shell**: Tauri 2.x (Rust)
- **Database**: SQLite (via Bun's native sqlite3)
- **RSS Parsing**: rss-parser npm package
- **Testing**: Vitest, React Testing Library

### Architecture

This app uses a **Tauri + Bun sidecar** architecture:

1. **Tauri Shell** (Rust) - Minimal wrapper that launches the backend
2. **Bun Backend** (TypeScript) - Compiled to standalone binary, handles all RSS logic
3. **React Frontend** - Communicates with backend via HTTP API
4. **SQLite Database** - Stores feeds, articles, settings

Benefits:

- Fast development with TypeScript for both frontend and backend
- Bun's excellent performance and small binary size
- Tauri provides native desktop experience
- Clean separation between UI and business logic

## 📁 Project Structure

```
rss-reader/
├── src/
│   ├── components/       # React components
│   │   ├── Sidebar.tsx  # Feed list sidebar
│   │   ├── ArticleList.tsx
│   │   ├── ArticleView.tsx
│   │   └── OPMLImport.tsx
│   ├── hooks/           # Custom React hooks
│   │   └── useKeyboardShortcuts.ts
│   ├── lib/             # Utility functions
│   │   ├── api.ts       # Backend API client
│   │   ├── opml.ts      # OPML import/export
│   │   └── utils.ts
│   ├── stores/          # Zustand stores
│   │   └── useAppStore.ts
│   ├── App.tsx          # Main app component
│   └── main.tsx         # Entry point
├── backend/             # Bun backend server
│   ├── src/
│   │   ├── index.ts     # Server entry point
│   │   ├── db/          # SQLite connection & schema
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Business logic (RSS parsing)
│   │   ├── types/       # TypeScript types
│   │   └── utils/       # Helper functions
│   └── package.json
├── src-tauri/           # Tauri Rust wrapper
│   ├── src/
│   │   └── lib.rs       # Launches backend sidecar
│   ├── binaries/        # Compiled backend binaries
│   └── Cargo.toml
├── docs/                # Documentation
└── package.json
```

## 🧪 Testing

```bash
# Run all tests
npm run test
# Or with Bun
bun run test

# Run tests once
npm run test:run
bun run test:run

# Watch mode
npm run test
bun run test
```

## 📦 Building

### Cross-Platform Build

The CI/CD pipeline automatically builds for all platforms. For local builds:

```bash
# Build backend binary first
cd backend

# macOS (both architectures)
bun build src/index.ts --compile --target=bun-darwin-arm64 --outfile ../src-tauri/binaries/backend-aarch64-apple-darwin
bun build src/index.ts --compile --target=bun-darwin-x64 --outfile ../src-tauri/binaries/backend-x86_64-apple-darwin

# Windows
bun build src/index.ts --compile --target=bun-windows-x64 --outfile ../src-tauri/binaries/backend-x86_64-pc-windows-msvc.exe

# Linux
bun build src/index.ts --compile --target=bun-linux-x64 --outfile ../src-tauri/binaries/backend-x86_64-unknown-linux-gnu

cd ..

# Then build Tauri app
npm run tauri build
# Or with Bun
bun run tauri build
```

For macOS universal binary, use `lipo` to combine both architectures (automated in CI).

## 🔄 CI/CD

### GitHub Actions

This project uses GitHub Actions with **Bun** for automated builds on macOS, Windows, and Linux.

**Workflow**: [`.github/workflows/build.yml`](.github/workflows/build.yml)

**Triggers**:

- Push to `main` branch
- Pull requests to `main`
- Creating a release tag (e.g., `v1.0.0`)

**Build Process**:

1. **Check Phase**: Runs format, lint, typecheck, and tests using Bun
2. **Build Phase**: For each platform:
   - Compiles Bun backend binary for the target architecture
   - Builds Tauri app with the backend binary
   - Packages as platform-specific installer
3. **Release Phase**: Uploads all artifacts to GitHub release (on version tags)

**Build Matrix**:
| Platform | Backend Target | Output |
|----------|----------------|--------|
| macOS | arm64 + x64 → universal binary | `.dmg` |
| Windows | x64 | `.msi`, `.exe` |
| Linux | x64 | `.deb`, `.rpm`, `.AppImage` |

**Artifacts** are uploaded automatically and can be downloaded from the Actions tab.

### Setup for Automated Builds

No additional secrets required! The workflow uses:

- Bun for frontend and backend builds
- GitHub's built-in `GITHUB_TOKEN` for releases

To create a release:

```bash
# Create and push a version tag
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions will automatically build and create a release with all platform binaries.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Tauri](https://tauri.app/) - Build smaller, faster, and more secure desktop applications
- [Bun](https://bun.sh/) - Fast all-in-one JavaScript runtime
- [React](https://reactjs.org/) - A JavaScript library for building user interfaces
- [Hono](https://hono.dev/) - Ultrafast web framework for the Edge
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [rss-parser](https://github.com/rbren/rss-parser) - RSS/Atom feed parsing library
