#!/bin/bash
# Installation script for Unix-like systems

set -e

echo "Installing otak-mcp-filesystem..."

# Download latest release
LATEST_URL=$(curl -s https://api.github.com/repos/tsuyoshi-otake/otak-mcp-filesystem/releases/latest | grep "browser_download_url.*otak-mcp-filesystem.tgz" | cut -d '"' -f 4)

if [ -z "$LATEST_URL" ]; then
    echo "Error: Could not find release asset"
    exit 1
fi

echo "Downloading from: $LATEST_URL"
curl -L "$LATEST_URL" -o /tmp/otak-mcp-filesystem.tgz

echo "Installing package globally..."
npm install -g /tmp/otak-mcp-filesystem.tgz

rm -f /tmp/otak-mcp-filesystem.tgz

echo "Installation complete!"
echo "Run 'otak-mcp-filesystem' to start the server"