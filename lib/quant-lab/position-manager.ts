import type { RiskState } from "@/lib/quant-lab/types";

export interface ExecutionExposureState {
  openTrades: number;
  maxOpenTrades: number;
  canOpenNewPosition: boolean;
  reasons: string[];
}

export function getExecutionExposureState(input: {
  riskState: RiskState;
  maxOpenTrades?: number;
}): ExecutionExposureState {
  const maxOpenTrades = input.maxOpenTrades ?? 3;
  const canOpenNewPosition = input.riskState.openTrades < maxOpenTrades;
  const reasons = !canOpenNewPosition
    ? [
        `Open trades ${input.riskState.openTrades} reached max simultaneous cap ${maxOpenTrades}.`,
      ]
    : [];

  return {
    openTrades: input.riskState.openTrades,
    maxOpenTrades,
    canOpenNewPosition,
    reasons,
  };
}
