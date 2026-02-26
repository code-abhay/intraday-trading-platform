# Angel One Env Troubleshooting

## Error: "Set ANGEL_API_KEY, ANGEL_CLIENT_ID, ANGEL_PIN in .env.local"

This means one or more env vars are missing or empty when the login API runs.

---

## 1. Verify Variable Names (exact match)

Use these **exact** names in `.env.local`:

```
ANGEL_API_KEY=your_api_key
ANGEL_CLIENT_ID=your_client_code
ANGEL_PIN=your_pin
```

**Common mistakes:**
- `CLIENT_ID` → use `ANGEL_CLIENT_ID`
- `API_KEY` → use `ANGEL_API_KEY`
- `PIN` or `ANGEL_PASSWORD` → use `ANGEL_PIN`
- No spaces around `=` (e.g. `ANGEL_API_KEY = x` can cause issues)

---

## 2. File Location

`.env.local` must be in the **project root** (same folder as `package.json`):

```
intraday-trading-platform/
├── .env.local      ← here
├── package.json
├── app/
└── ...
```

---

## 3. Restart Dev Server

After editing `.env.local`, **restart** the Next.js dev server:

```bash
# Stop (Ctrl+C), then:
npm run dev
```

Env vars are loaded at startup. Changes require a restart.

---

## 4. Deployed on Vercel?

`.env.local` is **not** used in production. For Vercel:

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Open your project → **Settings** → **Environment Variables**
3. Add:
   - `ANGEL_API_KEY`
   - `ANGEL_CLIENT_ID`
   - `ANGEL_PIN`
4. Redeploy (or trigger a new deployment)

---

## 5. Verify Config

Visit **/api/angel-one/verify-env** (or click "Verify env config" on the login page).

You should see:
```json
{
  "ANGEL_API_KEY": "set",
  "ANGEL_CLIENT_ID": "set",
  "ANGEL_PIN": "set",
  "allConfigured": true
}
```

If any show `"missing"`, that variable is not being loaded.

---

## 6. Format Checklist

- No quotes needed: `ANGEL_API_KEY=abc123` (not `ANGEL_API_KEY="abc123"`)
- No trailing spaces
- One variable per line
- No comments on the same line as a value
