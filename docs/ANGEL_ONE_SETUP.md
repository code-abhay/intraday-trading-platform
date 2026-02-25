# Angel One SmartAPI – Step-by-Step Setup Guide

You’ve already signed in to SmartAPI. Follow these steps to create an app and use it in the Intraday Trading Platform.

---

## Step 1: Create an App

1. Go to **[https://smartapi.angelbroking.com](https://smartapi.angelbroking.com)**
2. Log in with your SmartAPI credentials
3. Click **“My Apps”** or **“Create App”** in the dashboard
4. Click **“Create New App”** or **“Add App”**

---

## Step 2: Fill App Details

| Field | What to Enter |
|-------|----------------|
| **App Name** | `Intraday Trading Platform` (or any name) |
| **App Type** | Select **Trading APIs** (for orders + market data) |
| **Redirect URL** | `http://127.0.0.1` or `http://localhost:3000` |
| **Postback URL** | Leave blank (optional) |
| **Angel Client ID** | Your Angel One client ID (optional here; you’ll use it in `.env`) |

5. Click **Create** or **Submit**

---

## Step 3: Save Your Credentials

After creating the app, you’ll see:

- **API Key** – used in all API requests
- **Secret Key** – keep this private; you may need it for some flows

Copy both and store them safely. You won’t be able to see the Secret Key again.

---

## Step 4: Get Your Angel One Client Details

You need these for login:

| Item | Where to Find |
|------|----------------|
| **Client Code** | Angel One app/website → Profile → Client ID (e.g. `D1234567`) |
| **Password (PIN)** | 4-digit or 6-digit trading PIN you set |
| **TOTP** | Code from Google Authenticator / Angel One app (6-digit, changes every 30 sec) |

---

## Step 5: Configure the Project

1. In the project root, create or edit `.env.local`:

```bash
# Angel One SmartAPI
ANGEL_API_KEY=your_api_key_here
ANGEL_CLIENT_ID=your_client_code
ANGEL_PIN=your_4_or_6_digit_pin
```

2. **Do not** put TOTP in `.env` – you’ll enter it when logging in (or via a one-time login flow).

3. Add `.env.local` to `.gitignore` (it should already be there).

---

## Step 6: Login Flow (Daily)

Angel One sessions expire at **12 midnight IST**. Each day you need to:

1. Open your authenticator app
2. Get the current 6-digit TOTP
3. Call the login API (or use our platform’s login) with:
   - Client code  
   - PIN  
   - TOTP  

The API returns a **JWT token** and **feed token**. Use the JWT for all subsequent API calls.

---

## Step 7: APIs Available for Our Platform

| API | Endpoint | Use |
|-----|----------|-----|
| **Login** | `POST /rest/auth/angelbroking/user/v1/loginByPassword` | Get JWT token |
| **PCR** | `GET /rest/secure/angelbroking/marketData/v1/putCallRatio` | Put–Call Ratio for NIFTY |
| **OI Buildup** | `POST /rest/secure/angelbroking/marketData/v1/OIBuildup` | Long/Short buildup, covering, unwinding |
| **Top Gainers/Losers** | `POST /rest/secure/angelbroking/marketData/v1/gainersLosers` | OI/Price gainers and losers |
| **Option Greeks** | `POST /rest/secure/angelbroking/marketData/v1/optionGreek` | Delta, Gamma, Theta, Vega |

---

## Step 8: Required Headers for Every Request

All API calls (except login) need:

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `Accept` | `application/json` |
| `Authorization` | `Bearer YOUR_JWT_TOKEN` |
| `X-UserType` | `USER` |
| `X-SourceID` | `WEB` |
| `X-ClientLocalIP` | Your local IP (e.g. `127.0.0.1`) |
| `X-ClientPublicIP` | Your public IP |
| `X-MACAddress` | Your MAC address (e.g. `00:00:00:00:00:00`) |
| `X-PrivateKey` | Your API Key |

---

## Quick Checklist

- [ ] Created app on SmartAPI
- [ ] Saved API Key (and Secret Key if shown)
- [ ] Noted Client Code, PIN, and TOTP source
- [ ] Added `ANGEL_API_KEY`, `ANGEL_CLIENT_ID`, `ANGEL_PIN` to `.env.local`
- [ ] Confirmed `.env.local` is in `.gitignore`

---

## Next Step

1. Copy `.env.example` to `.env.local` and fill in your values.
2. Run `npm run dev` and open http://localhost:3000.
3. Go to **/login** and enter your 6-digit TOTP from the authenticator app.
4. The dashboard will use Angel One for PCR and signals. NSE is used as fallback if Angel One is not configured or not logged in.
