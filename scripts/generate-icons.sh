#!/bin/bash
#
# Generate app icons from SVG source
# Usage: ./scripts/generate-icons.sh [svg-file]
# Default: src-tauri/icons/icon.svg
#

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default SVG path
SVG_FILE="${1:-$PROJECT_ROOT/src-tauri/icons/icon.svg}"
ICONS_DIR="$(dirname "$SVG_FILE")"

# Check if SVG exists
if [ ! -f "$SVG_FILE" ]; then
    echo "Error: SVG file not found: $SVG_FILE"
    exit 1
fi

echo -e "${BLUE}Generating icons from: $SVG_FILE${NC}"
echo ""

# Check for required tools
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo "Error: $1 is required but not installed."
        exit 1
    fi
}

check_command magick
check_command iconutil

# Change to icons directory
cd "$ICONS_DIR"

# Clean up existing generated files (keep SVG)
echo "Cleaning up existing icons..."
rm -f 32x32.png 128x128.png 128x128@2x.png icon.ico icon.icns

# Function to generate PNG from SVG
generate_png() {
    local size=$1
    local output=$2
    echo -e "${BLUE}  Generating ${output} (${size}x${size})...${NC}"
    magick -density 300 -background transparent "$SVG_FILE" -resize ${size}x${size} PNG32:"$output"
}

echo "Generating PNG files..."
generate_png 32 "32x32.png"
generate_png 128 "128x128.png"
generate_png 256 "128x128@2x.png"

echo ""
echo "Generating Windows ICO..."
TMP_DIR=$(mktemp -d)
for size in 16 32 48 128 256; do
    magick -density 300 -background transparent "$SVG_FILE" -resize ${size}x${size} PNG32:"$TMP_DIR/icon_${size}.png"
done
magick "$TMP_DIR"/icon_*.png icon.ico
rm -rf "$TMP_DIR"
echo -e "${GREEN}  ✓ icon.ico generated${NC}"

echo ""
echo "Generating macOS ICNS..."
mkdir -p icon.iconset
for size in 16 32 64 128 256 512; do
    magick -density 300 -background transparent "$SVG_FILE" -resize ${size}x${size} PNG32:icon.iconset/icon_${size}x${size}.png
    double=$((size * 2))
    magick -density 300 -background transparent "$SVG_FILE" -resize ${double}x${double} PNG32:icon.iconset/icon_${size}x${size}@2x.png
done
iconutil -c icns icon.iconset -o icon.icns
rm -rf icon.iconset
echo -e "${GREEN}  ✓ icon.icns generated${NC}"

echo ""
echo -e "${GREEN}✓ All icons generated successfully!${NC}"
echo ""
echo "Generated files:"
ls -lh "$ICONS_DIR"/*.png "$ICONS_DIR"/*.ico "$ICONS_DIR"/*.icns 2>/dev/null || true
echo ""
echo "File details:"
file "$ICONS_DIR"/*.png "$ICONS_DIR"/*.ico "$ICONS_DIR"/*.icns 2>/dev/null || true
