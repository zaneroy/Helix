import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { FinancialMetrics } from "@/lib/finance/types";
import { analyzeBusinessHealth } from "@/lib/finance/intelligence/health";
import { analyzeLiquidity } from "@/lib/finance/intelligence/liquidity";
import { analyzeInventory } from "@/lib/finance/intelligence/inventory";
import { analyzeProfitability } from "@/lib/finance/intelligence/profitability";
import { analyzeValuation } from "@/lib/finance/intelligence/valuation";
import { formatCurrency } from "@/lib/currency/formatCurrency";

type QuarterlyInvestorUpdateInput = {
  investorName: string;
  companyName: string;
  founderName: string;
  metrics: FinancialMetrics;
  currency?: string;
};

export function generateQuarterlyInvestorUpdatePdf({
  investorName,
  companyName,
  founderName,
  metrics,
  currency = "USD",
}: QuarterlyInvestorUpdateInput) {
  const doc = new jsPDF();

  const money = (value: number | string | null | undefined) =>
    formatCurrency(value, currency);
  const generatedAt = new Date();
  const quarterLabel = getQuarterLabel(generatedAt);

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
  doc.text("Quarterly Investor Update", 20, 62);

  doc.setFontSize(15);
  doc.text(companyName, 20, 82);

  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  doc.text(`Prepared for: ${investorName}`, 20, 105);
  doc.text(`Founder: ${founderName}`, 20, 112);
  doc.text(`Reporting Period: ${quarterLabel}`, 20, 119);
  doc.text(`Generated: ${generatedAt.toLocaleDateString()}`, 20, 126);
  doc.text("Confidential investor communication", 20, 139);

  doc.setDrawColor(220, 220, 220);
  doc.line(20, 152, 190, 152);

  doc.setTextColor(95, 95, 95);
  doc.setFontSize(9);
  doc.text(
    "This investor update is generated from live company data inside Helix.",
    20,
    165
  );

  doc.addPage();
  sectionTitle(doc, "1. Founder Letter", 20);

  paragraph(
  doc,
  buildFounderLetter({
    investorName,
    companyName,
    founderName,
    quarterLabel,
    metrics,
    currency,
    healthLabel: health.label,
    valuationAmount: valuation.estimatedValuation,
  }),
  14,
  34
);

  doc.addPage();
  sectionTitle(doc, "2. Quarterly Highlights", 20);

  autoTable(doc, {
    startY: 34,
    head: [["Area", "Investor Update"]],
    body: [
      ["Revenue", `${money(metrics.revenue)} generated during the current reporting view.`],
      ["Profitability", `${profitability.profitabilityStatus}. Net profit is ${money(metrics.netProfit)}.`],
      ["Liquidity", `${liquidity.liquidityStatus}. Cash runway is ${formatRunway(metrics.cashRunwayMonths)}.`],
      ["Inventory", `${inventory.turnoverStatus}. Inventory value is ${money(metrics.inventoryValue)}.`],
      ["Valuation", `Estimated company valuation is ${money(valuation.estimatedValuation)}.`],
      ["Business Health", `${health.total}/100 · ${health.label}.`],
    ],
    styles: tableStyles(),
    headStyles: tableHeadStyles(),
  });

  let y = (doc as any).lastAutoTable.finalY + 16;
  subTitle(doc, "Investor Summary", y);
  paragraph(
    doc,
    `This quarter, the company shows ${health.label.toLowerCase()} overall business health. Liquidity is assessed as ${liquidity.riskLevel}, profitability risk is ${profitability.riskLevel}, and inventory risk is ${inventory.riskLevel}.`,
    14,
    y + 10
  );

  doc.addPage();
  sectionTitle(doc, "3. Financial Performance", 20);

  autoTable(doc, {
    startY: 32,
    head: [["Financial Metric", "Value"]],
    body: [
      ["Revenue", money(metrics.revenue)],
      ["Cost of Goods Sold", `-${money(metrics.cogs)}`],
      ["Gross Profit", money(metrics.grossProfit)],
      ["Operating Expenses", `-${money(metrics.expenses)}`],
      ["EBITDA Estimate", money(metrics.ebitda)],
      ["Net Profit", money(metrics.netProfit)],
      ["Gross Margin", `${metrics.grossMargin.toFixed(1)}%`],
      ["Net Margin", `${metrics.netMargin.toFixed(1)}%`],
    ],
    styles: tableStyles(),
    headStyles: tableHeadStyles(),
  });

  y = (doc as any).lastAutoTable.finalY + 16;
  subTitle(doc, "Profitability Commentary", y);
  paragraph(doc, profitability.summary, 14, y + 10);
  paragraph(doc, `Management note: ${profitability.recommendation}`, 14, y + 32);

  doc.addPage();
  sectionTitle(doc, "4. Cash Position & Runway", 20);

  autoTable(doc, {
    startY: 32,
    head: [["Cash Metric", "Value"]],
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
  subTitle(doc, "Liquidity Commentary", y);
  paragraph(doc, liquidity.summary, 14, y + 10);
  paragraph(doc, `Management note: ${liquidity.recommendation}`, 14, y + 32);

  doc.addPage();
  sectionTitle(doc, "5. Inventory & Operating Efficiency", 20);

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
  subTitle(doc, "Inventory Commentary", y);
  paragraph(doc, inventory.summary, 14, y + 10);
  paragraph(doc, `Management note: ${inventory.recommendation}`, 14, y + 32);

  doc.addPage();
  sectionTitle(doc, "6. Valuation & Investor Position", 20);

  autoTable(doc, {
    startY: 32,
    head: [["Valuation Metric", "Value"]],
    body: [
      ["Estimated Company Valuation", money(valuation.estimatedValuation)],
      ["Primary Valuation Method", valuation.method],
      ["Valuation Confidence", `${valuation.confidenceScore}/100`],
      ["Asset Floor Valuation", money(valuation.assetFloorValuation)],
      ["Revenue Multiple Valuation", money(valuation.revenueMultipleValuation)],
      ["Investment-Implied Valuation", money(valuation.investmentImpliedValuation)],
      ["Investor Equity Value", money(metrics.equityValue)],
      ["Investor ROI", `${metrics.roi.toFixed(1)}%`],
    ],
    styles: tableStyles(),
    headStyles: tableHeadStyles(),
  });

  y = (doc as any).lastAutoTable.finalY + 16;
  subTitle(doc, "Valuation Commentary", y);
  paragraph(doc, valuation.summary, 14, y + 10);
  paragraph(doc, `Management note: ${valuation.recommendation}`, 14, y + 34);

  doc.addPage();
  sectionTitle(doc, "7. Risks & Management Focus", 20);

  autoTable(doc, {
    startY: 34,
    head: [["Risk Area", "Assessment"]],
    body: [
      ["Liquidity Risk", liquidity.riskLevel],
      ["Profitability Risk", profitability.riskLevel],
      ["Inventory Risk", inventory.riskLevel],
      ["Business Health", `${health.total}/100 · ${health.label}`],
      ["Valuation Confidence", `${valuation.confidenceScore}/100`],
    ],
    styles: tableStyles(),
    headStyles: tableHeadStyles(),
  });

  y = (doc as any).lastAutoTable.finalY + 16;
  subTitle(doc, "Management Focus", y);
  paragraph(
    doc,
    buildManagementFocus({
      liquidityRisk: liquidity.riskLevel,
      profitabilityRisk: profitability.riskLevel,
      inventoryRisk: inventory.riskLevel,
      healthScore: health.total,
    }),
    14,
    y + 10
  );

  doc.addPage();
  sectionTitle(doc, "8. Next Quarter Roadmap", 20);

  autoTable(doc, {
    startY: 34,
    head: [["Priority", "Roadmap Item"]],
    body: buildRoadmap({
      metrics,
      healthScore: health.total,
      liquidityRisk: liquidity.riskLevel,
      inventoryRisk: inventory.riskLevel,
      profitabilityRisk: profitability.riskLevel,
    }),
    styles: tableStyles(),
    headStyles: tableHeadStyles(),
  });

  y = (doc as any).lastAutoTable.finalY + 18;
  subTitle(doc, "Closing Note", y);
  paragraph(
    doc,
    `This quarterly update was prepared through Helix Financial OS to provide investors with a transparent view of company performance, risks, valuation and management focus.`,
    14,
    y + 10
  );

  addFooters(doc, companyName);

  doc.save(`${slug(companyName)}-quarterly-investor-update-${slug(quarterLabel)}.pdf`);
}

function buildFounderLetter({
  investorName,
  companyName,
  founderName,
  quarterLabel,
  metrics,
  currency,
  healthLabel,
  valuationAmount,
}: {
  investorName: string;
  companyName: string;
  founderName: string;
  quarterLabel: string;
  metrics: FinancialMetrics;
  currency: string;
  healthLabel: string;
  valuationAmount: number;
}) {
  const money = (value: number | string | null | undefined) =>
    formatCurrency(value, currency);

  return `Dear ${investorName},

This quarterly update provides a clear view of ${companyName}'s operating and financial position for ${quarterLabel}. The company generated ${money(
    metrics.revenue
  )} in revenue, produced ${money(metrics.grossProfit)} in gross profit, and recorded ${money(
    metrics.netProfit
  )} in net profit based on the current Helix financial data.

The current business health rating is ${healthLabel}, with estimated company valuation of ${money(
    valuationAmount
  )}. This report highlights the key financial metrics, liquidity position, inventory performance, valuation model, risks and management priorities for the next quarter.

Thank you for your continued support.

${founderName}`;
}

function buildManagementFocus({
  liquidityRisk,
  profitabilityRisk,
  inventoryRisk,
  healthScore,
}: {
  liquidityRisk: string;
  profitabilityRisk: string;
  inventoryRisk: string;
  healthScore: number;
}) {
  const points: string[] = [];

  if (liquidityRisk !== "Low") {
    points.push("Liquidity should remain a management priority, especially before approving major cash outflows or investor withdrawals.");
  }

  if (profitabilityRisk !== "Low") {
    points.push("Profitability should be reviewed through pricing, supplier costs, operating expenses and product-level margins.");
  }

  if (inventoryRisk !== "Low") {
    points.push("Inventory efficiency should be monitored to avoid tying up working capital in slow-moving stock.");
  }

  if (healthScore < 70) {
    points.push("The company should focus on improving its overall business health score through stronger margins, cash discipline and operating consistency.");
  }

  if (!points.length) {
    points.push("The business currently appears stable based on available data. Management should continue monitoring margins, liquidity, growth and inventory discipline.");
  }

  return points.join(" ");
}

function buildRoadmap({
  metrics,
  healthScore,
  liquidityRisk,
  inventoryRisk,
  profitabilityRisk,
}: {
  metrics: FinancialMetrics;
  healthScore: number;
  liquidityRisk: string;
  inventoryRisk: string;
  profitabilityRisk: string;
}) {
  const rows: string[][] = [];

  rows.push(["Financial Reporting", "Continue producing monthly and quarterly investor-ready reports through Helix."]);

  if (profitabilityRisk !== "Low" || metrics.netMargin < 10) {
    rows.push(["Profitability", "Improve product margins, review pricing and control operating expense growth."]);
  } else {
    rows.push(["Profitability", "Maintain current margin discipline and monitor net margin trends."]);
  }

  if (liquidityRisk !== "Low") {
    rows.push(["Cash Flow", "Preserve cash, improve collections and avoid unnecessary capital outflows."]);
  } else {
    rows.push(["Cash Flow", "Maintain current liquidity discipline and keep cash ledger data accurate."]);
  }

  if (inventoryRisk !== "Low") {
    rows.push(["Inventory", "Reduce slow-moving stock and improve inventory turnover before increasing reorder volumes."]);
  } else {
    rows.push(["Inventory", "Continue monitoring stock velocity and reorder timing."]);
  }

  if (healthScore < 70) {
    rows.push(["Business Health", "Set quarterly improvement targets for profitability, liquidity and operating efficiency."]);
  } else {
    rows.push(["Business Health", "Maintain strong operating controls and continue improving reporting quality."]);
  }

  return rows;
}

function getQuarterLabel(date: Date) {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `Q${quarter} ${date.getFullYear()}`;
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