#!/bin/bash
# Clean build script for Tauri

echo "Cleaning Tauri build cache..."

# Clean Rust target
rm -rf src-tauri/target

# Clean npm cache
rm -rf node_modules/.cache
rm -rf node_modules/.vite

# Clean cargo cache
cargo clean 2>/dev/null || true

echo "Done! Now run: npm run tauri dev"
