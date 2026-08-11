import type {
  FinanceCashLedgerEntry,
  FinanceExpense,
  FinanceInvestment,
  FinanceProduct,
  FinanceSale,
  FinancialMetrics,
} from "./types";
import { toNumber } from "./format";
import { analyzeBusinessHealth } from "@/lib/finance/intelligence/health";
import { analyzeValuation } from "@/lib/finance/intelligence/valuation";

type BuildMetricsInput = {
  sales: FinanceSale[];
  expenses: FinanceExpense[];
  products: FinanceProduct[];
  investment?: FinanceInvestment | null;
  cashLedger?: FinanceCashLedgerEntry[];
};

export function buildFinancialMetrics({
  sales,
  expenses,
  products,
  investment,
  cashLedger = [],
}: BuildMetricsInput): FinancialMetrics {
  const revenue = sales.reduce(
    (sum, sale) => sum + toNumber(sale.total_amount),
    0
  );

  const cogs = sales.reduce((sum, sale) => {
    const quantity = toNumber(sale.quantity);
    const unitCost = toNumber(sale.unit_cost);

    if (quantity > 0 && unitCost > 0) {
      return sum + quantity * unitCost;
    }

    const total = toNumber(sale.total_amount);
    const profit = toNumber(sale.profit_amount);

    return sum + Math.max(total - profit, 0);
  }, 0);

  const grossProfit = revenue - cogs;

  const operatingExpenses = expenses.reduce(
    (sum, expense) => sum + toNumber(expense.amount),
    0
  );

  const netProfit = grossProfit - operatingExpenses;

  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  const inventoryValue = products.reduce((sum, product) => {
    const onHand = toNumber(product.quantity_on_hand || product.stock_quantity);
    const unitCost = toNumber(product.price_per_piece);

    return sum + onHand * unitCost;
  }, 0);

  const totalInvestment = toNumber(investment?.amount);
  const equityPercent = toNumber(investment?.equity_percent);

  const cashInflows = cashLedger
    .filter((entry) => entry.direction === "inflow")
    .reduce((sum, entry) => sum + toNumber(entry.amount), 0);

  const cashOutflows = cashLedger
    .filter((entry) => entry.direction === "outflow")
    .reduce((sum, entry) => sum + toNumber(entry.amount), 0);

  const ledgerCashBalance = cashInflows - cashOutflows;

  const fallbackCashBalance = totalInvestment + revenue - cogs - operatingExpenses;

  const cashBalance =
    cashLedger.length > 0 ? ledgerCashBalance : fallbackCashBalance;

  const valuationAnalysis = analyzeValuation({
  metrics: {
    revenue,
    cogs,
    grossProfit,
    expenses: operatingExpenses,
    netProfit,
    grossMargin,
    netMargin,

    inventoryValue,

    cashBalance,
    cashOnHand: cashBalance,

    cashInflows,
    cashOutflows,

    totalInvestment,
    equityPercent,
    companyValuation: 0,
    equityValue: 0,
    roi: 0,

    burnRate: 0,
    cashRunwayMonths: null,

    ebitda: 0,
    inventoryTurnover: null,

    businessHealthScore: 0,
  },
});

const companyValuation = valuationAnalysis.estimatedValuation;
const equityValue = companyValuation * (equityPercent / 100);

const roi =
  totalInvestment > 0
    ? ((equityValue - totalInvestment) / totalInvestment) * 100
    : 0;

  const burnRate = calculateMonthlyBurnRate(expenses);

  const cashRunwayMonths =
    burnRate > 0 && cashBalance > 0 ? cashBalance / burnRate : null;

  const ebitda = netProfit;

  const inventoryTurnover = inventoryValue > 0 ? cogs / inventoryValue : null;

  const healthAnalysis = analyzeBusinessHealth({
  revenue,
  cogs,
  grossProfit,
  expenses: operatingExpenses,
  netProfit,
  grossMargin,
  netMargin,

  inventoryValue,

  cashBalance,
  cashOnHand: cashBalance,

  cashInflows,
  cashOutflows,

  totalInvestment,
  equityPercent,
  companyValuation: 0,
  equityValue: 0,
  roi: 0,

  burnRate,
  cashRunwayMonths,

  ebitda,
  inventoryTurnover,

  businessHealthScore: 0,
});

const businessHealthScore = healthAnalysis.total;

  return {
    revenue,
    cogs,
    grossProfit,
    expenses: operatingExpenses,
    netProfit,
    grossMargin,
    netMargin,

    inventoryValue,

    cashBalance,
    cashOnHand: cashBalance,

    cashInflows,
    cashOutflows,

    totalInvestment,
    equityPercent,
    companyValuation,
    equityValue,
    roi,

    burnRate,
    cashRunwayMonths,

    ebitda,
    inventoryTurnover,

    businessHealthScore,
  };
}

function calculateMonthlyBurnRate(expenses: FinanceExpense[]) {
  const now = new Date();
  const ninetyDaysAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 90
  );

  const last90DaysExpenses = expenses.reduce((sum, expense) => {
    const date = new Date(expense.expense_date || expense.created_at || "");

    if (date >= ninetyDaysAgo && date <= now) {
      return sum + toNumber(expense.amount);
    }

    return sum;
  }, 0);

  return last90DaysExpenses / 3;
}

function calculateBusinessHealthScore({
  revenue,
  grossMargin,
  netMargin,
  cashBalance,
  burnRate,
  inventoryTurnover,
}: {
  revenue: number;
  grossMargin: number;
  netMargin: number;
  cashBalance: number;
  burnRate: number;
  inventoryTurnover: number | null;
}) {
  let score = 0;

  if (revenue > 0) score += 20;

  if (grossMargin >= 60) score += 25;
  else if (grossMargin >= 40) score += 20;
  else if (grossMargin >= 20) score += 12;
  else if (grossMargin > 0) score += 6;

  if (netMargin >= 25) score += 20;
  else if (netMargin >= 10) score += 15;
  else if (netMargin > 0) score += 8;

  if (burnRate <= 0 && cashBalance > 0) score += 20;
  else if (cashBalance > burnRate * 12) score += 20;
  else if (cashBalance > burnRate * 6) score += 16;
  else if (cashBalance > burnRate * 3) score += 12;
  else if (cashBalance > 0) score += 6;

  if (inventoryTurnover !== null && inventoryTurnover >= 3) score += 15;
  else if (inventoryTurnover !== null && inventoryTurnover >= 1) score += 10;
  else if (inventoryTurnover !== null && inventoryTurnover > 0) score += 5;

  return Math.min(Math.round(score), 100);
}