# Intraday Trading Platform

Intraday trading intelligence platform with OI analytics, PCR, and signal generation. Built with Next.js, deployed on Vercel.

## Phase 1: Infrastructure Setup

### Quick Deploy (after one-time auth)

```bash
# 1. Login to Vercel (opens browser)
vercel login

# 2. Deploy to production
vercel deploy --prod --yes
```

### GitHub + Vercel (full setup)

```bash
./scripts/phase1-setup.sh
```

Or manually:
1. Create repo at [github.com/new?name=intraday-trading-platform](https://github.com/new?name=intraday-trading-platform)
2. `git remote add origin https://github.com/YOUR_USERNAME/intraday-trading-platform.git`
3. `git push -u origin main`
4. Connect repo at [vercel.com/new](https://vercel.com/new) and deploy

---

## Auto Deploy (Code Change → Vercel)

```bash
npm install          # one-time: installs chokidar, concurrently
npm run dev:auto     # runs dev server + auto-sync
```

Any file change → auto commit → push → Vercel deploys. See [docs/AUTO_DEPLOY.md](docs/AUTO_DEPLOY.md).

---

## Angel One SmartAPI

To use Angel One as the primary data source (PCR, OI buildup):

1. Create an app at [smartapi.angelbroking.com](https://smartapi.angelbroking.com) (Trading APIs)
2. Copy `.env.example` to `.env.local` and add your API key, client ID, and PIN
3. Run the app and go to **/login** to enter your TOTP (6-digit from authenticator)
4. Session is valid until midnight IST; re-login each trading day

See [docs/ANGEL_ONE_SETUP.md](docs/ANGEL_ONE_SETUP.md) for the full guide.

---

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
