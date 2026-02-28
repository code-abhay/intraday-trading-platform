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
  {
    id: "rsi_divergence_stochastic_reversal",
    name: "RSI Divergence + Stochastic Reversal",
    qualityRating: "A",
    marketEnvironment: "Mean reversion at exhaustion zones",
    indicators: ["RSI", "Stochastic Oscillator", "ATR", "EMA (9/21)"],
    multiTimeframeAlignment:
      "60m context identifies overextension while 5m divergence + stochastic trigger confirms reversal.",
    longEntryRules: [
      "Bullish RSI divergence appears near a local swing low.",
      "Stochastic %K crosses above %D from oversold zone.",
      "Price regains short-term structure with EMA9 support.",
    ],
    shortEntryRules: [
      "Bearish RSI divergence appears near a local swing high.",
      "Stochastic %K crosses below %D from overbought zone.",
      "Price loses short-term structure below EMA9.",
    ],
    optionsSelection: [
      "Prefer ATM or slight ITM for fast intraday reversal capture.",
      "Use current weekly unless trigger appears late in session.",
    ],
    riskModel: [
      "Stop beyond reversal pivot with ATR padding.",
      "Per-trade risk 0.45% and daily cap 1.8%.",
    ],
    tradeManagement: [
      "Take partial around first mean-reversion target.",
      "Move stop to breakeven after +1R.",
      "Trail remainder with EMA21.",
    ],
    invalidationRules: [
      "Divergence fails on immediate retest.",
      "Stochastic momentum rolls over before confirmation.",
    ],
    engine: {
      executionIntervalMin: 5,
      higherIntervalsMin: [60],
      atrPeriod: 14,
      stopAtrMult: 1.1,
      targetR: 1.9,
      maxBarsInTrade: 26,
      minBarsBetweenTrades: 4,
      riskPerTradePct: 0.45,
      dailyRiskCapPct: 1.8,
      params: {
        divergenceLookback: 18,
        stochOversold: 20,
        stochOverbought: 80,
      },
    },
  },
  {
    id: "sar_vwap_opening_drive",
    name: "Parabolic SAR + VWAP Opening Drive",
    qualityRating: "A",
    marketEnvironment: "Opening drive momentum",
    indicators: ["Parabolic SAR", "VWAP", "OBV", "Volume", "ATR"],
    multiTimeframeAlignment:
      "15m directional bias guides 1m opening-drive trigger around VWAP and SAR flips.",
    longEntryRules: [
      "Parabolic SAR flips bullish in opening window.",
      "Price holds above VWAP and OBV confirms uptick.",
      "Trigger candle has above-average volume.",
    ],
    shortEntryRules: [
      "Parabolic SAR flips bearish in opening window.",
      "Price holds below VWAP and OBV confirms downtick.",
      "Trigger candle has above-average volume.",
    ],
    optionsSelection: [
      "Prefer ITM for opening-drive momentum reliability.",
      "Current weekly expiry for intraday resolution.",
    ],
    riskModel: [
      "Stop at SAR level with ATR cushion.",
      "Per-trade risk 0.5% and daily cap 2%.",
    ],
    tradeManagement: [
      "Quick partial at first impulse extension.",
      "Trail with SAR while momentum persists.",
    ],
    invalidationRules: [
      "VWAP reclaim failure after trigger.",
      "OBV diverges against opening impulse.",
    ],
    engine: {
      executionIntervalMin: 1,
      higherIntervalsMin: [15],
      atrPeriod: 14,
      stopAtrMult: 0.7,
      targetR: 1.6,
      maxBarsInTrade: 18,
      minBarsBetweenTrades: 2,
      riskPerTradePct: 0.5,
      dailyRiskCapPct: 2,
      params: {
        sarStep: 0.02,
        sarMax: 0.2,
        openingCutoffMin: 120,
        openingVolumeMult: 1.2,
      },
    },
  },
  {
    id: "stochastic_macd_range_crossover",
    name: "Stochastic-MACD Range Crossover",
    qualityRating: "B+",
    marketEnvironment: "Range compression and mean-reversion swings",
    indicators: ["Stochastic", "MACD", "ADX", "Pivot proxy", "ATR"],
    multiTimeframeAlignment:
      "60m context confirms range regime while 3m oscillators trigger directional bounce entries.",
    longEntryRules: [
      "Range regime active (low ADX / non-trending state).",
      "Stochastic %K crosses above %D from oversold zone.",
      "MACD line turns up with improving histogram.",
    ],
    shortEntryRules: [
      "Range regime active (low ADX / non-trending state).",
      "Stochastic %K crosses below %D from overbought zone.",
      "MACD line turns down with weakening histogram.",
    ],
    optionsSelection: [
      "Prefer ATM or slight OTM for quick range bounces.",
      "Use current weekly with tight trade-duration rules.",
    ],
    riskModel: [
      "Stop outside recent range extreme with ATR buffer.",
      "Per-trade risk 0.4% and daily cap 1.7%.",
    ],
    tradeManagement: [
      "Book at range midpoint / opposite edge proxy.",
      "Exit quickly when momentum stalls.",
    ],
    invalidationRules: [
      "Range breaks into trend before entry.",
      "MACD histogram reverses against crossover setup.",
    ],
    engine: {
      executionIntervalMin: 3,
      higherIntervalsMin: [60],
      atrPeriod: 14,
      stopAtrMult: 0.9,
      targetR: 1.7,
      maxBarsInTrade: 22,
      minBarsBetweenTrades: 4,
      riskPerTradePct: 0.4,
      dailyRiskCapPct: 1.7,
      params: {
        adxRangeMax: 20,
        stochOversold: 25,
        stochOverbought: 75,
      },
    },
  },
  {
    id: "fib_orderflow_continuation",
    name: "Fib-OrderFlow Continuation",
    qualityRating: "B+",
    marketEnvironment: "Trend pullback continuation",
    indicators: ["Supertrend", "Fibonacci", "MACD", "PCR", "ATR"],
    multiTimeframeAlignment:
      "15m trend filter with 5m pullback trigger around 0.5/0.618 retracement and momentum re-acceleration.",
    longEntryRules: [
      "Higher timeframe trend remains bullish.",
      "Price pulls back into 0.5/0.618 fib zone.",
      "MACD resumes bullish crossover with supportive PCR.",
    ],
    shortEntryRules: [
      "Higher timeframe trend remains bearish.",
      "Price pulls back into 0.5/0.618 fib zone.",
      "MACD resumes bearish crossover with supportive PCR.",
    ],
    optionsSelection: [
      "Prefer ATM for cleaner continuation delta.",
      "Shift to next weekly near expiry if pullback is slow.",
    ],
    riskModel: [
      "Stop beyond 0.786 fib with ATR overlay.",
      "Per-trade risk 0.6% and daily cap 2%.",
    ],
    tradeManagement: [
      "Partial at prior swing extension.",
      "Trail with supertrend/EMA trend guard.",
    ],
    invalidationRules: [
      "PCR flips against continuation bias.",
      "Price closes beyond 0.786 invalidation zone.",
    ],
    engine: {
      executionIntervalMin: 5,
      higherIntervalsMin: [15],
      atrPeriod: 14,
      stopAtrMult: 1,
      targetR: 2.1,
      maxBarsInTrade: 30,
      minBarsBetweenTrades: 5,
      riskPerTradePct: 0.6,
      dailyRiskCapPct: 2,
      params: {
        fibLookbackBars: 40,
        fibZoneToleranceAtr: 0.3,
        pcrTrendBullMin: 1.0,
        pcrTrendBearMax: 1.0,
      },
    },
  },
];

export const STRATEGY_LAB_RULES_BY_ID: Record<StrategyId, StrategyRuleSpec> =
  STRATEGY_LAB_RULES.reduce((acc, rule) => {
    acc[rule.id] = rule;
    return acc;
  }, {} as Record<StrategyId, StrategyRuleSpec>);
