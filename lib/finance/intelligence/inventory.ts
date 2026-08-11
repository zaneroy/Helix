import type { FinancialMetrics } from "@/lib/finance/types";

export type InventoryIntelligence = {
  turnoverStatus: string;
  riskLevel: "Low" | "Moderate" | "High" | "Critical" | "Unknown";
  daysInventoryOutstanding: number | null;
  summary: string;
  recommendation: string;
};

export function analyzeInventory(metrics: FinancialMetrics): InventoryIntelligence {
  const turnover = metrics.inventoryTurnover;
  const inventoryValue = metrics.inventoryValue;
  const cogs = metrics.cogs;

  if (inventoryValue <= 0) {
    return {
      turnoverStatus: "No inventory value recorded",
      riskLevel: "Unknown",
      daysInventoryOutstanding: null,
      summary:
        "Inventory value has not been recorded, so inventory efficiency cannot be evaluated yet.",
      recommendation:
        "Add accurate product cost and stock quantity data so Helix can calculate inventory turnover and holding risk.",
    };
  }

  if (!turnover || turnover <= 0 || cogs <= 0) {
    return {
      turnoverStatus: "No measurable inventory movement",
      riskLevel: "High",
      daysInventoryOutstanding: null,
      summary:
        "Inventory has value, but there is not enough cost-of-goods-sold activity to measure stock movement.",
      recommendation:
        "Review whether inventory is newly purchased, slow moving, or missing sales/COGS data.",
    };
  }

  const daysInventoryOutstanding = 365 / turnover;

  let riskLevel: InventoryIntelligence["riskLevel"] = "Low";
  let turnoverStatus = "Healthy inventory movement";

  if (turnover < 0.5) {
    riskLevel = "High";
    turnoverStatus = "Very slow inventory movement";
  } else if (turnover < 1) {
    riskLevel = "Moderate";
    turnoverStatus = "Slow-moving inventory";
  } else if (turnover < 3) {
    riskLevel = "Low";
    turnoverStatus = "Stable inventory movement";
  } else {
    riskLevel = "Low";
    turnoverStatus = "Strong inventory turnover";
  }

  const summary = `Inventory turnover is ${turnover.toFixed(
    2
  )}x, implying approximately ${daysInventoryOutstanding.toFixed(
    0
  )} days of inventory on hand at the current sales rate.`;

  const recommendation =
    riskLevel === "High"
      ? "Investigate slow-moving products, avoid unnecessary reorder purchases, and consider promotions or bundling to release tied-up working capital."
      : riskLevel === "Moderate"
        ? "Monitor stock velocity and compare product-level sales performance before increasing inventory purchases."
        : "Inventory movement appears acceptable based on current sales and cost data.";

  return {
    turnoverStatus,
    riskLevel,
    daysInventoryOutstanding,
    summary,
    recommendation,
  };
}