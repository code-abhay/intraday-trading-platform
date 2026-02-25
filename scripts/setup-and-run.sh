#!/bin/bash
# One-command setup and run. Fixes npm cache if needed, installs deps, starts dev+auto-sync.
set -e
cd "$(dirname "$0")/.."

echo "=== Intraday Trading Platform ==="

# Fix npm cache permission if needed
if ! npm config get cache 2>/dev/null | head -1; then true; fi

echo "Installing dependencies..."
npm install

echo ""
echo "Starting dev server + auto-sync..."
echo "Dashboard: http://localhost:3000"
echo "Login:     http://localhost:3000/login"
echo ""
npm run dev:auto
