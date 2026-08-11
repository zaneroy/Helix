import type { FinancialMetrics } from "@/lib/finance/types";

export type LiquidityIntelligence = {
  liquidityStatus: string;
  riskLevel: "Low" | "Moderate" | "High" | "Critical";
  summary: string;
  recommendation: string;
};

export function analyzeLiquidity(metrics: FinancialMetrics): LiquidityIntelligence {
  const cash = metrics.cashBalance;
  const burn = metrics.burnRate;
  const runway = metrics.cashRunwayMonths;

  if (cash <= 0) {
    return {
      liquidityStatus: "Negative cash position",
      riskLevel: "Critical",
      summary:
        "The company has a negative estimated cash position, which may limit its ability to cover operating expenses or investor withdrawals.",
      recommendation:
        "Review cash inflows, reduce non-essential spending, delay withdrawals, and consider additional capital funding.",
    };
  }

  if (burn <= 0 || runway === null) {
    return {
      liquidityStatus: "No current operating burn",
      riskLevel: "Low",
      summary:
        "The company currently has no measurable monthly operating burn, so liquidity risk appears low based on available expense data.",
      recommendation:
        "Continue monitoring expenses and ensure all outgoing cash movements are recorded in the cash ledger.",
    };
  }

  if (runway < 3) {
    return {
      liquidityStatus: "Critical runway",
      riskLevel: "Critical",
      summary: `The company has approximately ${runway.toFixed(
        1
      )} months of runway based on current cash and average monthly burn.`,
      recommendation:
        "Prioritize cash preservation, pause discretionary spending, and review funding or revenue acceleration options immediately.",
    };
  }

  if (runway < 6) {
    return {
      liquidityStatus: "Short runway",
      riskLevel: "High",
      summary: `The company has approximately ${runway.toFixed(
        1
      )} months of runway, which is below a comfortable operating buffer.`,
      recommendation:
        "Reduce avoidable expenses, improve collections, and avoid approving investor withdrawals until liquidity improves.",
    };
  }

  if (runway < 12) {
    return {
      liquidityStatus: "Moderate runway",
      riskLevel: "Moderate",
      summary: `The company has approximately ${runway.toFixed(
        1
      )} months of runway. Liquidity is acceptable but should be monitored.`,
      recommendation:
        "Maintain cash discipline and monitor upcoming expenses before approving large capital outflows.",
    };
  }

  return {
    liquidityStatus: "Strong liquidity position",
    riskLevel: "Low",
    summary:
      runway >= 120
        ? "The company has no immediate liquidity risk based on current cash position and monthly burn."
        : `The company has approximately ${runway.toFixed(
            0
          )} months of runway, indicating a strong liquidity position.`,
    recommendation:
      "The company appears able to cover near-term obligations. Continue using the cash ledger to maintain accurate liquidity reporting.",
  };
}