# NIFTY Intraday Pro Strategy v4 – Filter Analysis & Dashboard Mapping

## 1. Complete Filter List

### 01 Core Indicators
| Filter | Default | Purpose |
|--------|---------|---------|
| EMA Fast Length | 21 | Trend direction |
| EMA Slow Length | 50 | Trend confirmation |
| RSI Length | 14 | Momentum |
| RSI Long Threshold | 52 | Long entry filter |
| RSI Short Threshold | 48 | Short entry filter |
| MACD Fast/Slow/Signal | 12/26/9 | Momentum confirmation |
| ADX Length | 14 | Trend strength |
| ADX Threshold | 18 | Min trend strength |
| ATR Length | 14 | Volatility, stops |
| ATR Stop Multiplier | 1.1 | SL distance |
| Bollinger Length | 20 | Mean reversion |
| Bollinger Multiplier | 2.0 | Band width |
| Structure Pivot Length | 3 | Swing detection |
| Allow Long/Short | true | Direction toggle |

### 02 Tier 1 Combo Filters
| Filter | Purpose |
|--------|---------|
| RSI Filter | RSI in range (long ≥52, short ≤48) |
| MACD Filter | MACD hist > 0 (long) or < 0 (short) |
| ADX Filter | ADX ≥ threshold |
| VWAP Filter | Price above/below VWAP |
| Volume Filter | Volume > 20 SMA |
| Session Filter | Trade window, avoid news, EOD |

### 03 Tier 2 Computed Filters
| Filter | Purpose |
|--------|---------|
| 15m HTF Confirmation | EMA alignment on 15m |
| Market Structure | Higher highs/lows (bull) or lower highs/lows (bear) |
| Volatility Regime | ATR vs ATR SMA: HIGH/LOW/NORMAL |

### 04 Tier 3 Optional Filters
| Filter | Purpose |
|--------|---------|
| Supertrend | Price vs Supertrend line |
| ORB Filter | Price vs Opening Range (9:15–9:30) |
| Candle Quality | Body ≥ 20% of range, close in upper/lower 60% |
| CPR Filter | Price vs CPR TC/BC |
| MACD Acceleration | MACD hist rising/falling |
| India VIX Guard | Size mult: VIX>30→0, >22→0.5, <13→0.7 |
| Bollinger Mid | Price vs BB mid |
| Range Filter | RF filter direction |
| Fibonacci | Auto Fib levels |

### 05 Session Controls
| Filter | Default | Purpose |
|--------|---------|---------|
| Session | 0915–1530 | NSE hours |
| Skip First Minutes | 15 | Avoid open volatility |
| Skip Last Minutes | 30 | Avoid close volatility |
| Cooldown Bars | 3 | Min bars between signals |
| EOD Close | 15:15 | Hard close |
| News Window | 15 min | Avoid open/close news |
| Trail Tighten | 14:30 | Tighter trail late session |

### 06 Risk & Position Sizing
| Filter | Default | Purpose |
|--------|---------|---------|
| Rupees Per Point | 65 | NIFTY lot value |
| Risk Per Trade | ₹2000 | Max risk per trade |
| Max Loss Cap | ₹5200 | Hard cap per trade |
| Min/Max Contracts | 1/10 | Position limits |
| Lot Size | 1 | Multiplier |
| Daily Loss Limit | ₹6000 | Optional pause |
| Consecutive Losses Pause | 5 | Pause after N losses |
| Zone Proximity % | 0.2 | S/D zone scoring |
| S/R Wall Distance % | 0.15 | Min distance to resistance/support |
| Max Hold Minutes | 240 | Time stop |

### 07 Exits & Targets
| Filter | Default | Purpose |
|--------|---------|---------|
| T1/T2/T3 Risk Multiplier | 1.36/2.73/4.55 | R:R targets |
| Partial Exit % T1/T2/T3 | 30/40/30 | Scale-out |
| Trail ATR Mult Phase 1/2/3 | 0.8/0.5/0.3 | Trailing |
| Partial BE ATR Mult | 0.3 | Breakeven trigger |
| Stop Snap Distance | 10 pts | Snap to S/R |
| Stop Snap Buffer | 2 pts | Buffer from level |

### 08 Intraday S/R Levels
| Level | Formula |
|-------|---------|
| PDH/PDL/PDC | Previous day H/L/C |
| Pivot | (PDH+PDL+PDC)/3 |
| CPR TC | (PDH+PDL)/2 |
| CPR BC | Pivot - (TC - Pivot) |
| R1/R2 | 2*Pivot-PDL, Pivot+(PDH-PDL) |
| S1/S2 | 2*Pivot-PDH, Pivot-(PDH-PDL) |
| ORB High/Low | 9:15–9:30 range |
| Camarilla H4/H3/H2/H1, L1/L2/L3/L4 | PDC ± range fractions |
| Supply/Demand Zones | Swing-based zones |

### 09 Supply & Demand
| Filter | Purpose |
|--------|---------|
| S&D Swing Length | 10 | Pivot lookback |
| Zone Width ATR Mult | 2.5 | Zone thickness |
| Zones to Keep | 20 | History limit |

### 10 Auto Fibonacci
| Filter | Purpose |
|--------|---------|
| Fib Swing Depth | 10 | Swing lookback |
| Levels | 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0 | Retracement levels |

### 13 Options Advisor (Critical for Strike/Premium)
| Filter | Options | Purpose |
|--------|---------|---------|
| Strike Selection Mode | High Delta, ATM, OTM Aggressive, Balanced | Strike choice |
| Strike Step | 50 | NIFTY strike spacing |
| **Recommended Strike** | Computed | Base ± shift by mode |
| **Estimated Premium** | `max(20, ATR*0.6 + \|strike-close\|*0.25)` | Option premium estimate |
| **Estimated Delta** | 0.70/0.50/0.30/0.45 by mode | Delta proxy |
| Days to Expiry | Next Tuesday | Expiry info |

---

## 2. Dashboard Tables (from Pine)

| Table | Content |
|-------|---------|
| **Table 1 – Market** | Trend, EMA, MACD, RSI, Volume, ATR regime, CPR type, Gap, Range Filter, VWAP dist, Trading status |
| **Table 2 – Status** | Position, Entry, Stop, T1/T2/T3, Unrealized PnL, R:R, Stop type, Trail phase, Daily PnL, Win rate |
| **Table 3 – S/R Levels** | PDH/PDL/PDC, Pivot, CPR, ORB, R1/R2/S1/S2, VWAP, Camarilla, S&D count, Wall distance |
| **Table 4 – Sentiment** | Score, Side (STRONG BUY/BUY/NEUTRAL/SELL/STRONG SELL), Momentum, Options Bias |
| **Table 5 – Trend Map** | 5m, 15m, 1H, 4H, 1D, 1W direction |
| **Options Table** | Expiry, Side (CALL/PUT), Strike Mode, **Recommended Strike**, **Est Premium**, Est Delta |

---

## 3. What to Add to Our Dashboard

### High Priority (Align with Pine + Options)

| Component | Source | Notes |
|-----------|--------|------|
| **Options Advisor Panel** | New | Strike, premium, delta |
| **Premium Calculator** | New | `max(20, ATR*0.6 + \|strike-close\|*0.25)` |
| **Strike Selection** | New | ATM, OTM, High Delta, Balanced |
| **S/R Levels Table** | PDH/PDL, Pivot, CPR, R1/R2/S1/S2 | From NSE/Angel One or computed |
| **Camarilla Levels** | Computed | From PDH/PDL/PDC |
| **ORB High/Low** | First 15 min | Needs intraday data |
| **Sentiment Score** | RSI/MACD/EMA/VWAP/ADX | Composite score |
| **Trend Map** | Multi-timeframe | 5m, 15m, 1H, 1D direction |

### Medium Priority

| Component | Source | Notes |
|-----------|--------|------|
| **OI Table** | Option chain | Strike-wise CE/PE OI, change in OI |
| **Strike Heatmap** | Option chain | OI by strike |
| **PCR by Strike** | Option chain | PCR at key strikes |
| **CPR Type** | NARROW_TREND / NORMAL / WIDE_RANGE | From pivot width |
| **Gap Type** | GAP_UP / GAP_DOWN / FLAT | From open vs PDC |
| **Volatility Regime** | ATR/ATR_SMA | HIGH / NORMAL / LOW |

### Lower Priority (Needs More Data)

| Component | Notes |
|-----------|-------|
| Supply/Demand Zones | Needs swing detection |
| Fibonacci Levels | Needs swing high/low |
| Signal Strength (0–11) | Needs all filters |
| India VIX Guard | Needs VIX feed |

---

## 4. Premium Logic (for Options Trading)

### Premium Formula (from Pine)

```text
estimated_premium = max(20, ATR * 0.6 + |recommended_strike - close| * 0.25)
```

### Strike Selection Logic

| Mode | Long (Call) | Short (Put) | Delta |
|------|-------------|-------------|-------|
| High Delta | ATM - 50 | ATM + 50 | 0.70 |
| ATM | ATM | ATM | 0.50 |
| OTM Aggressive | ATM + 50 | ATM - 50 | 0.30 |
| Balanced | ATM + 25 | ATM - 25 | 0.45 |

### Implementation Needs

1. **ATR** – From Angel One historical or live
2. **Underlying (close)** – NIFTY spot/index
3. **Strike step** – 50 for NIFTY
4. **Base strike** – `round(close / 50) * 50`
5. **Recommended strike** – Base ± shift by mode
6. **Premium** – Use formula above (or replace with real option LTP when available)

---

## 5. Data Requirements for Full Parity

| Data | Angel One | NSE | Notes |
|------|-----------|-----|-------|
| NIFTY LTP | ✅ | ✅ | Underlying |
| PCR | ✅ | ✅ | Sentiment |
| OI by strike | ❌ | ✅ | Option chain |
| PDH/PDL/PDC | ❌ | Historical | Previous day |
| ATR | ❌ | Historical | Or from candles |
| VWAP | ❌ | - | Needs tick data |
| Option LTP | ✅ (by token) | ✅ | Real premium |

---

## 6. Recommended Dashboard Layout (Next Phase)

```
┌─────────────────────────────────────────────────────────────┐
│  NAV: Dashboard | Options Advisor | Levels | Login          │
├─────────────────────────────────────────────────────────────┤
│  Market Overview    │  PCR  │  Bias  │  Underlying  │ Max Pain │
├─────────────────────────────────────────────────────────────┤
│  OPTIONS ADVISOR (NEW)                                       │
│  Strike: 24500 CE  │  Est Premium: ₹125  │  Delta: 0.50      │
│  Mode: [ATM ▼]     │  Days to Expiry: 4                     │
├─────────────────────────────────────────────────────────────┤
│  S/R LEVELS         │  SENTIMENT                             │
│  PDH | PDL | Pivot  │  Score: 45 | BUY                      │
│  R1 | R2 | S1 | S2  │  Options Bias: Call Bias              │
│  CPR TC | BC        │  Momentum: RISING                      │
├─────────────────────────────────────────────────────────────┤
│  OI TABLE (Strike)   │  SIGNAL PANEL                         │
│  CE OI | PE OI | ΔOI │  Entry | SL | T1 | T2 | T3           │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Summary: Filters We Can Implement

**From OI/option chain (we have or can get):**
- PCR, OI buildup, Max Pain
- Strike-wise OI table
- Strike heatmap
- Option LTP (real premium) when we have tokens

**From price/levels (need PDH/PDL/PDC or historical):**
- Pivot, CPR, R1/R2/S1/S2
- Camarilla levels
- Gap type
- ATR (for premium formula)

**Options Advisor (priority):**
- Recommended strike (ATM ± shift)
- Estimated premium (ATR-based formula)
- Estimated delta
- Days to expiry
- Call/Put bias from sentiment
