"use client";

import { recordInvestorPortalDocumentDownload } from "@/lib/actions/investor-portal";
import type {
  InvestorPortalCertificate,
  InvestorPortalOffer,
  InvestorPortalReportData,
  UUID,
} from "@/types/investor-portal";

function safe(value: unknown): string {
  return String(value ?? "").trim() || "—";
}

function money(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `${currency} ${Number(value || 0).toFixed(2)}`;
  }
}

function percent(value: number): string {
  return `${Number(value || 0).toFixed(2).replace(/\.00$/, "")}%`;
}

function today(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function escapePdf(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
    .replace(/[^\x20-\x7E£]/g, "");
}

function binaryBlobPart(value: string): ArrayBuffer {
  const buffer = new ArrayBuffer(value.length);
  const output = new Uint8Array(buffer);

  for (let index = 0; index < value.length; index += 1) {
    output[index] = value.charCodeAt(index) & 0xff;
  }

  return buffer;
}

function textAt(commands: string[], value: string, x: number, y: number, size = 10, font = "F1") {
  commands.push(`BT /${font} ${size} Tf ${x} ${y} Td (${escapePdf(value)}) Tj ET`);
}

function line(commands: string[], x1: number, y1: number, x2: number, y2: number) {
  commands.push(`q 0.1 0.78 0.8 RG 0.8 w ${x1} ${y1} m ${x2} ${y2} l S Q`);
}

function paragraph(commands: string[], value: string, x: number, y: number, maxChars = 88): number {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);

  lines.forEach((item, index) => textAt(commands, item, x, y - index * 15, 10, "F1"));

  return y - lines.length * 15;
}

function table(commands: string[], rows: { label: string; value: string }[], x: number, y: number) {
  let currentY = y;

  rows.forEach((row) => {
    commands.push(`q 0.89 1 0.98 rg ${x} ${currentY - 23} 160 28 re f Q`);
    commands.push(`q 0.85 0.95 0.95 RG 0.4 w ${x} ${currentY - 23} 490 28 re S Q`);
    textAt(commands, row.label.toUpperCase(), x + 12, currentY - 6, 8, "F2");
    textAt(commands, row.value, x + 180, currentY - 7, 10, "F1");
    currentY -= 28;
  });

  return currentY;
}

function buildPdf(title: string, subtitle: string, rows: { label: string; value: string }[], body: string): string {
  const commands: string[] = [];

  textAt(commands, "HELIX", 42, 792, 20, "F2");
  textAt(commands, "Investor Portal Document", 430, 792, 9, "F1");
  textAt(commands, today(), 430, 777, 9, "F1");
  line(commands, 42, 762, 553, 762);

  textAt(commands, title, 42, 724, 21, "F2");
  textAt(commands, subtitle, 42, 700, 11, "F2");

  let y = paragraph(commands, body, 42, 664, 92);
  y -= 18;
  textAt(commands, "KEY DETAILS", 42, y, 10, "F2");
  line(commands, 42, y - 7, 96, y - 7);

  y = table(commands, rows, 42, y - 24);

  textAt(commands, "Important note", 42, y - 32, 10, "F2");
  paragraph(
    commands,
    "This document is generated from completed Helix investor records. It is intended as a transaction record and is not a substitute for independent legal, tax or financial advice.",
    42,
    y - 56,
    92,
  );

  line(commands, 42, 70, 553, 70);
  textAt(commands, "CONFIDENTIAL", 42, 50, 8, "F2");
  textAt(commands, "For the named investor and company only.", 42, 36, 8, "F1");
  textAt(commands, "1 of 1", 285, 43, 9, "F1");

  return commands.join("\n");
}

function downloadPdf(filename: string, stream: string) {
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj",
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >> endobj",
    `6 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer << /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefStart}\n%%EOF`;

  const blob = new Blob([binaryBlobPart(pdf)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function InvestorOfferPdfButton({
  companyId,
  companyName,
  currency,
  offer,
  type,
}: {
  companyId: UUID;
  companyName: string;
  currency: string;
  offer: InvestorPortalOffer;
  type: "offer_pdf" | "agreement_pdf";
}) {
  const isAgreement = type === "agreement_pdf";
  const label = isAgreement ? "Agreement PDF" : "Offer PDF";

  return (
    <button
      type="button"
      className="rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-2 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
      onClick={() => {
        const stream = buildPdf(
          isAgreement ? "Investment Agreement Summary" : "Equity Offer Letter",
          `${safe(companyName)} and ${safe(offer.investorName)}`,
          [
            { label: "Company legal name", value: companyName },
            { label: "Investor legal name", value: offer.investorName },
            { label: "Investment amount", value: money(offer.amount, currency) },
            { label: "Equity interest", value: percent(offer.equityPercent) },
            {
              label: "Money recipient",
              value: offer.moneyRecipient === "company" ? "Company" : "Founder/Admin",
            },
            {
              label: "Destination account",
              value:
                offer.moneyRecipient === "company"
                  ? offer.destinationAccountName || "Company account"
                  : "Not applicable",
            },
            { label: "Status", value: offer.status },
          ],
          isAgreement
            ? `This agreement summary records the key commercial terms agreed between ${companyName} and ${offer.investorName}. Ownership is based on completed offers only.`
            : `This offer letter summarises the terms on which ${companyName} offered an equity interest to ${offer.investorName}. No equity is transferred by this offer alone.`,
        );

        downloadPdf(
          `${isAgreement ? "investment-agreement" : "equity-offer"}-${offer.id.slice(0, 8)}.pdf`,
          stream,
        );

        void recordInvestorPortalDocumentDownload({
          documentType: type,
          documentLabel: label,
          offerId: offer.id,
        });
      }}
    >
      {label}
    </button>
  );
}

export function InvestorCertificatePdfButton({
  certificate,
  companyId,
  companyName,
  currency,
}: {
  certificate: InvestorPortalCertificate;
  companyId: UUID;
  companyName: string;
  currency: string;
}) {
  return (
    <button
      type="button"
      className="rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-2 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
      onClick={() => {
        const stream = buildPdf(
          "Ownership Certificate",
          `Issued by ${safe(companyName)} to ${safe(certificate.investorName)}`,
          [
            { label: "Certificate number", value: certificate.certificateNumber },
            { label: "Company legal name", value: companyName },
            { label: "Investor legal name", value: certificate.investorName },
            { label: "Equity ownership", value: percent(certificate.equityPercent) },
            { label: "Amount paid", value: money(certificate.amount, currency) },
            { label: "Issued", value: certificate.issuedAt || today() },
          ],
          `This certifies that ${certificate.investorName} is recorded by ${companyName} as holding the equity ownership percentage stated in this certificate.`,
        );

        downloadPdf(`ownership-certificate-${certificate.certificateNumber}.pdf`, stream);

        void recordInvestorPortalDocumentDownload({
          documentType: "certificate_pdf",
          documentLabel: "Certificate PDF",
          offerId: certificate.sourceOfferId,
        });
      }}
    >
      Certificate PDF
    </button>
  );
}

export function InvestorReportPdfButton({
  companyId,
  companyName,
  currency,
  report,
  type,
}: {
  companyId: UUID;
  companyName: string;
  currency: string;
  report: InvestorPortalReportData;
  type: "investor_report_pdf" | "profit_loss_pdf" | "cash_flow_pdf" | "inventory_pdf";
}) {
  const labelMap = {
    investor_report_pdf: "Investor Report PDF",
    profit_loss_pdf: "Profit & Loss PDF",
    cash_flow_pdf: "Cash Flow PDF",
    inventory_pdf: "Inventory Valuation PDF",
  };
  const label = labelMap[type];

  return (
    <button
      type="button"
      className="h-10 rounded-2xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-4 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
      onClick={() => {
        const stream = buildPdf(
          label,
          `${companyName} investor report`,
          [
            { label: "Revenue", value: money(report.revenue, currency) },
            { label: "Gross profit", value: money(report.grossProfit, currency) },
            { label: "Net profit", value: money(report.netProfit, currency) },
            { label: "Gross margin", value: percent(report.grossMarginPercent) },
            { label: "Net margin", value: percent(report.netMarginPercent) },
            { label: "Business health", value: `${report.businessHealthScore}/100` },
          ],
          `This report is generated from current Helix business data for ${companyName}.`,
        );

        downloadPdf(`${label.toLowerCase().replaceAll(" ", "-")}.pdf`, stream);

        void recordInvestorPortalDocumentDownload({
          documentType: type,
          documentLabel: label,
        });
      }}
    >
      Download PDF
    </button>
  );
}

export function SecureUploadedDocumentButton({
  documentId,
  documentLabel,
  downloadUrl,
}: {
  documentId: UUID;
  documentLabel: string;
  downloadUrl: string | null;
}) {
  return (
    <button
      type="button"
      disabled={!downloadUrl}
      className="h-10 rounded-2xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-4 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
      onClick={() => {
        void recordInvestorPortalDocumentDownload({
          documentType: "uploaded_document",
          documentLabel,
          documentId,
        });

        if (downloadUrl) {
          window.open(downloadUrl, "_blank", "noopener,noreferrer");
        }
      }}
    >
      Secure Download
    </button>
  );
}