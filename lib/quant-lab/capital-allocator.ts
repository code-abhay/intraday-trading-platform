import type {
  AllocationDecision,
  CandidateStrategy,
  RiskState,
} from "@/lib/quant-lab/types";

interface CapitalAllocatorInput {
  selected: CandidateStrategy[];
  riskState: RiskState;
  maxSingleWeightPct?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function gradeFactor(grade: CandidateStrategy["grade"]): number {
  if (grade === "A") return 1;
  if (grade === "B") return 0.85;
  if (grade === "C") return 0.65;
  return 0.5;
}

export function allocateCapital(input: CapitalAllocatorInput): AllocationDecision[] {
  const { selected, riskState, maxSingleWeightPct = 50 } = input;
  if (selected.length === 0) return [];

  const drawdownPenalty = riskState.dailyDrawdownPct >= 0.03 ? 0.75 : 1;
  const streakPenalty = riskState.consecutiveLosses >= 2 ? 0.8 : 1;
  const driftPenalty =
    riskState.liveDriftPct != null && riskState.liveDriftPct < -0.4 ? 0.7 : 1;
  const globalRiskMultiplier = drawdownPenalty * streakPenalty * driftPenalty;

  const weightedScores = selected.map((candidate) => {
    const expectancy = candidate.liveExpectancyR ?? 0;
    const score = Math.max(
      1,
      (candidate.robustnessScore * gradeFactor(candidate.grade)) + (expectancy * 10)
    );
    return { candidate, score };
  });

  const totalScore = weightedScores.reduce((sum, item) => sum + item.score, 0);
  const uncapped = weightedScores.map((item) => ({
    candidate: item.candidate,
    weightPct: totalScore > 0 ? (item.score / totalScore) * 100 : 0,
  }));

  // Cap single strategy concentration.
  let remaining = 100;
  const provisional = uncapped
    .sort((left, right) => right.weightPct - left.weightPct)
    .map((item) => {
      const capped = clamp(item.weightPct, 0, Math.min(maxSingleWeightPct, remaining));
      remaining -= capped;
      return { candidate: item.candidate, weightPct: capped };
    });

  // Redistribute leftover proportionally where possible.
  if (remaining > 0.01) {
    const expandable = provisional.filter((item) => item.weightPct < maxSingleWeightPct);
    const totalExpandable = expandable.reduce(
      (sum, item) => sum + (maxSingleWeightPct - item.weightPct),
      0
    );
    if (totalExpandable > 0) {
      for (const item of provisional) {
        if (item.weightPct >= maxSingleWeightPct) continue;
        const share = (maxSingleWeightPct - item.weightPct) / totalExpandable;
        const delta = remaining * share;
        item.weightPct = clamp(item.weightPct + delta, 0, maxSingleWeightPct);
      }
    }
  }

  return provisional
    .map((item) => {
      const riskMultiplier = Number(clamp(globalRiskMultiplier, 0.2, 1).toFixed(3));
      const roundedWeight = Number(item.weightPct.toFixed(2));
      const action: AllocationDecision["action"] =
        roundedWeight <= 0.01 ? "BLOCK" : riskMultiplier < 1 ? "REDUCE" : "ALLOW";
      return {
        strategyId: item.candidate.strategyId,
        strategyName: item.candidate.strategyName,
        action,
        weightPct: roundedWeight,
        riskMultiplier,
        expectedRegimes: item.candidate.expectedRegimes,
        reasons: [
          "Weighted by robustness and expectancy",
          riskMultiplier < 1 ? "Global risk multiplier reduced exposure" : "Normal risk posture",
        ],
      };
    })
    .sort((left, right) => right.weightPct - left.weightPct);
}
