# Automatic Deploy Flow

## How It Works

```
Code change → auto commit → auto push → Vercel auto-deploys
```

## Setup (One-Time)

### 1. Connect GitHub to Vercel

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Import your repo: `code-abhay/intraday-trading-platform`
3. Ensure **Production Branch** is `main`
4. Deployments will trigger automatically on every push

### 2. Enable Auto-Sync

**Option A – Dev + Auto-sync together:**
```bash
npm run dev:auto
```
Runs the dev server and auto-sync in parallel. Any file change → auto commit → push → Vercel deploys.

**Option B – Auto-sync only (in a separate terminal):**
```bash
npm run auto-sync
```
Watches for changes and auto-commits + pushes to `main`. Run `npm run dev` in another terminal for the app.

## Flow Without Auto-Sync

- Edit code → `git add -A && git commit -m "..." && git push` → Vercel deploys

## Flow With Auto-Sync

- Edit code → (auto-sync detects change) → auto commit + push → Vercel deploys

## Requirements

- GitHub repo connected to Vercel
- Git configured with push access to `origin`
- Branch: `main`
