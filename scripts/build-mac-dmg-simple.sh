#!/bin/bash

# Simple build script for macOS DMG (unsigned)
# Uses Tauri's built-in bundler with Bun backend

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

# Check Bun
if ! command -v bun &> /dev/null; then
    echo -e "${RED}Error: Bun is not installed${NC}"
    echo "Please install Bun: https://bun.sh/"
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
    BUN_TARGET="bun-darwin-arm64"
else
    TARGET="x86_64-apple-darwin"
    TARGET_NAME="Intel"
    BUN_TARGET="bun-darwin-x64"
fi

# Parse args
for arg in "$@"; do
    case $arg in
        --intel)
            TARGET="x86_64-apple-darwin"
            TARGET_NAME="Intel"
            BUN_TARGET="bun-darwin-x64"
            shift
            ;;
        --arm64)
            TARGET="aarch64-apple-darwin"
            TARGET_NAME="Apple Silicon"
            BUN_TARGET="bun-darwin-arm64"
            shift
            ;;
    esac
done

echo "Building for: $TARGET_NAME ($TARGET)"
echo ""

# Install deps
echo "Installing frontend dependencies..."
bun install
echo ""

echo "Installing backend dependencies..."
cd backend && bun install && cd ..
echo ""

# Add Rust target
echo "Adding Rust target: $TARGET"
rustup target add "$TARGET" 2>/dev/null || true

# Build backend binary
echo ""
echo "Building backend binary..."
cd backend
bun build src/index.ts --compile --target="$BUN_TARGET" --outfile "../src-tauri/binaries/backend-$TARGET"
chmod +x "../src-tauri/binaries/backend-$TARGET"
cd ..
echo -e "${GREEN}Backend binary built${NC}"
echo ""

# Build
echo "Building Tauri app (unsigned)..."
echo -e "${YELLOW}This may take a few minutes...${NC}"
echo ""

# Disable signing
export TAURI_SIGNING_PRIVATE_KEY=""
export TAURI_KEY_PASSWORD=""
export MACOSX_DEPLOYMENT_TARGET="10.13"

# Build with Tauri
bun run tauri build -- --target "$TARGET"

# Find DMG
DMG_DIR="src-tauri/target/$TARGET/release/bundle/dmg"
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
