export interface AISignalInput {
  segment: string;
  ltp: number;
  bias: string;
  biasStrength?: string;
  confidence: number;
  pcr: { value: number; bias: string; callOI: number; putOI: number };
  maxPain: number;
  technicals?: {
    emaFast: number;
    emaSlow: number;
    emaTrend: string;
    rsiValue: number;
    rsiSignal: string;
    macdHist: number;
    macdBias: string;
    vwap: number;
    vwapBias: string;
    adxProxy: number;
    trendStrength: string;
  } | null;
  srLevels?: {
    pdh: number;
    pdl: number;
    pivot: number;
    r1: number;
    r2: number;
    s1: number;
    s2: number;
  } | null;
  volatility?: {
    atr: number;
    ratio: number;
    regime: string;
  } | null;
  advancedFilters?: {
    rfConfirmsBull: boolean;
    rfConfirmsBear: boolean;
    rqkConfirmsBull: boolean;
    rqkConfirmsBear: boolean;
    choppiness: number;
    isChoppy: boolean;
  } | null;
  optionsAdvisor?: {
    strike: number;
    side: string;
    premium: number;
    delta: number;
    iv: number;
    moneyness: string;
  } | null;
  targets?: {
    entry: number;
    stopLoss: number;
    t1: number;
    t2: number;
    t3: number;
  } | null;
  sentiment?: {
    score: number;
    side: string;
    momentum: string;
  } | null;
}

export interface AIAnalysisResult {
  aiScore: number;
  aiConfidence: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  reasoning: string;
  keyFactors: string[];
  caution: string | null;
  adjustedSL: number | null;
  adjustedT1: number | null;
}

export function buildAnalysisPrompt(input: AISignalInput): string {
  const lines: string[] = [
    `You are an expert Indian options trader analyzing a live ${input.segment} intraday signal.`,
    `Evaluate the trade setup quality and provide a structured assessment.`,
    "",
    `## Current Market State`,
    `- Segment: ${input.segment}`,
    `- LTP: ${input.ltp}`,
    `- System Bias: ${input.bias} (${input.biasStrength ?? "N/A"})`,
    `- System Confidence: ${input.confidence}%`,
    `- PCR: ${input.pcr.value.toFixed(2)} (${input.pcr.bias}), Call OI: ${input.pcr.callOI.toLocaleString()}, Put OI: ${input.pcr.putOI.toLocaleString()}`,
    `- Max Pain: ${input.maxPain}`,
  ];

  if (input.technicals) {
    const t = input.technicals;
    lines.push(
      "",
      `## Technical Indicators`,
      `- EMA 21/50: ${t.emaFast.toFixed(1)} / ${t.emaSlow.toFixed(1)} → ${t.emaTrend}`,
      `- RSI (14): ${t.rsiValue} → ${t.rsiSignal}`,
      `- MACD Hist: ${t.macdHist.toFixed(2)} → ${t.macdBias}`,
      `- VWAP: ${t.vwap.toFixed(2)} → ${t.vwapBias} (LTP ${input.ltp > t.vwap ? "above" : "below"} VWAP)`,
      `- ADX Proxy: ${t.adxProxy.toFixed(1)} → Trend Strength: ${t.trendStrength}`,
    );
  }

  if (input.srLevels) {
    const sr = input.srLevels;
    lines.push(
      "",
      `## Support/Resistance Levels`,
      `- R2: ${sr.r2} | R1: ${sr.r1} | Pivot: ${sr.pivot} | S1: ${sr.s1} | S2: ${sr.s2}`,
      `- PDH: ${sr.pdh} | PDL: ${sr.pdl}`,
      `- LTP relative to pivot: ${input.ltp > sr.pivot ? "ABOVE" : "BELOW"} (${Math.abs(input.ltp - sr.pivot).toFixed(0)} pts)`,
    );
  }

  if (input.volatility) {
    const v = input.volatility;
    lines.push(
      "",
      `## Volatility`,
      `- ATR: ${v.atr.toFixed(1)}, Ratio: ${v.ratio}, Regime: ${v.regime}`,
    );
  }

  if (input.advancedFilters) {
    const f = input.advancedFilters;
    lines.push(
      "",
      `## Advanced Filters`,
      `- Range Filter: ${f.rfConfirmsBull ? "BULLISH" : f.rfConfirmsBear ? "BEARISH" : "NEUTRAL"}`,
      `- RQK Kernel: ${f.rqkConfirmsBull ? "BULLISH" : f.rqkConfirmsBear ? "BEARISH" : "NEUTRAL"}`,
      `- Choppiness: ${f.choppiness.toFixed(1)} (${f.isChoppy ? "CHOPPY/RANGING" : "TRENDING"})`,
    );
  }

  if (input.optionsAdvisor) {
    const o = input.optionsAdvisor;
    lines.push(
      "",
      `## Options Advisor`,
      `- Strike: ${o.strike} ${o.side} (${o.moneyness})`,
      `- Premium: ₹${o.premium}, Delta: ${o.delta.toFixed(3)}, IV: ${o.iv}%`,
    );
  }

  if (input.targets) {
    const tgt = input.targets;
    lines.push(
      "",
      `## Targets & Stops`,
      `- Entry: ${tgt.entry}, SL: ${tgt.stopLoss}, T1: ${tgt.t1}, T2: ${tgt.t2}, T3: ${tgt.t3}`,
    );
  }

  if (input.sentiment) {
    const s = input.sentiment;
    lines.push(
      "",
      `## Sentiment`,
      `- Score: ${s.score}, Side: ${s.side}, Momentum: ${s.momentum}`,
    );
  }

  lines.push(
    "",
    `## Your Task`,
    `Analyze the above data holistically and return ONLY a JSON object with this exact structure:`,
    `{`,
    `  "aiScore": <number 1-10, overall trade quality>,`,
    `  "aiConfidence": <number 0-100, your confidence in the signal>,`,
    `  "riskLevel": <"LOW" | "MEDIUM" | "HIGH">,`,
    `  "reasoning": <string, 2-3 sentences explaining your assessment>,`,
    `  "keyFactors": <array of 3 strings, the top factors driving your assessment>,`,
    `  "caution": <string or null, any red flags or warnings>,`,
    `  "adjustedSL": <number or null, suggest adjusted stop-loss if current one seems poor>,`,
    `  "adjustedT1": <number or null, suggest adjusted T1 if current one seems poor>`,
    `}`,
    "",
    `Guidelines:`,
    `- Score 8-10: Strong confluence of indicators, trending market, good risk/reward`,
    `- Score 5-7: Mixed signals, some indicators conflicting, acceptable setup`,
    `- Score 1-4: Weak setup, choppy market, poor risk/reward, indicators contradicting`,
    `- If bias is NEUTRAL, score should generally be 3 or lower (no clear trade)`,
    `- Consider if LTP is near key S/R levels which adds risk`,
    `- Factor in volatility regime — high volatility needs wider stops`,
    `- Check if advanced filters (RF, RQK) confirm or contradict the bias`,
    `- Evaluate if the options recommendation has good delta and reasonable premium`,
  );

  return lines.join("\n");
}
