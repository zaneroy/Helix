import type { FinancialMetrics } from "@/lib/finance/types";

export type ProfitabilityIntelligence = {
  profitabilityStatus: string;
  riskLevel: "Low" | "Moderate" | "High" | "Critical";
  summary: string;
  recommendation: string;
};

export function analyzeProfitability(
  metrics: FinancialMetrics
): ProfitabilityIntelligence {
  if (metrics.revenue <= 0) {
    return {
      profitabilityStatus: "No revenue recorded",
      riskLevel: "Unknown" as ProfitabilityIntelligence["riskLevel"],
      summary:
        "The company has not recorded revenue yet, so profitability cannot be evaluated.",
      recommendation:
        "Begin recording sales with accurate selling prices and unit costs so Helix can calculate gross profit, margins and net profitability.",
    };
  }

  if (metrics.netProfit < 0) {
    return {
      profitabilityStatus: "Unprofitable",
      riskLevel: "High",
      summary: `The company generated ${money(
        metrics.revenue
      )} in revenue but recorded a net loss of ${money(
        Math.abs(metrics.netProfit)
      )}. Gross margin is ${metrics.grossMargin.toFixed(
        1
      )}% and net margin is ${metrics.netMargin.toFixed(1)}%.`,
      recommendation:
        "Review product pricing, cost of goods sold and operating expenses. Focus on improving gross margin before increasing spending.",
    };
  }

  if (metrics.grossMargin < 20) {
    return {
      profitabilityStatus: "Weak gross margin",
      riskLevel: "Moderate",
      summary: `Revenue is ${money(
        metrics.revenue
      )}, but gross margin is only ${metrics.grossMargin.toFixed(
        1
      )}%, which leaves limited room for operating expenses and profit.`,
      recommendation:
        "Review unit costs, supplier pricing and selling prices. Consider increasing prices or reducing procurement costs.",
    };
  }

  if (metrics.netMargin < 10) {
    return {
      profitabilityStatus: "Thin net margin",
      riskLevel: "Moderate",
      summary: `The company is profitable, but net margin is ${metrics.netMargin.toFixed(
        1
      )}%, meaning only a small percentage of revenue remains after costs and expenses.`,
      recommendation:
        "Monitor operating expenses carefully and focus on higher-margin sales channels or products.",
    };
  }

  return {
    profitabilityStatus: "Healthy profitability",
    riskLevel: "Low",
    summary: `The company generated ${money(
      metrics.revenue
    )} in revenue with gross profit of ${money(
      metrics.grossProfit
    )} and net profit of ${money(metrics.netProfit)}. Gross margin is ${metrics.grossMargin.toFixed(
      1
    )}% and net margin is ${metrics.netMargin.toFixed(1)}%.`,
    recommendation:
      "Profitability appears healthy. Continue monitoring product margins, expense growth and sales concentration.",
  };
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}