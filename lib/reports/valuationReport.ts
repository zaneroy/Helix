import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { FinancialMetrics } from "@/lib/finance/types";
import { formatCurrency } from "@/lib/currency/formatCurrency";

export function generateValuationReportPdf({
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
  doc.text("Company Valuation Report", 14, 38);

  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text(`Company: ${companyName}`, 14, 52);
  doc.text(`Prepared for: ${investorName}`, 14, 60);
  doc.text(`Founder: ${founderName}`, 14, 68);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 76);

  autoTable(doc, {
    startY: 92,
    head: [["Valuation Metric", "Value"]],
    body: [
      ["Estimated Company Valuation", money(metrics.companyValuation)],
      ["Investor Equity Value", money(metrics.equityValue)],
      ["Investor ROI", `${metrics.roi.toFixed(1)}%`],
      ["Revenue", money(metrics.revenue)],
      ["Net Profit", money(metrics.netProfit)],
      ["Inventory Value", money(metrics.inventoryValue)],
      ["Cash Balance", money(metrics.cashBalance)],
      ["Business Health Score", `${metrics.businessHealthScore}/100`],
    ],
  });

  const y = (doc as any).lastAutoTable.finalY + 14;

  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text("Valuation Interpretation", 14, y);

  doc.setFontSize(10);
  doc.setTextColor(70, 70, 70);
  doc.text(
    doc.splitTextToSize(
      `This valuation is generated from Helix financial data including revenue, profitability, inventory value, cash position, investor ownership and business health. It should be treated as an operating estimate, not a formal investment appraisal.`,
      180
    ),
    14,
    y + 10
  );

  doc.save(`company-valuation-report-${companyName}.pdf`);
}
