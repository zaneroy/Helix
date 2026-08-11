import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { FinancialMetrics } from "@/lib/finance/types";
import { formatCurrency } from "@/lib/currency/formatCurrency";

export function generateBusinessHealthReportPdf({
  investorName,
  companyName,
  founderName,
  metrics,
  currency = "USD",
}: {
  investorName: string;
  companyName: string;
  founderName: string;
  metrics: FinancialMetrics;
  currency?: string;
}) {
  const doc = new jsPDF();

  const money = (value: number | string | null | undefined) =>
    formatCurrency(value, currency);

  doc.setFontSize(11);
  doc.setTextColor(8, 47, 73);
  doc.text("HELIX FINANCIAL OS", 14, 18);

  doc.setFontSize(24);
  doc.setTextColor(0, 0, 0);
  doc.text("Business Health Report", 14, 38);

  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text(`Company: ${companyName}`, 14, 52);
  doc.text(`Prepared for: ${investorName}`, 14, 60);
  doc.text(`Founder: ${founderName}`, 14, 68);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 76);

  const score = metrics.businessHealthScore || 0;

  autoTable(doc, {
    startY: 92,
    head: [["Health Area", "Result"]],
    body: [
      ["Business Health Score", `${score}/100`],
      ["Revenue", money(metrics.revenue)],
      ["Gross Profit", money(metrics.grossProfit)],
      ["Net Profit", money(metrics.netProfit)],
      ["Gross Margin", `${metrics.grossMargin.toFixed(1)}%`],
      ["Net Margin", `${metrics.netMargin.toFixed(1)}%`],
      ["Cash Balance", money(metrics.cashBalance)],
      ["Burn Rate", money(metrics.burnRate)],
      [
        "Cash Runway",
        metrics.cashRunwayMonths === null
          ? "No current burn"
          : metrics.cashRunwayMonths >= 120
          ? "No immediate liquidity risk"
          : `${metrics.cashRunwayMonths.toFixed(1)} months`,
      ],
      ["Inventory Value", money(metrics.inventoryValue)],
      [
        "Inventory Turnover",
        metrics.inventoryTurnover === null
          ? "Not enough data"
          : `${metrics.inventoryTurnover.toFixed(2)}x`,
      ],
    ],
  });

  const y = (doc as any).lastAutoTable.finalY + 14;

  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text("Health Interpretation", 14, y);

  doc.setFontSize(10);
  doc.setTextColor(70, 70, 70);
  doc.text(doc.splitTextToSize(getHealthSummary(metrics), 180), 14, y + 10);

  doc.save(`business-health-report-${companyName}.pdf`);
}

function getHealthSummary(metrics: FinancialMetrics) {
  const score = metrics.businessHealthScore || 0;

  if (score >= 85) {
    return "The business is currently showing strong financial health. Profitability, liquidity and operating efficiency appear stable based on the available Helix data.";
  }

  if (score >= 70) {
    return "The business is performing reasonably well, but there are areas that should be monitored closely, including margins, cash runway, expenses or inventory efficiency.";
  }

  if (score >= 50) {
    return "The business has moderate financial risk. Management should review expenses, cash position, profitability and stock performance before making major commitments.";
  }

  return "The business is showing elevated financial risk. The founder should urgently review cash flow, profitability, operating expenses and inventory efficiency.";
}