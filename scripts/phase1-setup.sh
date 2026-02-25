#!/bin/bash
# Phase 1 Setup: GitHub + Vercel deployment
# Run from project root: ./scripts/phase1-setup.sh

set -e
cd "$(dirname "$0")/.."
REPO_NAME="intraday-trading-platform"

echo "=== Phase 1: Infrastructure Setup ==="

# Step 1: Ensure Git is initialized and committed
if [ ! -d .git ]; then
  echo "Initializing Git..."
  git init
  git add .
  git commit -m "Initial commit: Next.js app with TypeScript and App Router"
fi

# Step 2: Create GitHub repo and push
echo ""
echo "--- GitHub Repository ---"
if command -v gh &>/dev/null; then
  if gh auth status &>/dev/null; then
    echo "Creating GitHub repo: $REPO_NAME"
    gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
    echo "✓ Pushed to GitHub"
  else
    echo "GitHub CLI found but not authenticated. Run: gh auth login"
    echo "Then run this script again."
    exit 1
  fi
elif [ -n "$GITHUB_TOKEN" ]; then
  echo "Using GITHUB_TOKEN to create repo..."
  curl -s -H "Authorization: token $GITHUB_TOKEN" -H "Accept: application/vnd.github.v3+json" \
    -d "{\"name\":\"$REPO_NAME\",\"private\":false}" \
    https://api.github.com/user/repos
  GITHUB_USER=$(curl -s -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user | grep -o '"login":"[^"]*"' | cut -d'"' -f4)
  git remote add origin "https://github.com/$GITHUB_USER/$REPO_NAME.git" 2>/dev/null || git remote set-url origin "https://github.com/$GITHUB_USER/$REPO_NAME.git"
  git push -u origin main
  echo "✓ Pushed to GitHub"
else
  echo "To create GitHub repo:"
  echo "  1. Go to: https://github.com/new?name=$REPO_NAME"
  echo "  2. Create the repo (leave 'Initialize with README' unchecked)"
  echo "  3. Run: git remote add origin https://github.com/YOUR_USERNAME/$REPO_NAME.git"
  echo "  4. Run: git push -u origin main"
  echo ""
  read -p "Have you created the repo and added remote? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push -u origin main 2>/dev/null || echo "Push failed - check remote is set correctly"
  fi
fi

# Step 3: Deploy to Vercel
echo ""
echo "--- Vercel Deployment ---"
if vercel whoami &>/dev/null; then
  echo "Deploying to Vercel..."
  vercel deploy --prod --yes
  echo "✓ Deployed to Vercel"
else
  echo "Vercel not logged in. Run: vercel login"
  echo "Complete login in browser, then run: vercel deploy --prod --yes"
  exit 1
fi

echo ""
echo "=== Phase 1 Complete ==="
echo "Your app is live on Vercel. Check the URL above."
