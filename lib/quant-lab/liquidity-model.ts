function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface LiquidityInput {
  premium: number;
  marketVolume?: number | null;
}

export interface LiquidityEstimate {
  spreadPct: number;
  slippagePenaltyPct: number;
}

export function estimateLiquidity(input: LiquidityInput): LiquidityEstimate {
  const premium = Math.max(1, input.premium);
  const marketVolume = input.marketVolume ?? 0;

  // Lower volume and very low premium options tend to have wider spreads.
  const volumePenalty =
    marketVolume <= 0 ? 0.003 : clamp(0.0025 - (marketVolume / 5_000_000), 0.0005, 0.003);
  const cheapOptionPenalty = premium < 80 ? 0.002 : premium > 350 ? 0.0008 : 0.0012;
  const spreadPct = clamp(volumePenalty + cheapOptionPenalty, 0.001, 0.007);

  // Convert spread approximation into extra slippage penalty component.
  const slippagePenaltyPct = clamp(spreadPct * 0.5, 0.0005, 0.004);

  return {
    spreadPct,
    slippagePenaltyPct,
  };
}
