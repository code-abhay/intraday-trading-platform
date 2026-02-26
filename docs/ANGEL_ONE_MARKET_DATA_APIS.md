# Angel One SmartAPI – Market Data APIs Reference

Reference: [SmartAPI Market Data Docs](https://smartapi.angelbroking.com/docs/MarketData)

## Required Data vs API Mapping

| Data Needed | Angel One API | Method | Status |
|-------------|---------------|--------|--------|
| **PCR** (Put-Call Ratio) | `putCallRatio` | GET | ✅ Implemented |
| **Underlying LTP** (NIFTY, BANKNIFTY, etc.) | `getLtpData` | POST | ✅ Implemented |
| **OI Buildup** (Long/Short buildup, Covering) | `OIBuildup` | POST | ✅ Implemented (wired to dashboard) |
| **PDH, PDL, PDC, ATR** (for S/R levels) | `getCandleData` | POST | ✅ Implemented |
| **Option Greeks** (Delta for Options Advisor) | `optionGreek` | POST | ✅ Implemented |
| **Option Chain / Strike-wise OI** | — | — | ⚠️ **Not available** – use NSE |
| **Max Pain** (strike-wise OI) | — | — | ⚠️ **Not available** – use NSE |

---

## 1. Put-Call Ratio (PCR)

**Endpoint:** `GET /rest/secure/angelbroking/marketData/v1/putCallRatio`

**Headers:** Standard (Authorization Bearer JWT, X-PrivateKey, etc.)

**Request:** No body

**Response:**
```json
{
  "status": true,
  "data": [
    { "pcr": 1.04, "tradingSymbol": "NIFTY25JAN24FUT" },
    { "pcr": 0.58, "tradingSymbol": "HEROMOTOCO25JAN24FUT" }
  ]
}
```

**Note:** PCR is cumulative for all strikes. `tradingSymbol` maps to futures instrument. Filter by `NIFTY`, `BANKNIFTY`, etc.

---

## 2. Get LTP Data

**Endpoint:** `POST /rest/secure/angelbroking/order/v1/getLtpData`

**Request:**
```json
{
  "exchange": "NSE",
  "tradingsymbol": "NIFTY",
  "symboltoken": "99926000"
}
```

**Response:**
```json
{
  "status": true,
  "data": {
    "exchange": "NSE",
    "tradingsymbol": "NIFTY",
    "symboltoken": "99926000",
    "open": "25500",
    "high": "25572",
    "low": "25487",
    "close": "25482",
    "ltp": "25528"
  }
}
```

**Use:** Underlying price for entry, targets, S/R. Supports NSE, BSE, NFO, etc.

---

## 3. OI Buildup

**Endpoint:** `POST /rest/secure/angelbroking/marketData/v1/OIBuildup`

**Request:**
```json
{
  "expirytype": "NEAR",
  "datatype": "Long Built Up"
}
```

**DataType values:** `Long Built Up`, `Short Built Up`, `Short Covering`, `Long Unwinding`  
**ExpiryType values:** `NEAR`, `NEXT`, `FAR`

**Response:**
```json
{
  "status": true,
  "data": [
    {
      "symbolToken": "55424",
      "ltp": "723.8",
      "netChange": "-28.25",
      "percentChange": "-3.76",
      "opnInterest": "24982.5",
      "netChangeOpnInterest": "-76.25",
      "tradingSymbol": "JINDALSTEL25JAN24FUT"
    }
  ]
}
```

**Use:** Long/Short buildup, Short Covering, Long Unwinding for sentiment.

---

## 4. Get Candle Data (Historical)

**Endpoint:** `POST /rest/secure/angelbroking/historical/v1/getCandleData`

**Request:**
```json
{
  "exchange": "NSE",
  "symboltoken": "99926000",
  "interval": "ONE_DAY",
  "fromdate": "2025-02-25 09:15",
  "todate": "2025-02-26 15:30"
}
```

**Intervals:** `ONE_MINUTE`, `THREE_MINUTE`, `FIVE_MINUTE`, `TEN_MINUTE`, `FIFTEEN_MINUTE`, `THIRTY_MINUTE`, `ONE_HOUR`, `ONE_DAY`

**Max days per request:**
| Interval | Max Days |
|----------|----------|
| ONE_MINUTE | 30 |
| FIVE_MINUTE | 100 |
| ONE_DAY | 2000 |

**Response:**
```json
{
  "status": true,
  "data": [
    ["2025-02-25T09:15:00+05:30", 19571.2, 19573.35, 19534.4, 19552.05, 0]
  ]
}
```

**Format:** `[timestamp, open, high, low, close, volume]`

**Use:** PDH, PDL, PDC (prior day high/low/close), ATR for S/R levels and targets.

---

## 5. Option Greeks

**Endpoint:** `POST /rest/secure/angelbroking/marketData/v1/optionGreek`

**Request:**
```json
{
  "name": "NIFTY",
  "expirydate": "25JAN2024"
}
```

**Response:**
```json
{
  "status": true,
  "data": [
    {
      "name": "NIFTY",
      "expiry": "25JAN2024",
      "strikePrice": "24500.000000",
      "optionType": "CE",
      "delta": "0.492400",
      "gamma": "0.002800",
      "theta": "-4.091800",
      "vega": "2.296700",
      "impliedVolatility": "16.330000",
      "tradeVolume": "24048.00"
    }
  ]
}
```

**Use:** Delta for Options Advisor, IV for premium estimation.

---

## 6. Live Market Data (Quote API)

**Endpoint:** `POST /rest/secure/angelbroking/market/v1/quote/`

**Request (LTP mode):**
```json
{
  "mode": "LTP",
  "exchangeTokens": {
    "NSE": ["99926000", "3045"],
    "NFO": ["58662"]
  }
}
```

**Modes:** `LTP`, `OHLC`, `FULL`

**FULL mode includes:** LTP, open, high, low, close, volume, open interest, depth (best 5 bid/ask).

**Use:** Batch LTP/OHLC for multiple symbols (up to 50 per request). Alternative to `getLtpData` for multiple symbols.

---

## 7. Scrip Master (Instrument List)

**Endpoint:** `GET https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json`

**Use:** Token lookup for indices (NIFTY: 99926000, BANKNIFTY: 99926009, etc.).

---

## What Angel One Does NOT Provide

| Data | Alternative |
|------|-------------|
| **Option chain** (strike-wise CE/PE OI) | NSE option chain API |
| **Max Pain** (strike-wise payout) | Compute from NSE option chain |
| **OI table** (strike-wise OI) | NSE option chain |

---

## Recommended Implementation Order

1. **getCandleData** – PDH/PDL/PDC, ATR for S/R and targets (replace fallbacks).
2. **optionGreek** – Real delta for Options Advisor.
3. **OIBuildup** – Wire to dashboard for Long/Short buildup sentiment.
4. **Live Quote API** – Use for batch OHLC when fetching multiple symbols.
