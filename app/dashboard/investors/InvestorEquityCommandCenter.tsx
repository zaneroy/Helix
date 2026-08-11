"use client";

import {
  useMemo,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  cancelEquityOffer,
  completeEquityOffer,
  createEquityOffer,
  createFounderCapitalContribution,
  getInvestorEquityReadModel,
  previewEquityOffer,
  recordInvestorDocumentDownload,
  reviewInvestorCapitalRequest,
} from "@/lib/actions/investor-equity";
import type {
  AdminInvestorCapitalRequest,
  EquityDealType,
  EquityOffer,
  EquityOfferPreview,
  EquityTrendPoint,
  InvestorCapitalRequestStatus,
  InvestorEquityReadModel,
  UUID,
} from "@/types/investor-equity";

type BasicInvestor = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  access_status?: string | null;
};

type Props = {
  companyId: UUID;
  currency: string;
  initialData?: InvestorEquityReadModel | null;
  initialError?: string | null;
  investors?: BasicInvestor[];
};

type OfferDraft = {
  investorId: string;
  dealType: EquityDealType;
  destinationAccountId: string;
  amount: string;
  equityPercent: string;
  title: string;
  note: string;
};

type ContributionDraft = {
  amount: string;
  destinationAccountId: string;
  note: string;
};

function text(value: unknown, fallback = "—"): string {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown, currency: string): string {
  return numberValue(value).toLocaleString("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  });
}

function percent(value: unknown): string {
  return `${numberValue(value).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}%`;
}

function dateLabel(value: unknown): string {
  const raw = text(value, "");
  if (!raw) return "—";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function labelize(value: unknown): string {
  return text(value, "not set")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function firstInvestorId(model: InvestorEquityReadModel | null): string {
  return model?.investors[0]?.id ?? "";
}

function firstCashAccountId(model: InvestorEquityReadModel | null): string {
  return model?.cashAccounts.find((account) => account.status === "active")?.id ?? "";
}

function makeDraft(model: InvestorEquityReadModel | null): OfferDraft {
  return {
    investorId: firstInvestorId(model),
    dealType: "company_raise",
    destinationAccountId: firstCashAccountId(model),
    amount: "",
    equityPercent: "",
    title: "",
    note: "",
  };
}

function makeContributionDraft(model: InvestorEquityReadModel | null): ContributionDraft {
  return {
    amount: "",
    destinationAccountId: firstCashAccountId(model),
    note: "",
  };
}

function dealTypeTitle(type: EquityDealType): string {
  return type === "founder_sale"
    ? "Founder/Admin sells equity"
    : "Company raises investment";
}

function moneyRecipientLabel(type: EquityDealType): string {
  return type === "founder_sale" ? "Founder/Admin" : "Company";
}

type PdfColor = {
  r: number;
  g: number;
  b: number;
};

type PdfLineMap = Record<string, string>;

type PdfTermRow = {
  label: string;
  value: string;
};

const PDF = {
  width: 595,
  height: 842,
  teal: { r: 0, g: 0.43, b: 0.41 },
  tealSoft: { r: 0.93, g: 0.98, b: 0.97 },
  ink: { r: 0.08, g: 0.09, b: 0.1 },
  muted: { r: 0.36, g: 0.4, b: 0.46 },
  line: { r: 0.73, g: 0.83, b: 0.83 },
  pale: { r: 0.98, g: 0.99, b: 0.99 },
  white: { r: 1, g: 1, b: 1 },
};

function normalizePdfText(value: string): string {
  return value
    .replaceAll("£", String.fromCharCode(163))
    .replaceAll("’", "'")
    .replaceAll("‘", "'")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replace(/[^\x09\x0a\x0d\x20-\xff]/g, "");
}

function escapePdfText(value: string): string {
  return normalizePdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}

function binaryBlobPart(value: string): ArrayBuffer {
  const buffer = new ArrayBuffer(value.length);
  const output = new Uint8Array(buffer);

  for (let index = 0; index < value.length; index += 1) {
    output[index] = value.charCodeAt(index) & 0xff;
  }

  return buffer;
}

function colorFill(color: PdfColor): string {
  return `${color.r} ${color.g} ${color.b} rg`;
}

function colorStroke(color: PdfColor): string {
  return `${color.r} ${color.g} ${color.b} RG`;
}

function rect(
  commands: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  color: PdfColor,
): void {
  commands.push("q", colorFill(color), `${x} ${y} ${width} ${height} re f`, "Q");
}

function strokeRect(
  commands: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  color: PdfColor,
  lineWidth = 0.7,
): void {
  commands.push(
    "q",
    colorStroke(color),
    `${lineWidth} w`,
    `${x} ${y} ${width} ${height} re S`,
    "Q",
  );
}

function line(
  commands: string[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: PdfColor,
  width = 0.7,
): void {
  commands.push(
    "q",
    colorStroke(color),
    `${width} w`,
    `${x1} ${y1} m ${x2} ${y2} l S`,
    "Q",
  );
}

function textAt(
  commands: string[],
  value: string,
  x: number,
  y: number,
  size: number,
  font: "F1" | "F2" | "F3" = "F1",
  color: PdfColor = PDF.ink,
): void {
  commands.push(
    "BT",
    `/${font} ${size} Tf`,
    colorFill(color),
    `${x} ${y} Td`,
    `(${escapePdfText(value)}) Tj`,
    "ET",
  );
}

function splitWords(value: string, maxChars: number): string[] {
  const words = normalizePdfText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);

  return lines.length ? lines : [""];
}

function paragraph(
  commands: string[],
  value: string,
  x: number,
  y: number,
  maxChars: number,
  size = 10,
  leading = 14,
  color: PdfColor = PDF.ink,
): number {
  let nextY = y;

  for (const item of splitWords(value, maxChars)) {
    textAt(commands, item, x, nextY, size, "F1", color);
    nextY -= leading;
  }

  return nextY;
}

function parsePdfLines(lines: string[]): PdfLineMap {
  const map: PdfLineMap = {};

  for (const rawLine of lines) {
    const raw = String(rawLine ?? "").trim();
    const colon = raw.indexOf(":");

    if (raw.toLowerCase().startsWith("agreement for ")) {
      map.investor = raw.replace(/^agreement for\s+/i, "").trim();
      continue;
    }

    if (colon === -1) continue;

    const key = raw
      .slice(0, colon)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const value = raw.slice(colon + 1).trim();

    if (key) map[key] = value;
  }

  if (!map.destination_account && map.destination) {
    map.destination_account = map.destination;
  }

  return map;
}

function currentDocumentDate(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function compactDateId(): string {
  return new Date().toISOString().slice(0, 10).replaceAll("-", "");
}

function pdfCompanyName(data?: PdfLineMap): string {
  return data?.company || data?.company_name || data?.company_legal_name || "Your Company";
}

function recipientName(data: PdfLineMap, companyName: string): string {
  const recipient = data.money_recipient || data.funds_received_by || companyName;

  return recipient.toLowerCase() === "company" ? companyName : recipient;
}

function documentId(prefix: string, fallback?: string): string {
  return fallback || `${prefix}-${compactDateId()}-001`;
}

function drawHeader(
  commands: string[],
  companyName: string,
  documentLabel: string,
  documentNumber: string,
  date: string,
): void {
  textAt(commands, companyName, 42, 800, 13, "F2", PDF.ink);
  textAt(commands, "Private & Confidential", 42, 783, 9, "F1", PDF.muted);

  textAt(commands, `${documentLabel} No.`, 380, 800, 8, "F2", PDF.teal);
  textAt(commands, documentNumber, 380, 786, 8.5, "F1", PDF.ink);
  textAt(commands, "Date", 485, 800, 8, "F2", PDF.teal);
  textAt(commands, date, 485, 786, 8.5, "F1", PDF.ink);

  line(commands, 42, 766, 553, 766, PDF.teal, 1);
}

function drawFooter(commands: string[]): void {
  line(commands, 42, 52, 553, 52, PDF.line, 0.7);
  textAt(commands, "Private and confidential. Prepared for the named parties only.", 42, 34, 7.5, "F1", PDF.muted);
  textAt(commands, "Page 1 of 1", 500, 34, 7.5, "F1", PDF.muted);
}

function sectionTitle(commands: string[], label: string, x: number, y: number): void {
  textAt(commands, label.toUpperCase(), x, y, 8.5, "F2", PDF.teal);
  line(commands, x, y - 5, x + 24, y - 5, PDF.teal, 0.9);
}

function termsTable(
  commands: string[],
  rows: PdfTermRow[],
  x: number,
  y: number,
  width: number,
): number {
  const rowHeight = 25;
  const labelWidth = 165;
  const totalHeight = rows.length * rowHeight;

  strokeRect(commands, x, y - totalHeight, width, totalHeight, PDF.line, 0.7);

  for (let index = 0; index < rows.length; index += 1) {
    const rowTop = y - index * rowHeight;
    const rowBottom = rowTop - rowHeight;
    const row = rows[index];

    if (index % 2 === 0) {
      rect(commands, x, rowBottom, width, rowHeight, PDF.pale);
    }

    rect(commands, x, rowBottom, labelWidth, rowHeight, PDF.tealSoft);
    line(commands, x, rowBottom, x + width, rowBottom, PDF.line, 0.45);
    line(commands, x + labelWidth, rowBottom, x + labelWidth, rowTop, PDF.line, 0.45);

    textAt(commands, row.label.toUpperCase(), x + 12, rowBottom + 9, 7.6, "F2", PDF.teal);
    textAt(commands, row.value, x + labelWidth + 14, rowBottom + 8, 9.5, "F1", PDF.ink);
  }

  return y - totalHeight;
}

function signatureArea(
  commands: string[],
  companyName: string,
  investorName: string,
  y: number,
): void {
  sectionTitle(commands, "Execution", 42, y);
  textAt(commands, "Signed and agreed by the parties named below.", 42, y - 22, 9, "F1", PDF.ink);

  const leftX = 42;
  const rightX = 315;
  const top = y - 55;

  textAt(commands, `For ${companyName}`, leftX, top, 8, "F2", PDF.teal);
  line(commands, leftX, top - 25, leftX + 210, top - 25, PDF.ink, 0.7);
  textAt(commands, "Name:", leftX, top - 48, 8, "F1", PDF.ink);
  line(commands, leftX + 36, top - 46, leftX + 210, top - 46, PDF.line, 0.6);
  textAt(commands, "Title:", leftX, top - 65, 8, "F1", PDF.ink);
  line(commands, leftX + 36, top - 63, leftX + 210, top - 63, PDF.line, 0.6);
  textAt(commands, "Date:", leftX, top - 82, 8, "F1", PDF.ink);
  line(commands, leftX + 36, top - 80, leftX + 210, top - 80, PDF.line, 0.6);

  textAt(commands, `For ${investorName}`, rightX, top, 8, "F2", PDF.teal);
  line(commands, rightX, top - 25, rightX + 210, top - 25, PDF.ink, 0.7);
  textAt(commands, "Name:", rightX, top - 48, 8, "F1", PDF.ink);
  line(commands, rightX + 36, top - 46, rightX + 210, top - 46, PDF.line, 0.6);
  textAt(commands, "Title:", rightX, top - 65, 8, "F1", PDF.ink);
  line(commands, rightX + 36, top - 63, rightX + 210, top - 63, PDF.line, 0.6);
  textAt(commands, "Date:", rightX, top - 82, 8, "F1", PDF.ink);
  line(commands, rightX + 36, top - 80, rightX + 210, top - 80, PDF.line, 0.6);
}

function buildEquityOfferStream(data: PdfLineMap): string {
  const commands: string[] = [];
  const date = currentDocumentDate();
  const company = pdfCompanyName(data);
  const investor = data.investor || "Investor";
  const amount = data.amount || data.investment_amount || "—";
  const equity = data.equity_offered || data.equity || "—";
  const recipient = recipientName(data, company);
  const destination = data.destination_account || data.company_account || "Not applicable";
  const status = data.status || "Pending";

  drawHeader(commands, company, "Offer", documentId("EO"), date);

  textAt(commands, "Equity Offer Letter", 42, 724, 19, "F2", PDF.ink);
  textAt(commands, `To: ${investor}`, 42, 692, 10, "F1", PDF.ink);
  textAt(commands, `From: ${company}`, 42, 676, 10, "F1", PDF.ink);
  textAt(commands, `Re: Proposed equity investment in ${company}`, 42, 654, 10, "F2", PDF.ink);

  let y = paragraph(
    commands,
    `Dear ${investor}, this letter summarises the commercial terms on which ${company} is prepared to offer an equity interest to ${investor}. The offer remains subject to acceptance, cleared payment and completion in the company's records.`,
    42,
    622,
    94,
    9.3,
    13,
  );

  y -= 12;
  sectionTitle(commands, "Offer terms", 42, y);
  const tableBottom = termsTable(
    commands,
    [
      { label: "Company legal name", value: company },
      { label: "Investor legal name", value: investor },
      { label: "Investment amount", value: amount },
      { label: "Equity interest offered", value: equity },
      { label: "Funds received by", value: recipient },
      { label: "Destination account", value: destination },
      { label: "Offer status", value: status },
    ],
    42,
    y - 22,
    511,
  );

  sectionTitle(commands, "Conditions to completion", 42, tableBottom - 24);
  const conditionY = paragraph(
    commands,
    `No equity is transferred by this offer letter alone. Equity is recorded only after the offer is accepted, payment is received in the agreed destination, and the offer is marked complete by ${company}. Pending or cancelled offers do not change ownership.`,
    42,
    tableBottom - 50,
    94,
    9.0,
    12.5,
  );

  sectionTitle(commands, "Acceptance", 42, conditionY - 16);
  const acceptanceY = paragraph(
    commands,
    `${investor} should review the terms carefully and obtain independent legal, tax or financial advice where required. By signing, the parties confirm that the details above reflect the commercial terms agreed for this transaction.`,
    42,
    conditionY - 42,
    94,
    9.0,
    12.5,
  );

  signatureArea(commands, `For ${company}`, `For ${investor}`, acceptanceY - 28);
  drawFooter(commands);

  return commands.join("\n");
}

function buildAgreementStream(data: PdfLineMap): string {
  const commands: string[] = [];
  const date = currentDocumentDate();
  const company = pdfCompanyName(data);
  const investor = data.investor || "Investor";
  const amount = data.amount || "—";
  const equity = data.equity || data.equity_offered || "—";
  const dealType = data.deal_type || "Company raises investment";

  drawHeader(commands, company, "Agreement", documentId("IA"), date);

  textAt(commands, "Investment Agreement Summary", 42, 724, 19, "F2", PDF.ink);
  textAt(commands, `Parties: ${company} (Company) and ${investor} (Investor)`, 42, 696, 10, "F1", PDF.ink);
  textAt(commands, `Transaction: ${dealType}`, 42, 678, 10, "F2", PDF.ink);

  let y = paragraph(
    commands,
    `This agreement summary records the key commercial terms agreed between ${company} and ${investor}. It is generated from the Helix investor records for this transaction and should be reviewed by the parties before signature.`,
    42,
    646,
    94,
    9.3,
    13,
  );

  y -= 12;
  sectionTitle(commands, "Key terms", 42, y);
  const tableBottom = termsTable(
    commands,
    [
      { label: "Company legal name", value: company },
      { label: "Investor legal name", value: investor },
      { label: "Deal type", value: dealType },
      { label: "Investment amount", value: amount },
      { label: "Equity interest", value: equity },
      { label: "Agreement date", value: date },
    ],
    42,
    y - 22,
    511,
  );

  sectionTitle(commands, "Completion and ownership", 42, tableBottom - 24);
  const termsY = paragraph(
    commands,
    `Subject to cleared payment and completion, ${investor} will be recorded as holding ${equity} equity ownership in ${company}. Ownership is based on completed offers only. Pending, cancelled or unpaid offers do not change ownership records.`,
    42,
    tableBottom - 50,
    94,
    9.0,
    12.5,
  );

  sectionTitle(commands, "Records and documents", 42, termsY - 16);
  const recordY = paragraph(
    commands,
    `The parties agree that ${company}'s investor records, offer documents, agreement documents and ownership certificate should be retained together as the transaction record. This document is not a substitute for jurisdiction-specific legal advice.`,
    42,
    termsY - 42,
    94,
    9.0,
    12.5,
  );

  signatureArea(commands, `For ${company}`, `For ${investor}`, recordY - 28);
  drawFooter(commands);

  return commands.join("\n");
}

function buildCertificateStream(data: PdfLineMap): string {
  const commands: string[] = [];
  const company = pdfCompanyName(data);
  const issued = data.issued || currentDocumentDate();
  const certificateNumber = data.certificate || documentId("CERT");
  const investor = data.investor || "Investor";
  const equity = data.equity_owned || data.equity || "—";
  const amount = data.amount_paid || data.amount || "—";

  drawHeader(commands, company, "Certificate", certificateNumber, issued);

  textAt(commands, "Ownership Certificate", 42, 724, 20, "F2", PDF.ink);
  textAt(commands, `Issued by ${company} to ${investor}`, 42, 696, 10, "F1", PDF.ink);

  strokeRect(commands, 42, 338, 511, 292, PDF.teal, 1);
  textAt(commands, "Certificate of Equity Ownership", 70, 588, 18, "F2", PDF.ink);
  paragraph(
    commands,
    `This certifies that ${investor} is recorded by ${company} as holding the equity ownership percentage stated below, following completion of the approved equity transaction and receipt or confirmation of the agreed payment.`,
    70,
    552,
    78,
    10.2,
    15,
  );

  termsTable(
    commands,
    [
      { label: "Certificate number", value: certificateNumber },
      { label: "Company legal name", value: company },
      { label: "Investor legal name", value: investor },
      { label: "Equity ownership", value: equity },
      { label: "Amount paid", value: amount },
      { label: "Issue date", value: issued },
    ],
    70,
    470,
    455,
  );

  paragraph(
    commands,
    `This certificate is an ownership record generated from completed Helix investor records. It should be kept with the offer letter and agreement summary for the same transaction.`,
    70,
    312,
    78,
    8.5,
    12,
    PDF.muted,
  );

  line(commands, 70, 240, 250, 240, PDF.ink, 0.7);
  textAt(commands, `Authorized signatory for ${company}`, 70, 222, 8, "F1", PDF.muted);

  line(commands, 330, 240, 510, 240, PDF.ink, 0.7);
  textAt(commands, `Acknowledged by ${investor}`, 330, 222, 8, "F1", PDF.muted);

  drawFooter(commands);

  return commands.join("\n");
}

function downloadPdf(filename: string, stream: string): void {
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj",
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >> endobj",
    "6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >> endobj",
    `7 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
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

function makePdf(title: string, lines: string[]): void {
  const data = parsePdfLines(lines);
  const lowerTitle = title.toLowerCase();
  let stream = "";
  let filename = "";

  if (lowerTitle.includes("certificate")) {
    stream = buildCertificateStream(data);
    filename = `ownership-certificate-${compactDateId()}.pdf`;
  } else if (lowerTitle.includes("agreement")) {
    stream = buildAgreementStream(data);
    filename = `investment-agreement-${compactDateId()}.pdf`;
  } else {
    stream = buildEquityOfferStream(data);
    filename = `equity-offer-letter-${compactDateId()}.pdf`;
  }

  downloadPdf(filename, stream);
}


function trackDocumentDownload(input: {
  companyId: UUID;
  offerId?: string | null;
  investorId?: string | null;
  documentType: "offer_pdf" | "agreement_pdf" | "certificate_pdf";
  documentLabel: string;
}): void {
  void recordInvestorDocumentDownload({
    companyId: input.companyId,
    offerId: input.offerId || null,
    investorId: input.investorId || null,
    documentType: input.documentType,
    documentLabel: input.documentLabel,
  });
}

export default function InvestorEquityCommandCenter({
  companyId,
  currency,
  initialData = null,
  initialError = null,
}: Props) {
  const [model, setModel] = useState<InvestorEquityReadModel | null>(initialData);
  const [draft, setDraft] = useState<OfferDraft>(() => makeDraft(initialData));
  const [contributionDraft, setContributionDraft] = useState<ContributionDraft>(() =>
    makeContributionDraft(initialData),
  );
  const [preview, setPreview] = useState<EquityOfferPreview | null>(null);
  const [message, setMessage] = useState(initialError || "");
  const [messageTone, setMessageTone] = useState<"good" | "bad" | "neutral">(
    initialError ? "bad" : "neutral",
  );
  const [offerFilter, setOfferFilter] = useState<"all" | "pending" | "completed" | "cancelled">("all");
  const [isPending, startTransition] = useTransition();

  const investorOptions = model?.investors ?? [];
  const cashAccounts = model?.cashAccounts ?? [];
  const activeCashAccounts = cashAccounts.filter((account) => account.status === "active");
  const selectedInvestor = useMemo(
    () => investorOptions.find((investor) => investor.id === draft.investorId),
    [draft.investorId, investorOptions],
  );

  const selectedAccount = useMemo(
    () => activeCashAccounts.find((account) => account.id === draft.destinationAccountId),
    [activeCashAccounts, draft.destinationAccountId],
  );

  const canCreateDraft =
    !!draft.investorId &&
    numberValue(draft.amount) > 0 &&
    numberValue(draft.equityPercent) > 0 &&
    (draft.dealType === "founder_sale" || !!draft.destinationAccountId);

  const filteredOffers = useMemo(() => {
    const offers = model?.offers ?? [];

    if (offerFilter === "all") return offers;
    if (offerFilter === "pending") {
      return offers.filter((offer) =>
        ["draft", "pending", "sent", "accepted", "payment_received"].includes(offer.status),
      );
    }

    return offers.filter((offer) => offer.status === offerFilter);
  }, [model?.offers, offerFilter]);

  function updateDraft<K extends keyof OfferDraft>(
    key: K,
    value: OfferDraft[K],
  ): void {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
    setPreview(null);
  }

  function updateContributionDraft<K extends keyof ContributionDraft>(
    key: K,
    value: ContributionDraft[K],
  ): void {
    setContributionDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function refresh(): void {
    startTransition(() => {
      void (async () => {
        setMessage("Refreshing investors...");
        setMessageTone("neutral");

        const result = await getInvestorEquityReadModel(companyId, currency);

        if (!result.ok || !result.data) {
          setMessage(result.error || "Could not refresh investors.");
          setMessageTone("bad");
          return;
        }

        setModel(result.data);
        setDraft((current) => ({
          ...current,
          investorId: current.investorId || firstInvestorId(result.data || null),
          destinationAccountId:
            current.destinationAccountId || firstCashAccountId(result.data || null),
        }));
        setContributionDraft((current) => ({
          ...current,
          destinationAccountId:
            current.destinationAccountId || firstCashAccountId(result.data || null),
        }));
        setPreview(null);
        setMessage("Investors refreshed.");
        setMessageTone("good");
      })();
    });
  }

  function handlePreview(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (!canCreateDraft) {
      setMessage(
        draft.dealType === "company_raise"
          ? "Choose an investor, amount, equity percentage and destination company account first."
          : "Choose an investor, amount and equity percentage first.",
      );
      setMessageTone("bad");
      return;
    }

    startTransition(() => {
      void (async () => {
        setMessage("Calculating ownership preview...");
        setMessageTone("neutral");

        const result = await previewEquityOffer({
          companyId,
          investorId: draft.investorId,
          dealType: draft.dealType,
          destinationAccountId:
            draft.dealType === "company_raise" ? draft.destinationAccountId : null,
          amount: draft.amount,
          equityPercent: draft.equityPercent,
          currency,
          title: draft.title || null,
          note: draft.note || null,
        });

        if (!result.ok || !result.data) {
          setMessage(result.error || "Could not preview this offer.");
          setMessageTone("bad");
          return;
        }

        setPreview(result.data);
        setMessage(
          result.data.blockingReasons.length
            ? "Preview ready, but this offer is blocked."
            : "Ownership preview ready.",
        );
        setMessageTone(result.data.blockingReasons.length ? "bad" : "good");
      })();
    });
  }

  function handleCreateOffer(): void {
    if (!preview || preview.blockingReasons.length) {
      setMessage("Preview a valid offer before creating it.");
      setMessageTone("bad");
      return;
    }

    startTransition(() => {
      void (async () => {
        setMessage("Creating offer and PDF documents...");
        setMessageTone("neutral");

        const result = await createEquityOffer({
          companyId,
          investorId: draft.investorId,
          dealType: draft.dealType,
          destinationAccountId:
            draft.dealType === "company_raise" ? draft.destinationAccountId : null,
          amount: draft.amount,
          equityPercent: draft.equityPercent,
          currency,
          title: draft.title || null,
          note: draft.note || null,
        });

        if (!result.ok) {
          setMessage(result.error || "Could not create offer.");
          setMessageTone("bad");
          return;
        }

        setMessage("Offer created. It will not change ownership until it is marked paid/complete.");
        setMessageTone("good");
        setDraft(makeDraft(model));
        setPreview(null);
        refresh();
      })();
    });
  }

  function handleCompleteOffer(offerId: string): void {
    startTransition(() => {
      void (async () => {
        setMessage("Completing offer and updating ownership...");
        setMessageTone("neutral");

        const result = await completeEquityOffer({
          companyId,
          offerId,
        });

        if (!result.ok) {
          setMessage(result.error || "Could not complete this offer.");
          setMessageTone("bad");
          return;
        }

        setMessage("Offer completed. Ownership and company accounts have been updated.");
        setMessageTone("good");
        refresh();
      })();
    });
  }

  function handleCancelOffer(offerId: string): void {
    startTransition(() => {
      void (async () => {
        setMessage("Cancelling offer...");
        setMessageTone("neutral");

        const result = await cancelEquityOffer({
          companyId,
          offerId,
        });

        if (!result.ok) {
          setMessage(result.error || "Could not cancel this offer.");
          setMessageTone("bad");
          return;
        }

        setMessage("Offer cancelled.");
        setMessageTone("good");
        refresh();
      })();
    });
  }

  function handleFounderContribution(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (!contributionDraft.destinationAccountId || numberValue(contributionDraft.amount) <= 0) {
      setMessage("Choose an account and enter the founder/admin contribution amount.");
      setMessageTone("bad");
      return;
    }

    startTransition(() => {
      void (async () => {
        setMessage("Recording founder/admin capital...");
        setMessageTone("neutral");

        const result = await createFounderCapitalContribution({
          companyId,
          amount: contributionDraft.amount,
          destinationAccountId: contributionDraft.destinationAccountId,
          currency,
          note: contributionDraft.note || null,
        });

        if (!result.ok) {
          setMessage(result.error || "Could not record founder/admin capital.");
          setMessageTone("bad");
          return;
        }

        setMessage("Founder/Admin capital recorded in the selected company account.");
        setMessageTone("good");
        setContributionDraft(makeContributionDraft(model));
        refresh();
      })();
    });
  }

  function handleReviewCapitalRequest(
    requestId: string,
    status: InvestorCapitalRequestStatus,
  ): void {
    startTransition(() => {
      void (async () => {
        setMessage("Updating investor capital request...");
        setMessageTone("neutral");

        const result = await reviewInvestorCapitalRequest({
          companyId,
          requestId,
          status,
        });

        if (!result.ok) {
          setMessage(result.error || "Could not update this capital request.");
          setMessageTone("bad");
          return;
        }

        setMessage(`Capital request marked ${status.replaceAll("_", " ")}.`);
        setMessageTone("good");
        refresh();
      })();
    });
  }

  if (!model) {
    return (
      <section className="rounded-3xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] p-6 text-[color:var(--danger)]">
        {initialError || "Investor data could not be loaded."}
      </section>
    );
  }

  const selectedInvestorName =
    selectedInvestor?.full_name || selectedInvestor?.email || "Investor";

  return (
    <section className="min-w-0 space-y-4">
      {message && <Message tone={messageTone}>{message}</Message>}

      <DashboardHeader
        model={model}
        onRefresh={refresh}
        isPending={isPending}
      />

      <SummaryGrid model={model} currency={currency} />

      <InfoStrip />

      <CapitalRequestsPanel
        currency={currency}
        isPending={isPending}
        onReview={handleReviewCapitalRequest}
        requests={model.capitalRequests ?? []}
      />

      <div className="grid gap-4 2xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4">
          <OwnershipTable owners={model.owners} currency={currency} />
          <CompanyLinkedAccounts
            accounts={model.cashAccounts}
            currency={currency}
            draft={contributionDraft}
            isPending={isPending}
            updateDraft={updateContributionDraft}
            onSubmit={handleFounderContribution}
          />
        </div>

        <div className="space-y-4">
          <ActionsWorkflow />
          <CreateInvestorOffer
            draft={draft}
            updateDraft={updateDraft}
            investors={investorOptions}
            cashAccounts={activeCashAccounts}
            selectedAccount={selectedAccount}
            selectedInvestorName={selectedInvestorName}
            currency={currency}
            preview={preview}
            canCreateDraft={canCreateDraft}
            isPending={isPending}
            onPreview={handlePreview}
            onCreateOffer={handleCreateOffer}
          />
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1fr_1fr]">
        <OffersPanel
          companyId={companyId}
          offers={filteredOffers}
          allOffers={model.offers}
          offerFilter={offerFilter}
          setOfferFilter={setOfferFilter}
          companyName={model.companyName}
          currency={currency}
          isPending={isPending}
          onCompleteOffer={handleCompleteOffer}
          onCancelOffer={handleCancelOffer}
        />
        <DocumentsPanel
          companyId={companyId}
          offers={model.offers}
          certificates={model.certificates}
          companyName={model.companyName}
          currency={currency}
        />
      </div>

      <p className="flex items-center gap-2 text-xs text-[color:var(--text-tertiary)]">
        <span className="grid h-5 w-5 place-items-center rounded-full border border-[color:var(--border-brand)] text-[color:var(--primary)]">
          i
        </span>
        Equity calculations reflect completed offers only. Pending offers do not impact current ownership.
      </p>

      {!!model.warnings.length && (
        <div className="rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] p-4 text-sm leading-6 text-[color:var(--warning)]">
          {model.warnings.join(" ")}
        </div>
      )}
    </section>
  );
}

function CapitalRequestsPanel({
  currency,
  isPending,
  onReview,
  requests,
}: {
  currency: string;
  isPending: boolean;
  onReview: (requestId: string, status: InvestorCapitalRequestStatus) => void;
  requests: AdminInvestorCapitalRequest[];
}) {
  const active = requests.filter((request) => ["pending", "approved"].includes(request.status));
  const completed = requests.filter((request) => request.status === "completed");
  const rejected = requests.filter((request) => ["rejected", "cancelled"].includes(request.status));

  return (
    <section className="rounded-[1.5rem] border border-[color:var(--border-brand)] bg-[color:var(--app-bg)] p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="cyan">{active.length} active requests</Badge>
            <Badge tone="green">{completed.length} completed</Badge>
            <Badge tone="slate">{rejected.length} closed</Badge>
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
            Investor capital requests
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-[color:var(--text-secondary)]">
            Review capital-in and withdrawal requests submitted from the investor portal.
            Approving or rejecting a request sends investor notifications and records activity.
          </p>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-[color:var(--border)]">
        <div className="grid min-w-[980px] grid-cols-[1.05fr_0.85fr_0.85fr_0.75fr_0.9fr_1.4fr] bg-[color:var(--primary-soft)] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-tertiary)]">
          <span>Investor</span>
          <span>Type</span>
          <span>Amount</span>
          <span>Status</span>
          <span>Date</span>
          <span>Actions / Notes</span>
        </div>

        {requests.map((request) => (
          <div
            key={request.id}
            className="grid min-w-[980px] grid-cols-[1.05fr_0.85fr_0.85fr_0.75fr_0.9fr_1.4fr] items-center border-t border-[color:var(--border)] px-4 py-4 text-sm text-[color:var(--text-secondary)]"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-[color:var(--text-primary)]">{request.investorName}</p>
              <p className="mt-1 truncate text-xs text-[color:var(--text-tertiary)]">{request.investorEmail || request.investorId}</p>
            </div>
            <span>{request.requestType === "withdrawal_request" ? "Withdrawal" : "Capital In"}</span>
            <span>{money(request.amount, request.currency || currency)}</span>
            <StatusBadge status={request.status} />
            <span className="text-[color:var(--text-tertiary)]">{dateLabel(request.createdAt)}</span>
            <div className="min-w-0">
              <p className="mb-3 truncate text-xs text-[color:var(--text-tertiary)]">
                {request.notes || request.adminNote || "No notes added."}
              </p>
              <div className="flex flex-wrap gap-2">
                {request.status === "pending" && (
                  <>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => onReview(request.id, "approved")}
                      className="rounded-xl border border-[color:var(--success-border)] bg-[color:var(--success-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--success)] transition hover:bg-[color:var(--success-soft)] disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => onReview(request.id, "rejected")}
                      className="rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--danger)] transition hover:bg-[color:var(--danger-soft)] disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </>
                )}

                {request.status === "approved" && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => onReview(request.id, "completed")}
                    className="rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--primary)] transition hover:bg-[color:var(--primary-soft)] disabled:opacity-60"
                  >
                    Mark completed
                  </button>
                )}

                {["pending", "approved"].includes(request.status) && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => onReview(request.id, "cancelled")}
                    className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-soft)] disabled:opacity-60"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {!requests.length && (
          <div className="border-t border-[color:var(--border)] p-6">
            <EmptyState text="No investor capital requests have been submitted yet." />
          </div>
        )}
      </div>
    </section>
  );
}

function DashboardHeader({
  isPending,
  model,
  onRefresh,
}: {
  isPending: boolean;
  model: InvestorEquityReadModel;
  onRefresh: () => void;
}) {
  return (
    <section className="rounded-[1.5rem] border border-[color:var(--border-brand)] bg-[color:var(--app-bg)] p-5 md:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="cyan">{model.summary.completedInvestorCount} investors</Badge>
            <Badge tone="green">{percent(model.summary.investorEquityPercent)} investor equity</Badge>
            <Badge tone="slate">{model.summary.pendingOfferCount} pending offers</Badge>
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)] md:text-5xl">
            Investors
          </h1>
          <p className="mt-3 max-w-5xl text-sm leading-6 text-[color:var(--text-secondary)]">
            Simple flow: record founder capital, create equity offers, complete payment,
            and issue investor documents.
          </p>
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={onRefresh}
          className="h-10 w-fit self-start rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-sm font-semibold text-[color:var(--text-primary)] transition hover:bg-[color:var(--surface-soft)] disabled:opacity-60 xl:self-auto"
        >
          Refresh
        </button>
      </div>
    </section>
  );
}

function SummaryGrid({
  currency,
  model,
}: {
  currency: string;
  model: InvestorEquityReadModel;
}) {
  const { summary } = model;
  const trends = model.trends || {
    companyValue: [],
    companyCash: [],
    companySales: [],
    companyCapitalRaised: [],
  };
  const capitalRaisedProgress =
    summary.estimatedCompanyValue > 0
      ? (summary.companyCapitalRaised / summary.estimatedCompanyValue) * 100
      : 0;

  const metrics: {
    label: string;
    value: string;
    caption: string;
    chart: "line" | "bars" | "bar" | "progress";
    trend?: EquityTrendPoint[];
    progress?: number;
  }[] = [
    {
      label: "Company value",
      value: money(summary.estimatedCompanyValue, currency),
      caption: summary.impliedPostMoneyValuation > 0
        ? "Source: latest completed offer"
        : "Source: capital/cash estimate",
      chart: "line",
      trend: trends.companyValue,
    },
    {
      label: "Company cash",
      value: money(summary.companyCash, currency),
      caption: "Available cash balance",
      chart: "line",
      trend: trends.companyCash,
    },
    {
      label: "Company sales",
      value: money(summary.companySales, currency),
      caption: "Linked from Accounts",
      chart: "bars",
      trend: trends.companySales,
    },
    {
      label: "Company capital raised",
      value: money(summary.companyCapitalRaised, currency),
      caption: "Investor money into company",
      chart: "bars",
      trend: trends.companyCapitalRaised,
    },
    {
      label: "Founder/Admin equity",
      value: percent(summary.founderEquityPercent),
      caption: "Current ownership",
      chart: "progress",
      progress: summary.founderEquityPercent,
    },
    {
      label: "Investor equity",
      value: percent(summary.investorEquityPercent),
      caption: "Current ownership",
      chart: "progress",
      progress: summary.investorEquityPercent,
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {metrics.map((metric) => (
        <MetricCard
          key={metric.label}
          {...metric}
          progress={metric.label === "Company capital raised" ? capitalRaisedProgress : metric.progress}
        />
      ))}
    </div>
  );
}

function MetricCard({
  caption,
  chart,
  label,
  progress = 0,
  trend = [],
  value,
}: {
  caption: string;
  chart: "line" | "bars" | "bar" | "progress";
  label: string;
  progress?: number;
  trend?: EquityTrendPoint[];
  value: string;
}) {
  return (
    <section className="rounded-[1.25rem] border border-[color:var(--border-brand)] bg-[color:var(--surface)] p-4 shadow-[var(--glow-brand)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[color:var(--text-secondary)]">{label}</p>
          <p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
            {value}
          </p>
          <p className="mt-2 text-xs text-[color:var(--text-tertiary)]">{caption}</p>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-full border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-xs font-semibold text-[color:var(--primary)]">
          {label.includes("equity") ? "%" : label.includes("cash") || label.includes("value") || label.includes("capital") ? "£" : "↗"}
        </span>
      </div>

      <MiniVisual type={chart} progress={progress} trend={trend} />
    </section>
  );
}

function hasTrendData(trend: EquityTrendPoint[]): boolean {
  return trend.some((point) => numberValue(point.value) !== 0);
}

function trendValues(trend: EquityTrendPoint[]): number[] {
  return trend.map((point) => numberValue(point.value));
}

function maxNumber(values: number[], fallback = 1): number {
  return values.reduce((max, value) => (value > max ? value : max), fallback);
}

function minNumber(values: number[], fallback = 0): number {
  return values.reduce((min, value) => (value < min ? value : min), fallback);
}

function normalizeTrendHeight(value: number, values: number[]): number {
  const max = maxNumber(values.map((item) => Math.abs(item)), 1);
  const height = (Math.abs(value) / max) * 100;

  return Math.max(height, value === 0 ? 4 : 8);
}

function buildLinePath(trend: EquityTrendPoint[]): { line: string; area: string } {
  const values = trendValues(trend);
  const max = maxNumber(values, 1);
  const min = minNumber(values, 0);
  const range = Math.max(max - min, 1);
  const width = 160;
  const height = 40;
  const xStep = trend.length > 1 ? width / (trend.length - 1) : width;
  const points = values.map((value, index) => {
    const x = Math.round(index * xStep * 100) / 100;
    const y = Math.round((height - 4 - ((value - min) / range) * 30) * 100) / 100;

    return `${x},${y}`;
  });
  const line = points.join(" ");
  const first = points[0] || "0,36";
  const last = points[points.length - 1] || "160,36";
  const firstX = first.split(",")[0] || "0";
  const lastX = last.split(",")[0] || "160";
  const area = `${first} ${line ? points.slice(1).join(" ") : ""} ${lastX},40 ${firstX},40`;

  return { line, area };
}

function MiniVisual({
  progress,
  trend = [],
  type,
}: {
  progress: number;
  trend?: EquityTrendPoint[];
  type: "line" | "bars" | "bar" | "progress";
}) {
  if (type === "progress" || type === "bar") {
    return (
      <div className="mt-5 h-2 rounded-full bg-[color:var(--surface-muted)]">
        <div
          className="h-full rounded-full bg-[color:var(--primary)]"
          style={{ width: `${Math.max(Math.min(progress, 100), progress > 0 ? 5 : 0)}%` }}
        />
      </div>
    );
  }

  if (!trend.length || !hasTrendData(trend)) {
    return (
      <div className="mt-4 flex h-10 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-tertiary)]">
        No trend yet
      </div>
    );
  }

  if (type === "bars") {
    const values = trendValues(trend);

    return (
      <div className="mt-4 flex h-10 items-end gap-1.5">
        {trend.map((point, index) => (
          <span
            key={point.key}
            className="w-full rounded-t-sm bg-[color:var(--primary)]"
            style={{ height: `${normalizeTrendHeight(values[index] ?? 0, values)}%` }}
            aria-label={`${point.label}: ${point.value}`}
          />
        ))}
      </div>
    );
  }

  const path = buildLinePath(trend);

  return (
    <svg className="mt-4 h-10 w-full overflow-visible" viewBox="0 0 160 40" aria-hidden="true">
      <polyline
        points={path.line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-[color:var(--primary)]"
      />
      <polygon
        points={path.area}
        className="fill-[color:var(--primary)]"
      />
    </svg>
  );
}

function InfoStrip() {
  return (
    <div className="grid gap-3 text-xs text-[color:var(--text-secondary)] md:grid-cols-2">
      <InfoText>Cash and sales are linked from Accounts.</InfoText>
      <InfoText>Company capital raised updates when the company receives investor funds.</InfoText>
    </div>
  );
}

function InfoText({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2">
      <span className="grid h-5 w-5 place-items-center rounded-full border border-[color:var(--border-brand)] text-[color:var(--primary)]">
        i
      </span>
      {children}
    </p>
  );
}

function OwnershipTable({
  currency,
  owners,
}: {
  currency: string;
  owners: InvestorEquityReadModel["owners"];
}) {
  const totals = owners.reduce(
    (acc, owner) => ({
      equity: acc.equity + owner.equityPercent,
      capital: acc.capital + owner.capitalContributed,
      founderPurchase: acc.founderPurchase + owner.founderPurchaseAmount,
      invested: acc.invested + owner.totalInvested,
    }),
    { equity: 0, capital: 0, founderPurchase: 0, invested: 0 },
  );

  return (
    <section className="rounded-[1.5rem] border border-[color:var(--border-brand)] bg-[color:var(--surface)] p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <SectionTitle
          eyebrow="Ownership"
          title="Ownership table"
          subtitle="Current ownership, capital and documents."
        />
        <button
          type="button"
          className="h-10 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-xs font-semibold text-[color:var(--text-primary)] transition hover:bg-[color:var(--surface-soft)]"
        >
          Export CSV
        </button>
      </div>

      <p className="mt-3 flex items-center gap-2 text-xs text-[color:var(--text-tertiary)]">
        <span className="grid h-5 w-5 place-items-center rounded-full border border-[color:var(--border-brand)] text-[color:var(--primary)]">
          ✓
        </span>
        Ownership is based on completed offers only.
      </p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[color:var(--border)]">
        <div className="grid min-w-[820px] grid-cols-[1.35fr_0.7fr_0.6fr_0.95fr_1fr_1.2fr] border-b border-[color:var(--border)] bg-[color:var(--primary-soft)] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">
          <span>Holder</span>
          <span>Role</span>
          <span>Equity %</span>
          <span>Capital contributed</span>
          <span>Founder purchase amount</span>
          <span>Documents</span>
        </div>

        {owners.map((owner) => (
          <div
            key={owner.id}
            className="grid min-w-[820px] grid-cols-[1.35fr_0.7fr_0.6fr_0.95fr_1fr_1.2fr] items-center border-b border-[color:var(--border)] px-4 py-4 text-sm last:border-b-0"
          >
            <div>
              <p className="font-semibold text-[color:var(--text-primary)]">{owner.name}</p>
              <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
                {owner.ownerType === "founder_admin" ? "Company founder" : owner.email || "Investor"}
              </p>
            </div>
            <span className="text-[color:var(--text-secondary)]">
              {owner.ownerType === "founder_admin" ? "Founder" : "Investor"}
            </span>
            <span className="font-semibold text-[color:var(--primary)]">{percent(owner.equityPercent)}</span>
            <span className="text-[color:var(--text-secondary)]">{money(owner.capitalContributed, currency)}</span>
            <span className="text-[color:var(--text-secondary)]">{money(owner.founderPurchaseAmount, currency)}</span>
            <div className="flex flex-wrap gap-1.5">
              {owner.ownerType === "founder_admin" ? (
                <TinyMuted>Founder capital record</TinyMuted>
              ) : owner.activeOfferCount > 0 ? (
                <>
                  <TinyChip>Offer PDF</TinyChip>
                  <TinyChip>Agreement PDF</TinyChip>
                  <TinyChip>Certificate PDF</TinyChip>
                </>
              ) : (
                <>
                  <TinyMuted>Offer —</TinyMuted>
                  <TinyMuted>Agreement —</TinyMuted>
                  <TinyMuted>Certificate —</TinyMuted>
                </>
              )}
            </div>
          </div>
        ))}

        <div className="grid min-w-[820px] grid-cols-[1.35fr_0.7fr_0.6fr_0.95fr_1fr_1.2fr] items-center bg-[color:var(--surface-soft)] px-4 py-4 text-sm font-semibold text-[color:var(--text-primary)]">
          <span>Total</span>
          <span className="text-[color:var(--text-tertiary)]">—</span>
          <span className="text-[color:var(--primary)]">{percent(totals.equity)}</span>
          <span>{money(totals.capital, currency)}</span>
          <span>{money(totals.founderPurchase, currency)}</span>
          <span className="text-[color:var(--text-tertiary)]">{money(totals.invested, currency)} total invested</span>
        </div>
      </div>
    </section>
  );
}

function CompanyLinkedAccounts({
  accounts,
  currency,
  draft,
  isPending,
  onSubmit,
  updateDraft,
}: {
  accounts: InvestorEquityReadModel["cashAccounts"];
  currency: string;
  draft: ContributionDraft;
  isPending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  updateDraft: <K extends keyof ContributionDraft>(key: K, value: ContributionDraft[K]) => void;
}) {
  const activeAccounts = accounts.filter((account) => account.status === "active");

  return (
    <section className="rounded-[1.5rem] border border-[color:var(--border-brand)] bg-[color:var(--surface)] p-4 md:p-5">
      <SectionTitle
        eyebrow="Accounts"
        title="Company-linked accounts"
        subtitle="Investor and founder money can be routed into a selected company account."
      />

      <div className="mt-4 space-y-2">
        {activeAccounts.slice(0, 4).map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
                £
              </span>
              <div>
                <p className="text-sm font-semibold text-[color:var(--text-primary)]">{account.name}</p>
                <p className="text-xs text-[color:var(--text-tertiary)]">{labelize(account.accountType)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-[color:var(--text-primary)]">{money(account.balance, currency)}</p>
              <p className="text-xs text-[color:var(--text-tertiary)]">Available balance</p>
            </div>
          </div>
        ))}

        {!activeAccounts.length && (
          <EmptyState text="No active company accounts found. Add an account before routing investor money." />
        )}
      </div>

      <form onSubmit={onSubmit} className="mt-4 rounded-2xl border border-[color:var(--success-border)] bg-[color:var(--success-soft)] p-4">
        <p className="text-sm font-semibold text-[color:var(--success)]">
          Record founder/admin capital
        </p>
        <p className="mt-1 text-xs leading-5 text-[color:var(--success)]">
          Increases company cash and capital pool. It does not change founder equity.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field
            label="Amount"
            type="number"
            step="0.01"
            value={draft.amount}
            onChange={(value) => updateDraft("amount", value)}
            placeholder="5000"
          />
          <SelectField
            label="Company account"
            value={draft.destinationAccountId}
            onChange={(value) => updateDraft("destinationAccountId", value)}
            options={activeAccounts.map((account) => ({
              value: account.id,
              label: `${account.name} · ${money(account.balance, currency)}`,
            }))}
          />
        </div>

        <label className="mt-3 grid gap-2 text-sm text-[color:var(--text-secondary)]">
          Note
          <textarea
            value={draft.note}
            onChange={(event) => updateDraft("note", event.target.value)}
            rows={2}
            className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--border-brand)]"
            placeholder="Example: Founder initial capital contribution."
          />
        </label>

        <button
          type="submit"
          disabled={isPending || !draft.destinationAccountId || numberValue(draft.amount) <= 0}
          className="mt-3 h-11 w-full rounded-2xl border border-[color:var(--success-border)] bg-[color:var(--success-soft)] px-4 text-sm font-semibold text-[color:var(--success)] transition hover:bg-[color:var(--success-soft)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Record founder/admin capital
        </button>
      </form>
    </section>
  );
}

function ActionsWorkflow() {
  const steps = [
    {
      number: "1",
      title: "Record founder/admin capital",
      text: "Adds founder money to a company account without changing equity.",
    },
    {
      number: "2",
      title: "Create investor equity offer",
      text: "Set investor, amount, equity %, money recipient and account destination.",
    },
    {
      number: "3",
      title: "Mark offer paid/complete",
      text: "Updates ownership and posts company money into Accounts.",
    },
    {
      number: "4",
      title: "Generate documents",
      text: "Offer PDF, Agreement PDF and Certificate PDF.",
    },
  ];

  return (
    <section className="rounded-[1.5rem] border border-[color:var(--border-brand)] bg-[color:var(--surface)] p-4 md:p-5">
      <SectionTitle
        eyebrow="Actions"
        title="Investor workflow"
        subtitle="A completed offer is the only thing that changes current ownership."
      />

      <div className="mt-4 grid gap-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <div
            key={step.number}
            className="relative flex gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3"
          >
            {index < steps.length - 1 && (
              <span className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-[color:var(--primary)] lg:block">
                →
              </span>
            )}
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--primary-soft)] text-xs font-semibold text-[color:var(--primary)]">
              {step.number}
            </span>
            <div>
              <p className="text-xs font-semibold text-[color:var(--text-primary)]">{step.title}</p>
              <p className="mt-1 text-[11px] leading-4 text-[color:var(--text-tertiary)]">{step.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CreateInvestorOffer({
  canCreateDraft,
  cashAccounts,
  currency,
  draft,
  investors,
  isPending,
  onCreateOffer,
  onPreview,
  preview,
  selectedAccount,
  selectedInvestorName,
  updateDraft,
}: {
  canCreateDraft: boolean;
  cashAccounts: InvestorEquityReadModel["cashAccounts"];
  currency: string;
  draft: OfferDraft;
  investors: InvestorEquityReadModel["investors"];
  isPending: boolean;
  onCreateOffer: () => void;
  onPreview: (event: FormEvent<HTMLFormElement>) => void;
  preview: EquityOfferPreview | null;
  selectedAccount?: InvestorEquityReadModel["cashAccounts"][number];
  selectedInvestorName: string;
  updateDraft: <K extends keyof OfferDraft>(key: K, value: OfferDraft[K]) => void;
}) {
  const canCreateOffer = Boolean(preview && !preview.blockingReasons.length);
  const hasOfferNumbers =
    numberValue(draft.amount) > 0 && numberValue(draft.equityPercent) > 0;
  const impliedValue = hasOfferNumbers
    ? numberValue(draft.amount) / (numberValue(draft.equityPercent) / 100)
    : 0;

  return (
    <section className="rounded-[1.5rem] border border-[color:var(--border-brand)] bg-[color:var(--surface)] p-4 md:p-5">
      <SectionTitle
        eyebrow="Create offer"
        title="Create investor equity offer"
        subtitle="Create an offer to raise capital or sell founder equity."
      />

      <form onSubmit={onPreview} className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1fr]">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceButton
              active={draft.dealType === "company_raise"}
              title="Company receives money"
              subtitle="Company raise"
              text="Money goes into the selected company account."
              onClick={() => {
                updateDraft("dealType", "company_raise");
                if (!draft.destinationAccountId && cashAccounts[0]) {
                  updateDraft("destinationAccountId", cashAccounts[0].id);
                }
              }}
            />
            <ChoiceButton
              active={draft.dealType === "founder_sale"}
              title="Founder/Admin receives money"
              subtitle="Founder sale"
              text="Company cash and capital raised stay the same."
              onClick={() => updateDraft("dealType", "founder_sale")}
            />
          </div>

          <SelectField
            label="Investor"
            value={draft.investorId}
            onChange={(value) => updateDraft("investorId", value)}
            options={investors.map((investor) => ({
              value: investor.id,
              label:
                text(investor.full_name, "") ||
                text(investor.email, "Investor"),
            }))}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Investment amount"
              type="number"
              step="0.01"
              value={draft.amount}
              onChange={(value) => updateDraft("amount", value)}
              placeholder="10000"
            />
            <Field
              label="Equity offered"
              type="number"
              step="0.01"
              value={draft.equityPercent}
              onChange={(value) => updateDraft("equityPercent", value)}
              placeholder="10"
              suffix="%"
            />
          </div>

          <SelectField
            label="Money goes to"
            value={draft.dealType}
            onChange={(value) => updateDraft("dealType", value as EquityDealType)}
            options={[
              { value: "company_raise", label: "Company" },
              { value: "founder_sale", label: "Founder/Admin" },
            ]}
          />

          {draft.dealType === "company_raise" && (
            <SelectField
              label="Company account"
              value={draft.destinationAccountId}
              onChange={(value) => updateDraft("destinationAccountId", value)}
              options={cashAccounts.map((account) => ({
                value: account.id,
                label: `${account.name} · ${money(account.balance, currency)}`,
              }))}
            />
          )}

          <label className="grid gap-2 text-sm text-[color:var(--text-secondary)]">
            Notes
            <textarea
              value={draft.note}
              onChange={(event) => updateDraft("note", event.target.value)}
              rows={2}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--border-brand)]"
              placeholder="Investment into the company."
            />
          </label>
        </div>

        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
          <p className="text-sm font-semibold text-[color:var(--text-primary)]">Offer preview</p>
          <div className="mt-4 space-y-3">
            <PreviewLine label="Investor" value={selectedInvestorName} />
            <PreviewLine
              label="Amount"
              value={hasOfferNumbers ? money(draft.amount, currency) : "Enter amount"}
            />
            <PreviewLine
              label="Equity"
              value={hasOfferNumbers ? percent(draft.equityPercent) : "Enter equity %"}
            />
            <PreviewLine label="Money recipient" value={moneyRecipientLabel(draft.dealType)} />
            <PreviewLine
              label="Company account"
              value={
                draft.dealType === "company_raise"
                  ? selectedAccount?.name || "Select account"
                  : "Not applicable"
              }
            />
            <PreviewLine
              label="Implied company value"
              value={hasOfferNumbers ? money(impliedValue, currency) : "Preview required"}
            />
          </div>

          <div className="mt-4 rounded-2xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] p-3 text-xs leading-5 text-[color:var(--primary)]">
            {hasOfferNumbers ? (
              <>
                {selectedInvestorName} invests {money(draft.amount, currency)} for{" "}
                {percent(draft.equityPercent)} equity.
                {draft.dealType === "company_raise"
                  ? ` Funds will be deposited into ${selectedAccount?.name || "the selected company account"}.`
                  : " Funds go directly to Founder/Admin."}
              </>
            ) : (
              "Enter the investment amount and equity percentage to generate the offer preview."
            )}
          </div>

          {preview ? (
            <OfferPreviewBox preview={preview} currency={currency} />
          ) : (
            <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 text-xs leading-5 text-[color:var(--text-tertiary)]">
              Preview the offer to see Founder/Admin equity, investor equity,
              company cash and capital raised before creating the offer.
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="submit"
              disabled={!canCreateDraft || isPending}
              className="h-11 rounded-2xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-4 text-sm font-semibold text-[color:var(--primary)] transition hover:bg-[color:var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Preview offer
            </button>
            <button
              type="button"
              disabled={!canCreateOffer || isPending}
              onClick={onCreateOffer}
              className="h-11 rounded-2xl border border-[color:var(--border-brand)] bg-[color:var(--primary)] px-4 text-sm font-semibold text-[color:var(--text-primary)] transition hover:bg-[color:var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Create offer + PDFs
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function OfferPreviewBox({
  currency,
  preview,
}: {
  currency: string;
  preview: EquityOfferPreview;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
      <p className="text-sm font-semibold text-[color:var(--text-primary)]">Result if completed</p>

      <div className="mt-3 space-y-2">
        <PreviewLine label="Founder/Admin equity" value={percent(preview.founderEquityAfter)} />
        <PreviewLine label="Investor equity after" value={percent(preview.investorEquityAfter)} />
        <PreviewLine label="Company receives" value={money(preview.companyReceives, currency)} />
        <PreviewLine label="Founder receives" value={money(preview.founderReceives, currency)} />
        <PreviewLine label="Company capital raised" value={`+${money(preview.companyReceives, currency)}`} />
      </div>

      {!!preview.blockingReasons.length && (
        <div className="mt-3 rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] p-3 text-xs text-[color:var(--danger)]">
          {preview.blockingReasons.join(" ")}
        </div>
      )}

      {!!preview.warnings.length && (
        <div className="mt-3 rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] p-3 text-xs text-[color:var(--warning)]">
          {preview.warnings.join(" ")}
        </div>
      )}
    </div>
  );
}

function OffersPanel({
  allOffers,
  companyId,
  companyName,
  currency,
  isPending,
  offerFilter,
  offers,
  onCancelOffer,
  onCompleteOffer,
  setOfferFilter,
}: {
  allOffers: EquityOffer[];
  companyId: UUID;
  companyName: string;
  currency: string;
  isPending: boolean;
  offerFilter: "all" | "pending" | "completed" | "cancelled";
  offers: EquityOffer[];
  onCancelOffer: (offerId: string) => void;
  onCompleteOffer: (offerId: string) => void;
  setOfferFilter: (filter: "all" | "pending" | "completed" | "cancelled") => void;
}) {
  const filters: { key: "all" | "pending" | "completed" | "cancelled"; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <section className="rounded-[1.5rem] border border-[color:var(--border-brand)] bg-[color:var(--surface)] p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <SectionTitle
          eyebrow="Offers"
          title="Offers"
          subtitle="Manage investor equity offers."
        />
        <div className="inline-flex rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-1">
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setOfferFilter(filter.key)}
              className={[
                "rounded-xl px-3 py-2 text-xs font-semibold transition",
                offerFilter === filter.key
                  ? "bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
                  : "text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--text-primary)]",
              ].join(" ")}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[color:var(--border)]">
        <div className="grid min-w-[940px] grid-cols-[0.75fr_1fr_0.8fr_0.55fr_0.8fr_1fr_0.75fr_1.25fr] border-b border-[color:var(--border)] bg-[color:var(--primary-soft)] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">
          <span>Status</span>
          <span>Investor</span>
          <span>Amount</span>
          <span>Equity %</span>
          <span>Money recipient</span>
          <span>Destination account</span>
          <span>Date</span>
          <span>Actions</span>
        </div>

        {offers.map((offer) => (
          <div
            key={offer.id}
            className="grid min-w-[940px] grid-cols-[0.75fr_1fr_0.8fr_0.55fr_0.8fr_1fr_0.75fr_1.25fr] items-center border-b border-[color:var(--border)] px-4 py-3 text-sm last:border-b-0"
          >
            <StatusBadge status={offer.status} />
            <span className="font-semibold text-[color:var(--text-primary)]">{offer.investorName}</span>
            <span className="text-[color:var(--text-secondary)]">{money(offer.amount, currency)}</span>
            <span className="text-[color:var(--primary)]">{percent(offer.equityPercent)}</span>
            <span className="text-[color:var(--text-secondary)]">
              {offer.moneyRecipient === "company" ? "Company" : "Founder/Admin"}
            </span>
            <span className="text-[color:var(--text-secondary)]">
              {offer.moneyRecipient === "company"
                ? offer.destinationAccountName || "Company account"
                : "Not applicable"}
            </span>
            <span className="text-[color:var(--text-secondary)]">{dateLabel(offer.createdAt)}</span>
            <div className="flex flex-wrap gap-2">
              <SmallButton
                onClick={() => {
                  makePdf("Equity Offer", [
                    `Company: ${companyName}`,
                    `Investor: ${offer.investorName}`,
                    `Amount: ${money(offer.amount, currency)}`,
                    `Equity offered: ${percent(offer.equityPercent)}`,
                    `Money recipient: ${
                      offer.moneyRecipient === "company" ? "Company" : "Founder/Admin"
                    }`,
                    `Destination account: ${
                      offer.moneyRecipient === "company"
                        ? offer.destinationAccountName || "Company account"
                        : "Not applicable"
                    }`,
                    `Status: ${labelize(offer.status)}`,
                  ]);
                  trackDocumentDownload({
                    companyId,
                    offerId: offer.id,
                    investorId: offer.investorId,
                    documentType: "offer_pdf",
                    documentLabel: "Offer PDF",
                  });
                }}
              >
                Offer PDF
              </SmallButton>
              {offer.canDownloadAgreementPdf && (
                <SmallButton
                  onClick={() => {
                    makePdf("Investment Agreement", [
                      `Company: ${companyName}`,
                      `Agreement for ${offer.investorName}`,
                      `Deal type: ${dealTypeTitle(offer.dealType)}`,
                      `Amount: ${money(offer.amount, currency)}`,
                      `Equity: ${percent(offer.equityPercent)}`,
                    ]);
                    trackDocumentDownload({
                      companyId,
                      offerId: offer.id,
                      investorId: offer.investorId,
                      documentType: "agreement_pdf",
                      documentLabel: "Agreement PDF",
                    });
                  }}
                >
                  Agreement PDF
                </SmallButton>
              )}
              {offer.canComplete && (
                <SmallButton disabled={isPending} onClick={() => onCompleteOffer(offer.id)}>
                  Mark paid
                </SmallButton>
              )}
              {offer.canCancel && (
                <SmallButton
                  disabled={isPending}
                  tone="danger"
                  onClick={() => onCancelOffer(offer.id)}
                >
                  Cancel
                </SmallButton>
              )}
            </div>
          </div>
        ))}

        {!offers.length && (
          <div className="px-4 py-8">
            <EmptyState
              text={
                allOffers.length
                  ? "No offers match this filter."
                  : "No equity offers yet."
              }
            />
          </div>
        )}
      </div>
    </section>
  );
}

function DocumentsPanel({
  certificates,
  companyId,
  companyName,
  currency,
  offers,
}: {
  certificates: InvestorEquityReadModel["certificates"];
  companyId: UUID;
  companyName: string;
  currency: string;
  offers: EquityOffer[];
}) {
  const latestOffer = offers.find((offer) => offer.status === "completed") || offers[0] || null;
  const latestCertificate = certificates[0] || null;

  return (
    <section className="rounded-[1.5rem] border border-[color:var(--border-brand)] bg-[color:var(--surface)] p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <SectionTitle
          eyebrow="Documents"
          title="Documents"
          subtitle="Offer PDFs, agreement PDFs and certificate PDFs in one place."
        />
        <button
          type="button"
          className="h-10 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-xs font-semibold text-[color:var(--text-primary)] transition hover:bg-[color:var(--surface-soft)]"
        >
          View all documents →
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <DocumentCard
          title="Offer PDF"
          description="Investor equity offer document."
          latestName={latestOffer?.investorName || "No offer yet"}
          latestDate={dateLabel(latestOffer?.createdAt)}
          status={latestOffer?.status || "not ready"}
          button="Download offer PDF"
          disabled={!latestOffer}
          onClick={() => {
            if (!latestOffer) return;

            makePdf("Equity Offer", [
              `Company: ${companyName}`,
              `Investor: ${latestOffer.investorName}`,
              `Amount: ${money(latestOffer.amount, currency)}`,
              `Equity offered: ${percent(latestOffer.equityPercent)}`,
              `Money recipient: ${
                latestOffer.moneyRecipient === "company" ? "Company" : "Founder/Admin"
              }`,
              `Destination account: ${
                latestOffer.moneyRecipient === "company"
                  ? latestOffer.destinationAccountName || "Company account"
                  : "Not applicable"
              }`,
              `Status: ${labelize(latestOffer.status)}`,
            ]);
            trackDocumentDownload({
              companyId,
              offerId: latestOffer.id,
              investorId: latestOffer.investorId,
              documentType: "offer_pdf",
              documentLabel: "Offer PDF",
            });
          }}
        />

        <DocumentCard
          title="Agreement PDF"
          description="Investment agreement document."
          latestName={latestOffer?.investorName || "No agreement yet"}
          latestDate={dateLabel(latestOffer?.createdAt)}
          status={latestOffer?.status || "not ready"}
          button="Download agreement PDF"
          disabled={!latestOffer}
          onClick={() => {
            if (!latestOffer) return;

            makePdf("Investment Agreement", [
              `Company: ${companyName}`,
              `Agreement for ${latestOffer.investorName}`,
              `Deal type: ${dealTypeTitle(latestOffer.dealType)}`,
              `Amount: ${money(latestOffer.amount, currency)}`,
              `Equity: ${percent(latestOffer.equityPercent)}`,
            ]);
            trackDocumentDownload({
              companyId,
              offerId: latestOffer.id,
              investorId: latestOffer.investorId,
              documentType: "agreement_pdf",
              documentLabel: "Agreement PDF",
            });
          }}
        />

        <DocumentCard
          title="Certificate PDF"
          description="Ownership certificate document."
          latestName={latestCertificate?.investorName || "No certificate yet"}
          latestDate={dateLabel(latestCertificate?.issuedAt)}
          status={latestCertificate ? "issued" : "not ready"}
          button="Download certificate PDF"
          disabled={!latestCertificate}
          onClick={() => {
            if (!latestCertificate) return;

            makePdf("Ownership Certificate", [
              `Company: ${companyName}`,
              `Certificate: ${latestCertificate.certificateNumber}`,
              `Investor: ${latestCertificate.investorName}`,
              `Equity owned: ${percent(latestCertificate.equityPercent)}`,
              `Amount paid: ${money(latestCertificate.amount, currency)}`,
              `Issued: ${dateLabel(latestCertificate.issuedAt)}`,
            ]);
            trackDocumentDownload({
              companyId,
              offerId: latestCertificate.sourceOfferId,
              investorId: latestCertificate.investorId,
              documentType: "certificate_pdf",
              documentLabel: "Certificate PDF",
            });
          }}
        />
      </div>
    </section>
  );
}

function DocumentCard({
  button,
  description,
  disabled,
  latestDate,
  latestName,
  onClick,
  status,
  title,
}: {
  button: string;
  description: string;
  disabled?: boolean;
  latestDate: string;
  latestName: string;
  onClick: () => void;
  status: string;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
          PDF
        </span>
        <div>
          <p className="font-semibold text-[color:var(--text-primary)]">{title}</p>
          <p className="mt-1 text-xs leading-5 text-[color:var(--text-tertiary)]">{description}</p>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-tertiary)]">
            Latest
          </p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">{latestName}</p>
          <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">{latestDate}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="mt-4 h-10 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-xs font-semibold text-[color:var(--text-primary)] transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {button}
      </button>
    </div>
  );
}

function ChoiceButton({
  active,
  onClick,
  subtitle,
  text: body,
  title,
}: {
  active: boolean;
  onClick: () => void;
  subtitle: string;
  text: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border p-4 text-left transition",
        active
          ? "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)]"
          : "border-[color:var(--border)] bg-[color:var(--surface-soft)] hover:bg-[color:var(--surface-soft)]",
      ].join(" ")}
    >
      <p className="text-sm font-semibold text-[color:var(--text-primary)]">{title}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--primary)]">
        {subtitle}
      </p>
      <p className="mt-2 text-xs leading-5 text-[color:var(--text-tertiary)]">{body}</p>
    </button>
  );
}

function Field({
  label,
  onChange,
  placeholder,
  step,
  suffix,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  step?: string;
  suffix?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm text-[color:var(--text-secondary)]">
      {label}
      <div className="flex h-11 items-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 focus-within:border-[color:var(--border-brand)]">
        <input
          type={type}
          step={step}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
        />
        {suffix && <span className="text-sm text-[color:var(--text-tertiary)]">{suffix}</span>}
      </div>
    </label>
  );
}

function SelectField({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm text-[color:var(--text-secondary)]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
      >
        <option value="">Choose</option>
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-[color:var(--text-tertiary)]">{label}</span>
      <span className="text-right font-semibold text-[color:var(--text-primary)]">{value}</span>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  subtitle,
  title,
}: {
  eyebrow: string;
  subtitle: string;
  title: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--primary)]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
        {title}
      </h2>
      <p className="mt-1 max-w-4xl text-xs leading-5 text-[color:var(--text-tertiary)]">
        {subtitle}
      </p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-tertiary)]">
        {label}
      </p>
      <p className="mt-1 break-words font-semibold text-[color:var(--text-primary)]">{value}</p>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "cyan" | "green" | "amber" | "slate";
}) {
  return (
    <span
      className={[
        "inline-flex w-fit rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
        tone === "cyan"
          ? "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
          : tone === "green"
            ? "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
            : tone === "amber"
              ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
              : "border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)]",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: unknown }) {
  const value = String(status ?? "").toLowerCase();
  const good = ["issued", "active", "completed", "approved", "executed"].includes(value);
  const bad = ["suspended", "rejected", "cancelled", "removed", "failed"].includes(value);
  const waiting = ["pending", "sent", "accepted", "payment_received", "draft"].includes(value);

  return (
    <span
      className={[
        "inline-flex w-fit rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize",
        good
          ? "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
          : bad
            ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
            : waiting
              ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
              : "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
      ].join(" ")}
    >
      {labelize(status)}
    </span>
  );
}

function TinyChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-lg border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-2 py-1 text-[10px] font-semibold text-[color:var(--primary)]">
      {children}
    </span>
  );
}

function TinyMuted({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2 py-1 text-[10px] font-semibold text-[color:var(--text-tertiary)]">
      {children}
    </span>
  );
}

function SmallButton({
  children,
  disabled,
  onClick,
  tone = "normal",
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  tone?: "normal" | "danger";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "rounded-xl border px-2.5 py-1.5 text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        tone === "danger"
          ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)] hover:bg-[color:var(--danger-soft)]"
          : "border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-primary)] hover:bg-[color:var(--surface-soft)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Message({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "good" | "bad" | "neutral";
}) {
  return (
    <div
      className={[
        "rounded-[1.25rem] border px-4 py-3 text-sm",
        tone === "good"
          ? "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
          : tone === "bad"
            ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
            : "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function EmptyState({ text: label }: { text: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-8 text-center text-sm text-[color:var(--text-tertiary)]">
      {label}
    </div>
  );
}