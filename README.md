# 📡 RSS Reader

A fast, comfortable RSS reader desktop app built with Tauri 2.x.

![RSS Reader](https://via.placeholder.com/800x400?text=RSS+Reader)

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

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) 1.70+
- [Tauri Prerequisites](https://tauri.app/v2/guides/getting-started/prerequisites)

### Installation

```bash
# Clone the repository
git clone https://github.com/bingal/rss-reader.git
cd rss-reader

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm run test:run
```

### Desktop App

```bash
# Build and run Tauri app
npm run tauri dev

# Build production bundle
npm run tauri build
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

- **Frontend**: React 19, TypeScript
- **Styling**: Tailwind CSS v4, shadcn/ui
- **State**: Zustand, React Query
- **Backend**: Tauri 2.x (Rust), SQLite
- **Testing**: Vitest, React Testing Library

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
│   │   ├── opml.ts      # OPML import/export
│   │   └── utils.ts
│   ├── stores/          # Zustand stores
│   │   └── useAppStore.ts
│   ├── App.tsx          # Main app component
│   └── main.tsx         # Entry point
├── src-tauri/           # Tauri Rust backend
│   ├── src/
│   │   ├── db.rs        # SQLite database
│   │   ├── rss.rs       # RSS parsing
│   │   └── lib.rs       # Tauri commands
│   └── Cargo.toml
├── docs/                # Documentation
└── package.json
```

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run tests once
npm run test:run

# Watch mode
npm run test
```

## 📦 Building

### Cross-Platform Build

```bash
# Build for all platforms
npm run tauri build

# Or individually:
npm run tauri build -- --target universal-apple-darwin  # macOS
npm run tauri build -- --target x86_64-pc-windows-msvc   # Windows
npm run tauri build -- --target x86_64-unknown-linux-gnu # Linux
```

## 🔄 CI/CD

### GitHub Actions

This project uses GitHub Actions for automated builds on macOS, Windows, and Linux.

**Workflow**: [`.github/workflows/build.yml`](.github/workflows/build.yml)

**Triggers**:

- Push to `main` branch
- Pull requests to `main`
- Creating a release tag (e.g., `v1.0.0`)

**Build Matrix**:
| Platform | Artifacts |
|----------|-----------|
| macOS | `.dmg` (Apple Silicon + Intel) |
| Windows | `.msi`, `.exe` |
| Linux | `.deb`, `.rpm`, `.AppImage` |

**Artifacts** are uploaded automatically and can be downloaded from the Actions tab.

### Setup for Automated Builds

1. Go to repository Settings → Secrets
2. Add the following secrets:
   - `TAURI_PRIVATE_KEY`: Your Tauri private key
   - `TAURI_KEY_PASSWORD`: Your Tauri key password
3. Create a release tag and push to trigger the build

```bash
# Create a version tag
git tag v0.1.0
git push origin v0.1.0
```

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
- [React](https://reactjs.org/) - A JavaScript library for building user interfaces
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [feed-rs](https://github.com/feed-rs/feed-rs) - RSS/Atom feed parsing library
