import type { FinancialMetrics } from "@/lib/finance/types";

export type HealthScoreBreakdown = {
  profitability: number;
  liquidity: number;
  growth: number;
  margins: number;
  inventory: number;
  stability: number;
  total: number;
  label: string;
  summary: string;
  recommendation: string;
};

export function analyzeBusinessHealth(metrics: FinancialMetrics): HealthScoreBreakdown {
  const profitability = scoreProfitability(metrics);
  const liquidity = scoreLiquidity(metrics);
  const growth = scoreGrowth(metrics);
  const margins = scoreMargins(metrics);
  const inventory = scoreInventory(metrics);
  const stability = scoreStability(metrics);

  const total =
    profitability + liquidity + growth + margins + inventory + stability;

  const label = getHealthLabel(total);

  return {
    profitability,
    liquidity,
    growth,
    margins,
    inventory,
    stability,
    total,
    label,
    summary: buildHealthSummary(metrics, total, label),
    recommendation: buildHealthRecommendation(metrics, total),
  };
}

function scoreProfitability(metrics: FinancialMetrics) {
  if (metrics.netProfit > 0) return 20;
  if (metrics.grossProfit > 0) return 10;
  return 0;
}

function scoreLiquidity(metrics: FinancialMetrics) {
  if (metrics.cashRunwayMonths === null && metrics.cashBalance > 0) return 20;
  if ((metrics.cashRunwayMonths || 0) >= 12) return 20;
  if ((metrics.cashRunwayMonths || 0) >= 6) return 14;
  if ((metrics.cashRunwayMonths || 0) >= 3) return 8;
  return 0;
}

function scoreGrowth(metrics: FinancialMetrics) {
  const growth = "revenueGrowth" in metrics ? Number((metrics as any).revenueGrowth || 0) : 0;

  if (growth >= 25) return 20;
  if (growth >= 10) return 15;
  if (growth > 0) return 10;
  if (metrics.revenue > 0) return 5;
  return 0;
}

function scoreMargins(metrics: FinancialMetrics) {
  if (metrics.grossMargin >= 60 && metrics.netMargin >= 25) return 15;
  if (metrics.grossMargin >= 40 && metrics.netMargin >= 10) return 12;
  if (metrics.grossMargin >= 20 && metrics.netMargin > 0) return 8;
  if (metrics.grossMargin > 0) return 4;
  return 0;
}

function scoreInventory(metrics: FinancialMetrics) {
  if (metrics.inventoryTurnover === null) return 3;
  if (metrics.inventoryTurnover >= 3) return 10;
  if (metrics.inventoryTurnover >= 1) return 7;
  if (metrics.inventoryTurnover > 0) return 3;
  return 0;
}

function scoreStability(metrics: FinancialMetrics) {
  if (metrics.cashBalance > 0 && metrics.netProfit > 0) return 15;
  if (metrics.cashBalance > 0 || metrics.netProfit > 0) return 8;
  return 0;
}

function getHealthLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Stable";
  if (score >= 30) return "Needs attention";
  return "High risk";
}

function buildHealthSummary(
  metrics: FinancialMetrics,
  score: number,
  label: string
) {
  return `Business health is rated ${label} at ${score}/100. Revenue is ${money(
    metrics.revenue
  )}, net profit is ${money(metrics.netProfit)}, gross margin is ${metrics.grossMargin.toFixed(
    1
  )}%, and estimated cash position is ${money(metrics.cashBalance)}.`;
}

function buildHealthRecommendation(metrics: FinancialMetrics, score: number) {
  if (score >= 85) {
    return "The company appears financially strong. Continue monitoring growth, margin stability, inventory movement and cash discipline.";
  }

  if (score >= 70) {
    return "The company is in a strong position, but there may be room to improve growth, inventory efficiency or cash management.";
  }

  if (score >= 50) {
    return "The company appears stable but should focus on strengthening profitability, liquidity and operating efficiency.";
  }

  return "The company should review cash flow, margins, expenses and stock movement before making large capital decisions.";
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}