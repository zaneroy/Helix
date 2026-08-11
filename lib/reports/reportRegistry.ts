import type { FinancialMetrics } from "@/lib/finance/types";
import { generateInvestorReportPdf } from "@/lib/reports/investorReport";
import { generateProfitLossReportPdf } from "@/lib/reports/ProfitLossReport";
import { generateCashFlowReportPdf } from "@/lib/reports/cashFlowReport";
import { generateInventoryReportPdf } from "@/lib/reports/inventoryReport";
import { generateBusinessHealthReportPdf } from "@/lib/reports/businessHealthReport";
import { generateValuationReportPdf } from "@/lib/reports/valuationReport";
import { generateMonthlyFounderSummaryPdf } from "@/lib/reports/monthlyFounderSummary";
import { generateQuarterlyInvestorUpdatePdf } from "@/lib/reports/quarterlyInvestorUpdate";

export type ReportVisibility = "admin_only" | "investors";

export type ReportDefinition = {
  id: string;
  title: string;
  category: string;
  description: string;
  documentCategory: "financial" | "board" | "cap_table" | "other";
  defaultVisibility: ReportVisibility;
  status: "ready" | "coming_soon";
  generate?: (input: {
  investorName: string;
  companyName: string;
  founderName: string;
  metrics: FinancialMetrics;
  currency?: string;
}) => void;
};

export const reportRegistry: ReportDefinition[] = [
  {
    id: "investor-report",
    title: "Investor Financial Report",
    category: "Investor",
    description:
      "Executive summary, KPIs, valuation, liquidity, profitability and risk overview.",
    documentCategory: "financial",
    defaultVisibility: "investors",
    status: "ready",
    generate: generateInvestorReportPdf,
  },
  {
    id: "profit-loss",
    title: "Profit & Loss Report",
    category: "Financial Statement",
    description:
      "Revenue, COGS, gross profit, operating expenses, EBITDA estimate and net profit.",
    documentCategory: "financial",
    defaultVisibility: "investors",
    status: "ready",
    generate: generateProfitLossReportPdf,
  },
  {
    id: "cash-flow",
    title: "Cash Flow & Liquidity Report",
    category: "Liquidity",
    description:
      "Cash position, cash inflows, cash outflows, burn rate, runway and liquidity risk.",
    documentCategory: "financial",
    defaultVisibility: "investors",
    status: "ready",
    generate: generateCashFlowReportPdf,
  },
  {
    id: "inventory",
    title: "Inventory Valuation Report",
    category: "Inventory",
    description:
      "Inventory value, turnover, days inventory outstanding and CFO inventory analysis.",
    documentCategory: "financial",
    defaultVisibility: "investors",
    status: "ready",
    generate: generateInventoryReportPdf,
  },
  {
  id: "business-health",
  title: "Business Health Report",
  category: "Intelligence",
  description:
    "Profitability, liquidity, growth, margins, inventory and stability score breakdown.",
  documentCategory: "financial",
  defaultVisibility: "investors",
  status: "ready",
  generate: generateBusinessHealthReportPdf,
},
  {
  id: "valuation",
  title: "Company Valuation Report",
  category: "Valuation",
  description:
    "Asset floor valuation, revenue multiple valuation, investment-implied valuation and confidence score.",
  documentCategory: "financial",
  defaultVisibility: "investors",
  status: "ready",
  generate: generateValuationReportPdf,
},
  {
  id: "monthly-summary",
  title: "Monthly Founder Summary",
  category: "Management",
  description:
    "Monthly revenue, profit, expenses, cash position, inventory, business health, valuation and founder action plan.",
  documentCategory: "financial",
  defaultVisibility: "admin_only",
  status: "ready",
  generate: generateMonthlyFounderSummaryPdf,
},
  {
  id: "quarterly-summary",
  title: "Quarterly Investor Update",
  category: "Investor Update",
  description:
    "Quarterly financial update for investors, shareholders and board reporting with valuation, risks and roadmap.",
  documentCategory: "board",
  defaultVisibility: "investors",
  status: "ready",
  generate: generateQuarterlyInvestorUpdatePdf,
},
];