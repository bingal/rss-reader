# RSS Reader

A fast, comfortable RSS reader desktop app built with Tauri 2.x, React, TypeScript, and Tailwind CSS v4.

## Features

- 📦 RSS Subscription - Add/remove feeds by URL
- 📰 Article List - Two-column layout, chronological order
- 📖 Article Reader - Clean reading view with lazy image loading
- 🌙 Theme System - Light/Dark/System auto-switch
- 📥 OPML Import/Export - Batch import/export feed subscriptions
- ⌨️ Keyboard Shortcuts - j/k navigation
- 🌐 Article Translation - Built-in translation support

## Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui
- **Backend**: Tauri 2.x (Rust) + SQLite
- **State**: React Query + Zustand

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run Tauri dev
npm run tauri dev
```

## Project Structure

```
rss-reader/
├── src/               # React frontend
│   ├── components/    # UI components
│   ├── hooks/        # Custom hooks
│   ├── stores/       # Zustand stores
│   ├── utils/        # Utility functions
│   └── lib/          # Third-party configs
├── src-tauri/         # Tauri Rust backend
│   ├── src/          # Rust source
│   ├── capabilities/ # Permission configs
│   └── tauri.conf.json
├── docs/             # Documentation
└── public/           # Static assets
```

## License

MIT
