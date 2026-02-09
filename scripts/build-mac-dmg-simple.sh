#!/bin/bash

# Simple build script for macOS DMG (unsigned)
# Uses Tauri's built-in bundler

set -e

echo "=========================================="
echo "RSS Reader - macOS DMG Builder (Unsigned)"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}Error: Must run on macOS${NC}"
    exit 1
fi

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Default to current architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    TARGET="aarch64-apple-darwin"
    TARGET_NAME="Apple Silicon"
else
    TARGET="x86_64-apple-darwin"
    TARGET_NAME="Intel"
fi

# Parse args
for arg in "$@"; do
    case $arg in
        --intel)
            TARGET="x86_64-apple-darwin"
            TARGET_NAME="Intel"
            shift
            ;;
        --universal)
            TARGET="universal-apple-darwin"
            TARGET_NAME="Universal"
            shift
            ;;
    esac
done

echo "Building for: $TARGET_NAME ($TARGET)"
echo ""

# Install deps
echo "Installing dependencies..."
npm ci

# Add Rust target
echo "Adding Rust target: $TARGET"
rustup target add "$TARGET" 2>/dev/null || true

# Build
echo ""
echo "Building app (unsigned)..."
echo -e "${YELLOW}This may take a few minutes...${NC}"
echo ""

# Disable signing
export TAURI_SIGNING_PRIVATE_KEY=""
export TAURI_KEY_PASSWORD=""
export MACOSX_DEPLOYMENT_TARGET="10.13"

# Build with Tauri
if [ "$TARGET" = "universal-apple-darwin" ]; then
    npm run tauri build -- --target universal-apple-darwin
else
    npm run tauri build -- --target "$TARGET"
fi

# Find DMG
DMG_DIR="src-tauri/target/release/bundle/dmg"
if [ "$TARGET" = "universal-apple-darwin" ]; then
    DMG_DIR="src-tauri/target/universal-apple-darwin/release/bundle/dmg"
fi

DMG=$(find "$DMG_DIR" -name "*.dmg" 2>/dev/null | head -1)

if [ -f "$DMG" ]; then
    echo ""
    echo "=========================================="
    echo -e "${GREEN}✓ Build successful!${NC}"
    echo "=========================================="
    echo ""
    echo "File: $DMG"
    echo "Size: $(du -h "$DMG" | cut -f1)"
    echo ""
    echo -e "${YELLOW}Note: Unsigned build - users need to right-click → Open${NC}"
    echo ""
else
    echo -e "${RED}Error: DMG not found${NC}"
    exit 1
fi
