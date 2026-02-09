#!/bin/bash

# Build macOS DMG without code signing
# This script builds universal binary (Apple Silicon + Intel) DMG for macOS

set -e

echo "=========================================="
echo "RSS Reader - macOS DMG Builder (Unsigned)"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}Error: This script must be run on macOS${NC}"
    exit 1
fi

# Check for required tools
if ! command -v cargo &> /dev/null; then
    echo -e "${RED}Error: Rust/Cargo is not installed${NC}"
    echo "Please install Rust: https://rustup.rs/"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "Project root: $PROJECT_ROOT"
echo ""

# Parse arguments
TARGET="universal-apple-darwin"
CLEAN_BUILD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --intel)
            TARGET="x86_64-apple-darwin"
            shift
            ;;
        --arm64)
            TARGET="aarch64-apple-darwin"
            shift
            ;;
        --clean)
            CLEAN_BUILD=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --intel     Build for Intel Macs only (x86_64)"
            echo "  --arm64     Build for Apple Silicon only (aarch64)"
            echo "  --clean     Clean build (remove target directory first)"
            echo "  --help      Show this help message"
            echo ""
            echo "Default: Build universal binary (Intel + Apple Silicon)"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "Build target: $TARGET"
echo ""

# Clean build if requested
if [ "$CLEAN_BUILD" = true ]; then
    echo -e "${YELLOW}Cleaning previous build...${NC}"
    rm -rf src-tauri/target/release
    echo "Done"
    echo ""
fi

# Install dependencies
echo "Installing npm dependencies..."
npm ci
echo -e "${GREEN}Dependencies installed${NC}"
echo ""

# Add Rust targets
echo "Setting up Rust targets..."
if [ "$TARGET" = "universal-apple-darwin" ]; then
    rustup target add aarch64-apple-darwin x86_64-apple-darwin || true
elif [ "$TARGET" = "aarch64-apple-darwin" ]; then
    rustup target add aarch64-apple-darwin || true
else
    rustup target add x86_64-apple-darwin || true
fi
echo -e "${GREEN}Rust targets ready${NC}"
echo ""

# Build frontend
echo "Building frontend..."
npm run build
echo -e "${GREEN}Frontend build complete${NC}"
echo ""

# Build Tauri app (unsigned)
echo "Building Tauri app (unsigned)..."
echo -e "${YELLOW}Note: Code signing is disabled${NC}"
echo ""

# Set environment variables to disable signing
export MACOSX_DEPLOYMENT_TARGET="10.13"
export TAURI_SIGNING_PRIVATE_KEY=""
export TAURI_KEY_PASSWORD=""

# Build with Tauri
cd src-tauri

# For universal build, we need to use cargo directly for the universal binary
if [ "$TARGET" = "universal-apple-darwin" ]; then
    echo "Building universal binary (this may take a while)..."
    
    # Build for both architectures
    cargo build --release --target aarch64-apple-darwin
    cargo build --release --target x86_64-apple-darwin
    
    # Create universal binary
    echo "Creating universal binary..."
    mkdir -p target/universal-apple-darwin/release
    lipo -create \
        target/aarch64-apple-darwin/release/rss-reader \
        target/x86_64-apple-darwin/release/rss-reader \
        -output target/universal-apple-darwin/release/rss-reader
    
    # Use Tauri bundler with the universal binary
    echo "Bundling DMG..."
    npm run tauri build -- --target universal-apple-darwin --bundles dmg
else
    # Single architecture build
    npm run tauri build -- --target "$TARGET" --bundles dmg
fi

cd ..

# Check if DMG was created
DMG_PATH="src-tauri/target/release/bundle/dmg"
if [ "$TARGET" = "universal-apple-darwin" ]; then
    DMG_PATH="src-tauri/target/universal-apple-darwin/release/bundle/dmg"
fi

if [ -d "$DMG_PATH" ]; then
    DMG_FILE=$(find "$DMG_PATH" -name "*.dmg" -type f | head -n 1)
    if [ -n "$DMG_FILE" ]; then
        echo ""
        echo "=========================================="
        echo -e "${GREEN}Build successful!${NC}"
        echo "=========================================="
        echo ""
        echo "DMG location: $DMG_FILE"
        echo "File size: $(du -h "$DMG_FILE" | cut -f1)"
        echo ""
        echo -e "${YELLOW}Note: This is an unsigned build.${NC}"
        echo "Users may see a security warning when opening the app."
        echo "To open, right-click the app and select 'Open' or go to"
        echo "System Preferences > Security & Privacy > Open Anyway"
        echo ""
    else
        echo -e "${RED}Error: DMG file not found${NC}"
        exit 1
    fi
else
    echo -e "${RED}Error: Bundle directory not found${NC}"
    exit 1
fi
