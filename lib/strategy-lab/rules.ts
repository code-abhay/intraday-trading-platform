import type { StrategyId, StrategyRuleSpec } from "@/lib/strategy-lab/types";

export const STRATEGY_LAB_RULES: StrategyRuleSpec[] = [
  {
    id: "ema_macd_trend_acceleration",
    name: "EMA-MACD Trend Acceleration",
    qualityRating: "A+",
    marketEnvironment: "Trending expansion",
    indicators: ["EMA (9/21)", "MACD", "ADX", "ATR"],
    multiTimeframeAlignment:
      "15m and 60m EMA stack must align with execution direction before 5m trigger.",
    longEntryRules: [
      "Price closes above 9 EMA and 21 EMA on 5m.",
      "MACD histogram is above zero and expanding vs prior bar.",
      "MACD line crosses above signal line on trigger or one bar before trigger.",
      "ADX is above 25 on execution timeframe.",
    ],
    shortEntryRules: [
      "Price closes below 9 EMA and 21 EMA on 5m.",
      "MACD histogram is below zero and expanding downward.",
      "MACD line crosses below signal line on trigger or one bar before trigger.",
      "ADX is above 25 on execution timeframe.",
    ],
    optionsSelection: [
      "Momentum day: prefer ATM weekly options before 12 PM IST.",
      "If trigger comes later and move is still expanding, prefer next weekly.",
      "Use calls for long setup and puts for short setup.",
    ],
    riskModel: [
      "Stop at recent swing extreme plus ATR buffer.",
      "Per-trade risk budget 0.5% with 2.0% daily cap.",
      "Reject setup if projected risk/reward is below 1:1.8.",
    ],
    tradeManagement: [
      "Trail with 9 EMA once trade reaches +1R.",
      "Book partial at +2R and manage remainder to trailing stop.",
      "Force exit at end of session for intraday simulation.",
    ],
    invalidationRules: [
      "ADX drops below 20 before entry confirmation.",
      "MACD histogram contracts two consecutive bars before trigger.",
      "Higher timeframe EMA stack loses directional alignment.",
    ],
    engine: {
      executionIntervalMin: 5,
      higherIntervalsMin: [15, 60],
      atrPeriod: 14,
      stopAtrMult: 1,
      targetR: 2.2,
      maxBarsInTrade: 30,
      minBarsBetweenTrades: 3,
      riskPerTradePct: 0.5,
      dailyRiskCapPct: 2,
      params: {
        minAdx: 25,
        invalidationAdx: 20,
        minMacdHistSlope: 0.02,
      },
    },
  },
  {
    id: "supertrend_adx_continuation",
    name: "Supertrend-ADX Continuation",
    qualityRating: "A+",
    marketEnvironment: "Directional continuation after pullback",
    indicators: ["Supertrend", "ADX", "EMA (21)", "ATR"],
    multiTimeframeAlignment:
      "60m trend filter with ADX > 30 and price on trend side before 5m Supertrend trigger.",
    longEntryRules: [
      "Supertrend flips bullish on 5m.",
      "Price closes above 21 EMA and above prior candle high.",
      "ADX is rising and above threshold.",
    ],
    shortEntryRules: [
      "Supertrend flips bearish on 5m.",
      "Price closes below 21 EMA and below prior candle low.",
      "ADX is rising and above threshold.",
    ],
    optionsSelection: [
      "Prefer slightly ITM options to reduce decay risk.",
      "Use weekly for same-session setups and next weekly if trend has late-day continuation.",
      "Calls for bullish continuation, puts for bearish continuation.",
    ],
    riskModel: [
      "Initial stop uses Supertrend line and ATR buffer.",
      "Per-trade risk budget 0.6% with daily 2.0% cap.",
      "No new entry after daily risk cap is reached.",
    ],
    tradeManagement: [
      "Trail with Supertrend line every bar.",
      "Partial profit at +1.8R and hold remainder until Supertrend breach.",
      "Exit if ADX momentum rolls over sharply.",
    ],
    invalidationRules: [
      "ADX turns down before trigger close.",
      "Price fails to hold above/below 21 EMA after flip.",
      "Supertrend reverses within three bars of trigger.",
    ],
    engine: {
      executionIntervalMin: 5,
      higherIntervalsMin: [60],
      atrPeriod: 14,
      stopAtrMult: 1,
      targetR: 2,
      maxBarsInTrade: 36,
      minBarsBetweenTrades: 4,
      riskPerTradePct: 0.6,
      dailyRiskCapPct: 2,
      params: {
        supertrendFactor: 3,
        supertrendAtrPeriod: 10,
        minAdx: 24,
        higherTfAdx: 30,
      },
    },
  },
  {
    id: "vwap_delta_reversion",
    name: "VWAP Delta Reversion",
    qualityRating: "A",
    marketEnvironment: "Liquidity sweep reversal / opening drive exhaustion",
    indicators: ["VWAP", "RSI", "MACD", "ATR", "PCR", "Buy/Sell flow proxy"],
    multiTimeframeAlignment:
      "60m context identifies overextension from value; 3m trigger confirms reclaim momentum.",
    longEntryRules: [
      "Price stretches below session VWAP by at least 1 ATR then reclaims VWAP.",
      "RSI shows bullish divergence near sweep low.",
      "PCR is elevated or order-flow skew shows panic selling that starts easing.",
      "Trigger candle closes above VWAP with rising MACD histogram.",
    ],
    shortEntryRules: [
      "Price stretches above session VWAP by at least 1 ATR then loses VWAP.",
      "RSI shows bearish divergence near sweep high.",
      "PCR is depressed or order-flow skew shows euphoric buying that starts easing.",
      "Trigger candle closes below VWAP with falling MACD histogram.",
    ],
    optionsSelection: [
      "Prefer deep ITM or ATM for fast mean-reversion delta capture.",
      "Keep expiry in current weekly unless move starts near expiry cutoff.",
      "Use calls on bullish reclaim, puts on bearish rejection.",
    ],
    riskModel: [
      "Stop at sweep extreme with ATR padding.",
      "Per-trade risk budget 0.35% with 1.5% daily cap.",
      "One high-quality reversal per segment at a time.",
    ],
    tradeManagement: [
      "Scale out 60% at first value target (VWAP to OR midline).",
      "Trail remainder with fast EMA(9) on 3m.",
      "Immediate exit on failed VWAP hold after reclaim/rejection.",
    ],
    invalidationRules: [
      "VWAP reclaim/rejection fails within three bars.",
      "Divergence disappears due to fresh extreme without momentum confirmation.",
      "Flow context flips against setup before entry.",
    ],
    engine: {
      executionIntervalMin: 3,
      higherIntervalsMin: [60],
      atrPeriod: 14,
      stopAtrMult: 0.8,
      targetR: 1.8,
      maxBarsInTrade: 22,
      minBarsBetweenTrades: 5,
      riskPerTradePct: 0.35,
      dailyRiskCapPct: 1.5,
      params: {
        vwapStretchAtr: 1,
        rsiDivergenceLookback: 18,
        pcrUpperExtreme: 1.3,
        pcrLowerExtreme: 0.75,
      },
    },
  },
  {
    id: "gamma_expansion_breakout",
    name: "Gamma Expansion Breakout",
    qualityRating: "A+",
    marketEnvironment: "Compression to volatility expansion",
    indicators: ["Bollinger Bands", "ADX", "OBV", "EMA (9/21)", "ATR"],
    multiTimeframeAlignment:
      "15m structure must be in consolidation before 5m breakout trigger.",
    longEntryRules: [
      "Bollinger bandwidth is in compression state.",
      "ADX is below 20 and hooks higher pre-breakout.",
      "OBV breaks local resistance before or with price breakout.",
      "5m candle closes above upper Bollinger band with EMA9 crossing above EMA21.",
    ],
    shortEntryRules: [
      "Bollinger bandwidth is in compression state.",
      "ADX is below 20 and hooks higher pre-breakdown.",
      "OBV breaks local support before or with price breakdown.",
      "5m candle closes below lower Bollinger band with EMA9 crossing below EMA21.",
    ],
    optionsSelection: [
      "Prefer one-strike OTM Monday-Wednesday, ATM on expiry-near sessions.",
      "Use current weekly if breakout starts in first half of day.",
      "Calls for upside expansion and puts for downside expansion.",
    ],
    riskModel: [
      "Stop 1.5 ATR beyond 21 EMA.",
      "Per-trade risk 1.0% in sim, capped by 2.0% daily risk.",
      "Ignore breakouts with weak volume confirmation.",
    ],
    tradeManagement: [
      "Take 50% at +2R.",
      "Trail remainder with EMA9 until trend failure.",
      "Exit immediately if ADX fails to expand.",
    ],
    invalidationRules: [
      "ADX does not clear 25 within three bars after trigger.",
      "Breakout candle fully mean-reverts into squeeze zone.",
      "OBV fails to confirm directional breakout.",
    ],
    engine: {
      executionIntervalMin: 5,
      higherIntervalsMin: [15],
      atrPeriod: 14,
      stopAtrMult: 1.5,
      targetR: 2.4,
      maxBarsInTrade: 24,
      minBarsBetweenTrades: 6,
      riskPerTradePct: 1,
      dailyRiskCapPct: 2,
      params: {
        squeezeBandwidthPct: 0.015,
        preBreakAdxMax: 20,
        postBreakAdxMin: 25,
        breakoutVolumeMult: 1.5,
      },
    },
  },
  {
    id: "pcr_oi_sentiment_reversal",
    name: "PCR-OI Sentiment Reversal",
    qualityRating: "A",
    marketEnvironment: "Sentiment extremes with momentum reversal",
    indicators: ["PCR", "OI buildup", "RSI", "MACD", "EMA (9/21)", "ATR"],
    multiTimeframeAlignment:
      "60m bias tracks sentiment extremes; 5m trigger requires momentum confirmation.",
    longEntryRules: [
      "PCR is at bullish-reversal extreme (crowded bearish side).",
      "Short buildup pressure dominates in recent OI window.",
      "RSI recovers from oversold and MACD histogram turns up.",
      "Price reclaims EMA9 above EMA21 on trigger bar.",
    ],
    shortEntryRules: [
      "PCR is at bearish-reversal extreme (crowded bullish side).",
      "Long buildup pressure dominates in recent OI window.",
      "RSI rolls from overbought and MACD histogram turns down.",
      "Price loses EMA9 below EMA21 on trigger bar.",
    ],
    optionsSelection: [
      "Prefer ATM for cleaner directional response during sentiment unwind.",
      "Use next weekly when trigger appears near close to reduce decay pressure.",
      "Calls for bullish unwind, puts for bearish unwind.",
    ],
    riskModel: [
      "Stop beyond reversal pivot with ATR buffer.",
      "Per-trade risk 0.4% with daily 1.5% cap.",
      "Skip trades when sentiment remains one-way without momentum shift.",
    ],
    tradeManagement: [
      "Take first profit near sentiment normalization zone.",
      "Move stop to breakeven after +1R.",
      "Trail remainder with EMA21 or swing structure.",
    ],
    invalidationRules: [
      "PCR stays pinned in extreme without any RSI/MACD confirmation.",
      "OI pressure does not align with reversal thesis.",
      "Price breaches invalidation pivot before trigger.",
    ],
    engine: {
      executionIntervalMin: 5,
      higherIntervalsMin: [60],
      atrPeriod: 14,
      stopAtrMult: 1,
      targetR: 2,
      maxBarsInTrade: 30,
      minBarsBetweenTrades: 8,
      riskPerTradePct: 0.4,
      dailyRiskCapPct: 1.5,
      params: {
        pcrUpperExtreme: 1.35,
        pcrLowerExtreme: 0.72,
        minRsiForLongRecovery: 32,
        maxRsiForShortFade: 68,
      },
    },
  },
];

export const STRATEGY_LAB_RULES_BY_ID: Record<StrategyId, StrategyRuleSpec> =
  STRATEGY_LAB_RULES.reduce((acc, rule) => {
    acc[rule.id] = rule;
    return acc;
  }, {} as Record<StrategyId, StrategyRuleSpec>);
