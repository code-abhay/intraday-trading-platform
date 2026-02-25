# Phase 1: Complete These Steps

Automated setup is done. **You need to complete 2 auth steps** (one-time):

---

## Step 1: Create GitHub Repo & Push

A browser tab should have opened to create the repo. If not, go to:
**https://github.com/new?name=intraday-trading-platform**

1. Click **Create repository** (leave "Add a README" unchecked)
2. Copy your repo URL (e.g. `https://github.com/yourusername/intraday-trading-platform.git`)
3. Run in terminal:

```bash
cd /Users/abhay.kumar/Downloads/intraday-trading-platform
git remote add origin https://github.com/YOUR_USERNAME/intraday-trading-platform.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 2: Deploy to Vercel

**Option A – Vercel Dashboard (easiest)**

1. Go to **https://vercel.com/new**
2. Click **Import Git Repository**
3. Select `intraday-trading-platform` (after Step 1)
4. Click **Deploy**

**Option B – Vercel CLI**

```bash
cd /Users/abhay.kumar/Downloads/intraday-trading-platform
vercel login    # Opens browser, complete login
vercel deploy --prod --yes
```

---

## Verify

- GitHub: Repo shows your code
- Vercel: Live URL works (e.g. `intraday-trading-platform.vercel.app`)

Phase 1 is complete when both are done.
