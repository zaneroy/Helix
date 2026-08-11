import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { FinancialMetrics } from "@/lib/finance/types";
import { analyzeBusinessHealth } from "@/lib/finance/intelligence/health";
import { analyzeLiquidity } from "@/lib/finance/intelligence/liquidity";
import { analyzeInventory } from "@/lib/finance/intelligence/inventory";
import { analyzeProfitability } from "@/lib/finance/intelligence/profitability";
import { analyzeValuation } from "@/lib/finance/intelligence/valuation";
import { formatCurrency } from "@/lib/currency/formatCurrency";

type MonthlyFounderSummaryInput = {
  investorName: string;
  companyName: string;
  founderName: string;
  metrics: FinancialMetrics;
  currency?: string;
};

export function generateMonthlyFounderSummaryPdf({
  companyName,
  founderName,
  metrics,
  currency = "USD",
}: MonthlyFounderSummaryInput) {
  const doc = new jsPDF();

  const money = (value: number | string | null | undefined) =>
    formatCurrency(value, currency);

  const generatedAt = new Date();
  const monthLabel = generatedAt.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const health = analyzeBusinessHealth(metrics);
  const liquidity = analyzeLiquidity(metrics);
  const inventory = analyzeInventory(metrics);
  const profitability = analyzeProfitability(metrics);
  const valuation = analyzeValuation({ metrics });

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 297, "F");

  doc.setDrawColor(103, 232, 249);
  doc.setLineWidth(0.8);
  doc.line(20, 30, 190, 30);

  doc.setTextColor(8, 47, 73);
  doc.setFontSize(12);
  doc.text("HELIX FINANCIAL OS", 20, 42);

  doc.setTextColor(2, 6, 7);
  doc.setFontSize(27);
  doc.text("Monthly Founder Summary", 20, 62);

  doc.setFontSize(15);
  doc.text(companyName, 20, 82);

  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  doc.text(`Founder: ${founderName}`, 20, 105);
  doc.text(`Reporting Period: ${monthLabel}`, 20, 112);
  doc.text(`Generated: ${generatedAt.toLocaleDateString()}`, 20, 119);
  doc.text("Confidential internal management report", 20, 132);

  doc.setDrawColor(220, 220, 220);
  doc.line(20, 145, 190, 145);

  doc.setTextColor(95, 95, 95);
  doc.setFontSize(9);
  doc.text(
    "This report is generated from live company operating and financial data inside Helix.",
    20,
    158
  );

  doc.addPage();
  sectionTitle(doc, "1. Executive Summary", 20);

  const executiveSummary = buildExecutiveSummary({
    metrics,
    currency,
    healthLabel: health.label,
    liquidityStatus: liquidity.liquidityStatus,
    profitabilityStatus: profitability.profitabilityStatus,
    inventoryStatus: inventory.turnoverStatus,
    valuationAmount: valuation.estimatedValuation,
  });

  paragraph(doc, executiveSummary, 14, 34);

  autoTable(doc, {
    startY: 82,
    head: [["Founder KPI", "Result"]],
    body: [
      ["Revenue", money(metrics.revenue)],
      ["Gross Profit", money(metrics.grossProfit)],
      ["Net Profit", money(metrics.netProfit)],
      ["Gross Margin", `${metrics.grossMargin.toFixed(1)}%`],
      ["Net Margin", `${metrics.netMargin.toFixed(1)}%`],
      ["Business Health", `${health.total}/100 · ${health.label}`],
      ["Estimated Cash Position", money(metrics.cashBalance)],
      ["Cash Runway", formatRunway(metrics.cashRunwayMonths)],
      ["Estimated Valuation", money(valuation.estimatedValuation)],
    ],
    styles: tableStyles(),
    headStyles: tableHeadStyles(),
  });

  doc.addPage();
  sectionTitle(doc, "2. Financial Snapshot", 20);

  autoTable(doc, {
    startY: 32,
    head: [["Profit & Loss", "Amount"]],
    body: [
      ["Revenue", money(metrics.revenue)],
      ["Cost of Goods Sold", `-${money(metrics.cogs)}`],
      ["Gross Profit", money(metrics.grossProfit)],
      ["Operating Expenses", `-${money(metrics.expenses)}`],
      ["EBITDA Estimate", money(metrics.ebitda)],
      ["Net Profit", money(metrics.netProfit)],
    ],
    styles: tableStyles(),
    headStyles: tableHeadStyles(),
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 14,
    head: [["Margin Analysis", "Result"]],
    body: [
      ["Gross Margin", `${metrics.grossMargin.toFixed(1)}%`],
      ["Net Margin", `${metrics.netMargin.toFixed(1)}%`],
      ["Profitability Status", profitability.profitabilityStatus],
      ["Profitability Risk", profitability.riskLevel],
    ],
    styles: tableStyles(),
    headStyles: tableHeadStyles(),
  });

  let y = (doc as any).lastAutoTable.finalY + 16;
  subTitle(doc, "CFO Profitability Note", y);
  paragraph(doc, profitability.summary, 14, y + 10);
  paragraph(doc, `Recommendation: ${profitability.recommendation}`, 14, y + 30);

  doc.addPage();
  sectionTitle(doc, "3. Cash & Liquidity", 20);

  autoTable(doc, {
    startY: 32,
    head: [["Liquidity Metric", "Value"]],
    body: [
      ["Estimated Cash Position", money(metrics.cashBalance)],
      ["Cash Inflows", money(metrics.cashInflows)],
      ["Cash Outflows", `-${money(metrics.cashOutflows)}`],
      ["Monthly Burn Rate", `${money(metrics.burnRate)} / month`],
      ["Cash Runway", formatRunway(metrics.cashRunwayMonths)],
      ["Liquidity Status", liquidity.liquidityStatus],
      ["Liquidity Risk", liquidity.riskLevel],
    ],
    styles: tableStyles(),
    headStyles: tableHeadStyles(),
  });

  y = (doc as any).lastAutoTable.finalY + 16;
  subTitle(doc, "CFO Liquidity Note", y);
  paragraph(doc, liquidity.summary, 14, y + 10);
  paragraph(doc, `Recommendation: ${liquidity.recommendation}`, 14, y + 30);

  doc.addPage();
  sectionTitle(doc, "4. Inventory & Working Capital", 20);

  autoTable(doc, {
    startY: 32,
    head: [["Inventory Metric", "Value"]],
    body: [
      ["Inventory Value", money(metrics.inventoryValue)],
      ["Cost of Goods Sold", money(metrics.cogs)],
      [
        "Inventory Turnover",
        metrics.inventoryTurnover === null
          ? "Not enough data"
          : `${metrics.inventoryTurnover.toFixed(2)}x`,
      ],
      [
        "Days Inventory Outstanding",
        inventory.daysInventoryOutstanding === null
          ? "Not enough data"
          : `${inventory.daysInventoryOutstanding.toFixed(0)} days`,
      ],
      ["Inventory Status", inventory.turnoverStatus],
      ["Inventory Risk", inventory.riskLevel],
    ],
    styles: tableStyles(),
    headStyles: tableHeadStyles(),
  });

  y = (doc as any).lastAutoTable.finalY + 16;
  subTitle(doc, "CFO Inventory Note", y);
  paragraph(doc, inventory.summary, 14, y + 10);
  paragraph(doc, `Recommendation: ${inventory.recommendation}`, 14, y + 30);

  doc.addPage();
  sectionTitle(doc, "5. Business Health Score", 20);

  autoTable(doc, {
    startY: 32,
    head: [["Health Category", "Score"]],
    body: [
      ["Profitability", `${health.profitability}/20`],
      ["Liquidity", `${health.liquidity}/20`],
      ["Growth", `${health.growth}/20`],
      ["Margins", `${health.margins}/15`],
      ["Inventory", `${health.inventory}/10`],
      ["Stability", `${health.stability}/15`],
      ["Overall Health", `${health.total}/100 · ${health.label}`],
    ],
    styles: tableStyles(),
    headStyles: tableHeadStyles(),
  });

  y = (doc as any).lastAutoTable.finalY + 16;
  subTitle(doc, "Health Interpretation", y);
  paragraph(doc, health.summary, 14, y + 10);
  paragraph(doc, `Recommendation: ${health.recommendation}`, 14, y + 30);

  doc.addPage();
  sectionTitle(doc, "6. Company Valuation", 20);

  autoTable(doc, {
    startY: 32,
    head: [["Valuation Method", "Value"]],
    body: [
      ["Asset Floor Valuation", money(valuation.assetFloorValuation)],
      ["Revenue Multiple Valuation", money(valuation.revenueMultipleValuation)],
      ["Investment-Implied Valuation", money(valuation.investmentImpliedValuation)],
      ["Estimated Company Valuation", money(valuation.estimatedValuation)],
      ["Primary Method", valuation.method],
      ["Confidence Score", `${valuation.confidenceScore}/100`],
      ["Investor Equity Value", money(metrics.equityValue)],
      ["Investor ROI", `${metrics.roi.toFixed(1)}%`],
    ],
    styles: tableStyles(),
    headStyles: tableHeadStyles(),
  });

  y = (doc as any).lastAutoTable.finalY + 16;
  subTitle(doc, "Valuation Note", y);
  paragraph(doc, valuation.summary, 14, y + 10);
  paragraph(doc, `Recommendation: ${valuation.recommendation}`, 14, y + 34);

  doc.addPage();
  sectionTitle(doc, "7. Founder Action Plan", 20);

  autoTable(doc, {
    startY: 34,
    head: [["Priority", "Action"]],
    body: buildActionPlan({
      metrics,
      liquidityRisk: liquidity.riskLevel,
      inventoryRisk: inventory.riskLevel,
      profitabilityRisk: profitability.riskLevel,
      healthScore: health.total,
    }),
    styles: tableStyles(),
    headStyles: tableHeadStyles(),
  });

  y = (doc as any).lastAutoTable.finalY + 18;
  subTitle(doc, "Founder Notes", y);
  paragraph(
    doc,
    "Use this section to record internal management notes, monthly priorities, operational concerns and decisions to review in the next reporting period.",
    14,
    y + 10
  );

  addFooters(doc, companyName);

  doc.save(`${slug(companyName)}-monthly-founder-summary-${slug(monthLabel)}.pdf`);
}

function buildExecutiveSummary({
  metrics,
  currency,
  healthLabel,
  liquidityStatus,
  profitabilityStatus,
  inventoryStatus,
  valuationAmount,
}: {
  metrics: FinancialMetrics;
  currency: string;
  healthLabel: string;
  liquidityStatus: string;
  profitabilityStatus: string;
  inventoryStatus: string;
  valuationAmount: number;
}) {
  const money = (value: number | string | null | undefined) =>
    formatCurrency(value, currency);

  return `This monthly founder summary shows ${money(
    metrics.revenue
  )} in revenue, ${money(metrics.grossProfit)} in gross profit and ${money(
    metrics.netProfit
  )} in net profit. Gross margin is ${metrics.grossMargin.toFixed(
    1
  )}% and net margin is ${metrics.netMargin.toFixed(
    1
  )}%. The business health rating is ${healthLabel}, liquidity is assessed as ${liquidityStatus}, profitability is assessed as ${profitabilityStatus}, and inventory is currently categorized as ${inventoryStatus}. Estimated company valuation is ${money(
    valuationAmount
  )}. This report is intended to help the founder understand what happened this month, why it matters, and what should be reviewed next.`;
}

function buildActionPlan({
  metrics,
  liquidityRisk,
  inventoryRisk,
  profitabilityRisk,
  healthScore,
}: {
  metrics: FinancialMetrics;
  liquidityRisk: string;
  inventoryRisk: string;
  profitabilityRisk: string;
  healthScore: number;
}) {
  const actions: string[][] = [];

  if (profitabilityRisk !== "Low") {
    actions.push([
      "Profitability",
      "Review pricing, product margins, supplier costs and operating expenses.",
    ]);
  }

  if (liquidityRisk !== "Low") {
    actions.push([
      "Liquidity",
      "Preserve cash, reduce discretionary spending and monitor runway before approving large outflows.",
    ]);
  }

  if (inventoryRisk === "High" || inventoryRisk === "Critical") {
    actions.push([
      "Inventory",
      "Identify slow-moving stock, reduce unnecessary reorders and consider promotions to release tied-up working capital.",
    ]);
  }

  if (metrics.grossMargin < 40) {
    actions.push([
      "Margins",
      "Investigate supplier cost increases or pricing weakness affecting gross margin.",
    ]);
  }

  if (healthScore < 70) {
    actions.push([
      "Business Health",
      "Set a monthly improvement target for profitability, liquidity and operational efficiency.",
    ]);
  }

  if (!actions.length) {
    actions.push([
      "Maintain Discipline",
      "Continue monitoring cash, margins, inventory movement and revenue growth. Current signals appear stable.",
    ]);
  }

  actions.push([
    "Next Month",
    "Compare this report against the next monthly summary to identify trends, improvements and new risks.",
  ]);

  return actions;
}

function sectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFontSize(16);
  doc.setTextColor(2, 6, 7);
  doc.text(title, 14, y);
}

function subTitle(doc: jsPDF, title: string, y: number) {
  doc.setFontSize(13);
  doc.setTextColor(2, 6, 7);
  doc.text(title, 14, y);
}

function paragraph(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFontSize(10);
  doc.setTextColor(70, 70, 70);
  doc.text(doc.splitTextToSize(text, 180), x, y);
}

function addFooters(doc: jsPDF, companyName: string) {
  const pageCount = doc.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(`Generated by Helix Financial OS · ${companyName}`, 14, 287);
    doc.text(`Page ${i} of ${pageCount}`, 180, 287);
  }
}

function tableStyles() {
  return {
    fontSize: 9,
    cellPadding: 3,
  };
}

function tableHeadStyles() {
  return {
    fillColor: [8, 47, 73] as [number, number, number],
    textColor: [255, 255, 255] as [number, number, number],
  };
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatRunway(months: number | null) {
  if (months === null) return "No current burn";
  if (months >= 120) return "No immediate liquidity risk";
  if (months >= 24) return `${months.toFixed(0)} months`;
  return `${months.toFixed(1)} months`;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}