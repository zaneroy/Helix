import type { FinancialMetrics } from "@/lib/finance/types";

export type ValuationIntelligence = {
  assetFloorValuation: number;
  revenueMultipleValuation: number;
  investmentImpliedValuation: number;
  estimatedValuation: number;
  confidenceScore: number;
  method: string;
  summary: string;
  recommendation: string;
};

type ValuationInput = {
  metrics: FinancialMetrics;
  revenueMultiple?: number;
};

export function analyzeValuation({
  metrics,
  revenueMultiple = 2,
}: ValuationInput): ValuationIntelligence {
  const assetFloorValuation =
    Math.max(metrics.cashBalance, 0) + Math.max(metrics.inventoryValue, 0);

  const annualizedRevenue = metrics.revenue * 12;
  const revenueMultipleValuation =
    annualizedRevenue > 0 ? annualizedRevenue * revenueMultiple : 0;

  const investmentImpliedValuation =
    metrics.totalInvestment > 0 && metrics.equityPercent > 0
      ? metrics.totalInvestment / (metrics.equityPercent / 100)
      : 0;

  const availableMethods = [
    assetFloorValuation,
    revenueMultipleValuation,
    investmentImpliedValuation,
  ].filter((value) => value > 0);

  const estimatedValuation =
    availableMethods.length > 0 ? Math.max(...availableMethods) : 0;

  const confidenceScore = calculateConfidence({
    metrics,
    assetFloorValuation,
    revenueMultipleValuation,
    investmentImpliedValuation,
  });

  const method = getPrimaryMethod({
    estimatedValuation,
    assetFloorValuation,
    revenueMultipleValuation,
    investmentImpliedValuation,
  });

  return {
    assetFloorValuation,
    revenueMultipleValuation,
    investmentImpliedValuation,
    estimatedValuation,
    confidenceScore,
    method,
    summary: buildSummary({
      metrics,
      estimatedValuation,
      method,
      confidenceScore,
      revenueMultiple,
    }),
    recommendation: buildRecommendation(confidenceScore),
  };
}

function calculateConfidence({
  metrics,
  assetFloorValuation,
  revenueMultipleValuation,
  investmentImpliedValuation,
}: {
  metrics: FinancialMetrics;
  assetFloorValuation: number;
  revenueMultipleValuation: number;
  investmentImpliedValuation: number;
}) {
  let score = 0;

  if (metrics.revenue > 0) score += 25;
  if (metrics.netProfit > 0) score += 20;
  if (metrics.grossMargin > 30) score += 15;
  if (metrics.cashBalance > 0) score += 15;
  if (metrics.inventoryValue > 0) score += 10;
  if (investmentImpliedValuation > 0) score += 10;
  if (assetFloorValuation > 0 && revenueMultipleValuation > 0) score += 5;

  return Math.min(score, 100);
}

function getPrimaryMethod({
  estimatedValuation,
  assetFloorValuation,
  revenueMultipleValuation,
  investmentImpliedValuation,
}: {
  estimatedValuation: number;
  assetFloorValuation: number;
  revenueMultipleValuation: number;
  investmentImpliedValuation: number;
}) {
  if (estimatedValuation === investmentImpliedValuation) {
    return "Investment-implied valuation";
  }

  if (estimatedValuation === revenueMultipleValuation) {
    return "Revenue multiple valuation";
  }

  if (estimatedValuation === assetFloorValuation) {
    return "Asset floor valuation";
  }

  return "Hybrid valuation";
}

function buildSummary({
  metrics,
  estimatedValuation,
  method,
  confidenceScore,
  revenueMultiple,
}: {
  metrics: FinancialMetrics;
  estimatedValuation: number;
  method: string;
  confidenceScore: number;
  revenueMultiple: number;
}) {
  return `Estimated company valuation is ${money(
    estimatedValuation
  )} using ${method}. The model considers asset value, investment-implied valuation and annualized revenue at a ${revenueMultiple.toFixed(
    1
  )}x multiple. Confidence is ${confidenceScore}/100 based on revenue activity, profitability, margins, liquidity and available investment data.`;
}

function buildRecommendation(confidenceScore: number) {
  if (confidenceScore >= 80) {
    return "Valuation confidence is strong. Continue tracking revenue growth, profitability and cash position to maintain valuation quality.";
  }

  if (confidenceScore >= 60) {
    return "Valuation confidence is acceptable, but more historical revenue, expense and cash data would improve reliability.";
  }

  return "Valuation confidence is limited. Use this as an estimate only until more revenue history, profitability data and balance sheet information are available.";
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}