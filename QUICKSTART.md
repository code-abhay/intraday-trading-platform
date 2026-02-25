# Quick Start

## 1. Configure Angel One (one-time)

Edit `.env.local` in the project root:

```
ANGEL_API_KEY=<your API key from SmartAPI>
ANGEL_CLIENT_ID=<your client code>
ANGEL_PIN=<your 4 or 6 digit PIN>
```

## 2. Run the app

```bash
npm run dev
```

## 3. Open in browser

- **Dashboard:** http://localhost:3000
- **Login:** http://localhost:3000/login

## 4. Login (each trading day)

1. Go to http://localhost:3000/login
2. Enter 6-digit TOTP from your authenticator app
3. Click Login
4. You'll see the dashboard with Angel One data

## 5. Session

- Session expires at **midnight IST**
- Re-login each trading day

---

**Without Angel One:** The app falls back to NSE. No login required, but NSE may be blocked or rate-limited.
