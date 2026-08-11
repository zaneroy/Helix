"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { emitEvent } from "@/lib/events/emitEvent";
import { createClient } from "@/lib/supabase/server";
import type {
  InvestorPortalActionResult,
  InvestorCapitalRequest,
  InvestorCapitalRequestStatus,
  InvestorCapitalRequestType,
  InvestorPortalActivity,
  InvestorPortalCertificate,
  InvestorPortalDealType,
  InvestorPortalDocument,
  InvestorPortalMoneyRecipient,
  InvestorPortalNotification,
  InvestorPortalOffer,
  InvestorPortalOfferStatus,
  InvestorPortalReadModel,
  InvestorPortalReportData,
  InvestorPortalTrendPoint,
  SubmitInvestorCapitalRequestInput,
  UUID,
} from "@/types/investor-portal";

type JsonRecord = Record<string, any>;

function nowIso(): string {
  return new Date().toISOString();
}

function text(value: unknown, fallback = ""): string {
  const clean = String(value ?? "").trim();

  return clean || fallback;
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

function percentValue(value: unknown): number {
  return Math.max(0, Math.min(100, numberValue(value)));
}

function initials(name: string, email?: string | null): string {
  const source = text(name) || text(email) || "Investor";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function statusValue(value: unknown): InvestorPortalOfferStatus {
  const status = text(value).toLowerCase();

  if (
    [
      "draft",
      "pending",
      "sent",
      "accepted",
      "payment_received",
      "completed",
      "cancelled",
      "rejected",
    ].includes(status)
  ) {
    return status as InvestorPortalOfferStatus;
  }

  if (status === "active" || status === "paid") return "completed";

  return "pending";
}

function capitalRequestTypeValue(value: unknown): InvestorCapitalRequestType {
  const clean = text(value).toLowerCase();

  return clean === "withdrawal_request" ? "withdrawal_request" : "capital_in";
}

function capitalRequestStatusValue(value: unknown): InvestorCapitalRequestStatus {
  const clean = text(value).toLowerCase();

  if (["pending", "approved", "rejected", "completed", "cancelled"].includes(clean)) {
    return clean as InvestorCapitalRequestStatus;
  }

  return "pending";
}

function capitalRequestTitle(type: InvestorCapitalRequestType): string {
  return type === "withdrawal_request" ? "Withdrawal request" : "Capital in request";
}

function capitalRequestMessage(input: {
  investorName: string;
  amount: number;
  currency: string;
  requestType: InvestorCapitalRequestType;
}): string {
  const formatted = currencyLabel(input.amount, input.currency);

  return `${input.investorName} submitted a ${capitalRequestTitle(input.requestType).toLowerCase()} for ${formatted}.`;
}

function isCompletedStatus(value: unknown): boolean {
  const status = statusValue(value);

  return status === "completed" || status === "payment_received";
}

function safeDate(value: unknown): Date | null {
  const raw = text(value);

  if (!raw) return null;

  const date = new Date(raw);

  return Number.isNaN(date.getTime()) ? null : date;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return months[date.getUTCMonth()] || "";
}

type TrendBucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

function buildTrendBuckets(months = 12): TrendBucket[] {
  const now = new Date();
  const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const buckets: TrendBucket[] = [];

  for (let index = months - 1; index >= 0; index -= 1) {
    const start = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() - index, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    buckets.push({
      key: monthKey(start),
      label: monthLabel(start),
      start,
      end,
    });
  }

  return buckets;
}

function trendPoint(bucket: TrendBucket, value: number): InvestorPortalTrendPoint {
  return {
    key: bucket.key,
    label: bucket.label,
    value,
  };
}

type OfferMetadata = {
  title?: string | null;
  note?: string | null;
  dealType?: InvestorPortalDealType;
  moneyRecipient?: InvestorPortalMoneyRecipient;
  destinationAccountId?: string | null;
  destinationAccountName?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
};

function parseOfferMetadata(notes: unknown): OfferMetadata {
  const raw = text(notes);

  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as JsonRecord;
    const dealType: InvestorPortalDealType =
      parsed.dealType === "founder_sale" || parsed.deal_type === "founder_sale"
        ? "founder_sale"
        : "company_raise";

    return {
      title: text(parsed.title) || null,
      note: text(parsed.note) || text(parsed.description) || null,
      dealType,
      moneyRecipient:
        parsed.moneyRecipient === "founder_admin" ||
        parsed.money_recipient === "founder_admin" ||
        dealType === "founder_sale"
          ? "founder_admin"
          : "company",
      destinationAccountId:
        text(parsed.destinationAccountId) ||
        text(parsed.destination_account_id) ||
        null,
      destinationAccountName:
        text(parsed.destinationAccountName) ||
        text(parsed.destination_account_name) ||
        null,
      createdAt: text(parsed.createdAt) || text(parsed.created_at) || null,
      completedAt: text(parsed.completedAt) || text(parsed.completed_at) || null,
    };
  } catch {
    return {
      note: raw,
    };
  }
}

function offerDate(row: JsonRecord): Date | null {
  const metadata = parseOfferMetadata(row.notes);

  return (
    safeDate(metadata.completedAt) ||
    safeDate(row.investment_date) ||
    safeDate(row.created_at) ||
    safeDate(metadata.createdAt)
  );
}

function impliedPostMoney(amount: number, equityPercent: number): number {
  if (amount <= 0 || equityPercent <= 0) return 0;

  return amount / (equityPercent / 100);
}

function categoryText(row: JsonRecord): string {
  return [
    row.category,
    row.type,
    row.source_type,
    row.description,
    row.reference,
    row.notes,
  ]
    .map((value) => text(value).toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function ledgerDate(row: JsonRecord): Date | null {
  return safeDate(row.transaction_date) || safeDate(row.created_at) || safeDate(row.date);
}

function ledgerAmount(row: JsonRecord): number {
  return numberValue(row.amount);
}

function isCompletedLedger(row: JsonRecord): boolean {
  const status = text(row.status).toLowerCase();

  return !status || status === "completed" || status === "paid" || status === "posted";
}

function isSalesLedger(row: JsonRecord): boolean {
  const haystack = categoryText(row);

  return (
    haystack.includes("sale") ||
    haystack.includes("sales") ||
    haystack.includes("invoice payment")
  );
}

function isCogsLedger(row: JsonRecord): boolean {
  const haystack = categoryText(row);

  return (
    haystack.includes("cogs") ||
    haystack.includes("cost of goods") ||
    haystack.includes("inventory cost")
  );
}

function isOperatingExpenseLedger(row: JsonRecord): boolean {
  const haystack = categoryText(row);

  return (
    haystack.includes("expense") ||
    haystack.includes("rent") ||
    haystack.includes("office") ||
    haystack.includes("marketing") ||
    haystack.includes("supplies")
  );
}

function isFounderCapitalLedger(row: JsonRecord): boolean {
  const haystack = categoryText(row);

  return (
    haystack.includes("founder_capital") ||
    haystack.includes("founder capital") ||
    haystack.includes("admin capital") ||
    haystack.includes("owner capital")
  );
}

function rowIsInvestorVisible(row: JsonRecord): boolean {
  const access = text(row.access_level).toLowerCase();
  const visibility = text(row.visibility).toLowerCase();
  const audience = text(row.audience).toLowerCase();
  const category = text(row.category).toLowerCase();

  return (
    row.investor_visible === true ||
    row.is_investor_visible === true ||
    row.visible_to_investors === true ||
    access.includes("investor") ||
    visibility.includes("investor") ||
    audience.includes("investor") ||
    category.includes("investor") ||
    category.includes("financial") ||
    category.includes("report")
  );
}

function currencyLabel(amount: number, currency = "GBP"): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(numberValue(amount));
  } catch {
    return `${currency} ${numberValue(amount).toFixed(2)}`;
  }
}

function normalizeError(error: unknown): InvestorPortalActionResult<never> {
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Something went wrong.",
  };
}

async function getSessionContext() {
  const supabase = await createClient();
  const client = supabase as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/investor/login");
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect("/investor/login");
  }

  const profileRow = profile as JsonRecord;
  const companyId = text(profileRow.company_id);

  if (!companyId) {
    redirect("/investor/login");
  }

  return {
    supabase,
    client,
    user,
    profile: profileRow,
    companyId,
  };
}

async function readCompanyDetails(client: any, companyId: string, fallbackCurrency = "GBP") {
  const { data } = await client
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();

  const row = (data || {}) as JsonRecord;

  return {
    companyName:
      text(row.legal_name) ||
      text(row.company_name) ||
      text(row.name) ||
      text(row.business_name) ||
      text(row.trading_name) ||
      "Company",
    currency: text(row.currency) || fallbackCurrency || "GBP",
  };
}

async function readRows(client: any, table: string, companyId: string): Promise<JsonRecord[]> {
  try {
    const { data, error } = await client
      .from(table)
      .select("*")
      .eq("company_id", companyId);

    if (error || !data) return [];

    return data as JsonRecord[];
  } catch {
    return [];
  }
}

async function readInvestorOffers(
  client: any,
  companyId: string,
  investorId: string,
  companyName: string,
): Promise<InvestorPortalOffer[]> {
  try {
    const { data, error } = await client
      .from("investments")
      .select("*")
      .eq("company_id", companyId)
      .eq("investor_id", investorId)
      .order("investment_date", { ascending: false });

    if (error || !data) return [];

    return (data as JsonRecord[]).map((row) => {
      const metadata = parseOfferMetadata(row.notes);
      const status = statusValue(row.status);
      const dealType = metadata.dealType || "company_raise";
      const amount = numberValue(row.amount);
      const equityPercent = numberValue(row.equity_percent);
      const createdAt =
        metadata.createdAt ||
        text(row.investment_date) ||
        text(row.created_at) ||
        null;

      return {
        id: text(row.id),
        investorId,
        investorName: "You",
        amount,
        equityPercent,
        status,
        dealType,
        moneyRecipient:
          metadata.moneyRecipient || (dealType === "founder_sale" ? "founder_admin" : "company"),
        destinationAccountId: metadata.destinationAccountId || null,
        destinationAccountName: metadata.destinationAccountName || null,
        createdAt,
        completedAt: metadata.completedAt || (isCompletedStatus(status) ? createdAt : null),
        title:
          metadata.title ||
          (dealType === "founder_sale"
            ? "Founder/Admin equity sale"
            : "Company equity offer"),
        note: metadata.note || null,
        canDownloadOfferPdf: true,
        canDownloadAgreementPdf: status !== "cancelled" && status !== "rejected",
        canDownloadCertificatePdf: isCompletedStatus(status),
      };
    });
  } catch {
    return [];
  }
}

async function readAllCompanyInvestments(client: any, companyId: string): Promise<JsonRecord[]> {
  return readRows(client, "investments", companyId);
}

async function readCashAccounts(client: any, companyId: string): Promise<JsonRecord[]> {
  return readRows(client, "cash_accounts", companyId);
}

async function readCashLedger(client: any, companyId: string): Promise<JsonRecord[]> {
  return readRows(client, "cash_ledger", companyId);
}

async function readProducts(client: any, companyId: string): Promise<JsonRecord[]> {
  return readRows(client, "products", companyId);
}

async function readDocuments(client: any, companyId: string): Promise<InvestorPortalDocument[]> {
  const rows = await readRows(client, "company_documents", companyId);

  return rows
    .filter(rowIsInvestorVisible)
    .map((row) => ({
      id: text(row.id) || text(row.document_id) || Math.random().toString(36).slice(2),
      title:
        text(row.title) ||
        text(row.name) ||
        text(row.file_name) ||
        text(row.filename) ||
        "Investor document",
      category:
        text(row.category) ||
        text(row.document_type) ||
        text(row.type) ||
        "Other documents",
      fileName: text(row.file_name) || text(row.filename) || null,
      fileType: text(row.file_type) || text(row.mime_type) || null,
      sizeLabel: row.file_size ? `${Math.round(numberValue(row.file_size) / 1024)} KB` : null,
      uploadedAt: text(row.created_at) || text(row.uploaded_at) || null,
      downloadUrl: text(row.public_url) || text(row.download_url) || text(row.url) || null,
    }))
    .sort((a, b) => String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")));
}

async function readNotifications(
  client: any,
  userId: string,
): Promise<InvestorPortalNotification[]> {
  try {
    const { data, error } = await client
      .from("notifications")
      .select("*")
      .limit(50);

    if (error || !data) return [];

    return (data as JsonRecord[])
      .filter((row) => {
        const recipient =
          text(row.recipient_id) ||
          text(row.user_id) ||
          text(row.profile_id) ||
          text(row.owner_id);

        return !recipient || recipient === userId;
      })
      .map((row) => ({
        id: text(row.id) || Math.random().toString(36).slice(2),
        title: text(row.title) || "Notification",
        message: text(row.message) || text(row.description) || "",
        type: text(row.type) || "notification",
        createdAt: text(row.created_at) || text(row.createdAt) || null,
        readAt: text(row.read_at) || text(row.readAt) || null,
        actionUrl: text(row.action_url) || text(row.actionUrl) || null,
      }))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  } catch {
    return [];
  }
}

async function readInvestorActivity(
  client: any,
  companyId: string,
  investorId: string,
): Promise<InvestorPortalActivity[]> {
  try {
    const { data, error } = await client
      .from("investor_activity")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) return [];

    return (data as JsonRecord[])
      .filter((row) => {
        const rowInvestorId = text(row.investor_id);

        return !rowInvestorId || rowInvestorId === investorId;
      })
      .map((row) => ({
        id: text(row.id) || Math.random().toString(36).slice(2),
        title: text(row.title) || "Investor activity",
        description: text(row.description) || text(row.message) || "",
        type: text(row.type) || "activity",
        createdAt: text(row.created_at) || null,
      }));
  } catch {
    return [];
  }
}

async function readInvestorCapitalRequests(
  client: any,
  companyId: string,
  investorId: string,
  investorName = "Investor",
  investorEmail: string | null = null,
): Promise<InvestorCapitalRequest[]> {
  try {
    const { data, error } = await client
      .from("investor_capital_requests")
      .select("*")
      .eq("company_id", companyId)
      .eq("investor_id", investorId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) return [];

    return (data as JsonRecord[]).map((row) => ({
      id: text(row.id),
      companyId: text(row.company_id),
      investorId: text(row.investor_id),
      investorName,
      investorEmail,
      requestType: capitalRequestTypeValue(row.request_type),
      amount: numberValue(row.amount),
      currency: text(row.currency) || "GBP",
      notes: text(row.notes) || null,
      status: capitalRequestStatusValue(row.status),
      adminNote: text(row.admin_note) || null,
      reviewedBy: text(row.reviewed_by) || null,
      reviewedAt: text(row.reviewed_at) || null,
      completedAt: text(row.completed_at) || null,
      createdAt: text(row.created_at) || null,
      updatedAt: text(row.updated_at) || null,
    }));
  } catch {
    return [];
  }
}

async function readAdminRecipients(client: any, companyId: string): Promise<string[]> {
  try {
    const { data, error } = await client
      .from("profiles")
      .select("*")
      .eq("company_id", companyId);

    if (error || !data) return [];

    return (data as JsonRecord[])
      .filter((row) => {
        const role = [
          row.role,
          row.account_type,
          row.user_type,
          row.portal_role,
          row.access_role,
        ]
          .map((value) => text(value).toLowerCase())
          .find(Boolean);

        return ["admin", "owner", "founder", "founder_admin", "super_admin"].includes(role || "");
      })
      .map((row) => text(row.id))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function completedOffers(offers: InvestorPortalOffer[]): InvestorPortalOffer[] {
  return offers.filter((offer) => isCompletedStatus(offer.status));
}

function companyCompletedInvestmentRows(rows: JsonRecord[]): JsonRecord[] {
  return rows.filter((row) => isCompletedStatus(row.status));
}

function calculateCompanyCash(accounts: JsonRecord[], ledger: JsonRecord[]): number {
  const activeAccounts = accounts.filter((account) => {
    const status = text(account.status).toLowerCase();

    return !status || status === "active";
  });
  const activeIds = new Set(activeAccounts.map((account) => text(account.id)));
  const opening = activeAccounts.reduce(
    (sum, account) => sum + numberValue(account.opening_balance),
    0,
  );

  return ledger.reduce((sum, row) => {
    const accountId = text(row.account_id);

    if (activeIds.size && accountId && !activeIds.has(accountId)) return sum;
    if (!isCompletedLedger(row)) return sum;

    const amount = ledgerAmount(row);
    const direction = text(row.direction).toLowerCase();

    if (direction === "inflow") return sum + amount;
    if (direction === "outflow") return sum - amount;

    return sum;
  }, opening);
}

function calculateSales(ledger: JsonRecord[]): number {
  return ledger.reduce((sum, row) => {
    if (!isCompletedLedger(row)) return sum;
    if (text(row.direction).toLowerCase() !== "inflow") return sum;
    if (!isSalesLedger(row)) return sum;

    return sum + ledgerAmount(row);
  }, 0);
}

function calculateCogs(ledger: JsonRecord[]): number {
  return ledger.reduce((sum, row) => {
    if (!isCompletedLedger(row)) return sum;
    if (!isCogsLedger(row)) return sum;

    return sum + ledgerAmount(row);
  }, 0);
}

function calculateOperatingExpenses(ledger: JsonRecord[]): number {
  return ledger.reduce((sum, row) => {
    if (!isCompletedLedger(row)) return sum;
    if (!isOperatingExpenseLedger(row)) return sum;
    if (isCogsLedger(row)) return sum;

    return sum + ledgerAmount(row);
  }, 0);
}

function calculateCompanyCapitalRaised(rows: JsonRecord[]): number {
  return companyCompletedInvestmentRows(rows).reduce((sum, row) => {
    const metadata = parseOfferMetadata(row.notes);
    const dealType = metadata.dealType || "company_raise";

    if (dealType === "founder_sale") return sum;

    return sum + numberValue(row.amount);
  }, 0);
}

function calculateFounderCapital(ledger: JsonRecord[]): number {
  return ledger.reduce((sum, row) => {
    if (!isCompletedLedger(row)) return sum;
    if (text(row.direction).toLowerCase() !== "inflow") return sum;
    if (!isFounderCapitalLedger(row)) return sum;

    return sum + ledgerAmount(row);
  }, 0);
}

function calculateLatestCompanyValue(rows: JsonRecord[]): number {
  let latestValue = 0;
  let latestAt = 0;

  for (const row of companyCompletedInvestmentRows(rows)) {
    const amount = numberValue(row.amount);
    const equityPercent = numberValue(row.equity_percent);
    const valuation = impliedPostMoney(amount, equityPercent);
    const timestamp = offerDate(row)?.getTime() ?? 0;

    if (valuation > 0 && timestamp >= latestAt) {
      latestValue = valuation;
      latestAt = timestamp;
    }
  }

  return latestValue;
}

function buildCumulativeTrend(
  buckets: TrendBucket[],
  rows: JsonRecord[],
  getDate: (row: JsonRecord) => Date | null,
  getAmount: (row: JsonRecord) => number,
): InvestorPortalTrendPoint[] {
  return buckets.map((bucket) => {
    const value = rows.reduce((sum, row) => {
      const date = getDate(row);

      if (!date || date > bucket.end) return sum;

      return sum + getAmount(row);
    }, 0);

    return trendPoint(bucket, value);
  });
}

function buildMonthlyTrend(
  buckets: TrendBucket[],
  rows: JsonRecord[],
  getDate: (row: JsonRecord) => Date | null,
  getAmount: (row: JsonRecord) => number,
): InvestorPortalTrendPoint[] {
  return buckets.map((bucket) => {
    const value = rows.reduce((sum, row) => {
      const date = getDate(row);

      if (!date || date < bucket.start || date > bucket.end) return sum;

      return sum + getAmount(row);
    }, 0);

    return trendPoint(bucket, value);
  });
}

function buildTrends(input: {
  accounts: JsonRecord[];
  ledger: JsonRecord[];
  investments: JsonRecord[];
}) {
  const buckets = buildTrendBuckets(12);
  const completedLedger = input.ledger.filter(isCompletedLedger);
  const salesRows = completedLedger.filter(
    (row) => text(row.direction).toLowerCase() === "inflow" && isSalesLedger(row),
  );
  const expenseRows = completedLedger.filter(
    (row) =>
      text(row.direction).toLowerCase() === "outflow" ||
      isOperatingExpenseLedger(row) ||
      isCogsLedger(row),
  );
  const capitalRows = companyCompletedInvestmentRows(input.investments).filter((row) => {
    const metadata = parseOfferMetadata(row.notes);

    return (metadata.dealType || "company_raise") !== "founder_sale";
  });

  const companyCapitalRaised = buildCumulativeTrend(
    buckets,
    capitalRows,
    offerDate,
    (row) => numberValue(row.amount),
  );
  const companyCash = buckets.map((bucket) => {
    const cash = calculateCompanyCash(
      input.accounts,
      completedLedger.filter((row) => {
        const date = ledgerDate(row);

        return !!date && date <= bucket.end;
      }),
    );

    return trendPoint(bucket, cash);
  });
  const companySales = buildMonthlyTrend(
    buckets,
    salesRows,
    ledgerDate,
    (row) => ledgerAmount(row),
  );
  const companyValue = buckets.map((bucket) => {
    const rows = input.investments.filter((row) => {
      const date = offerDate(row);

      return !!date && date <= bucket.end;
    });

    return trendPoint(bucket, calculateLatestCompanyValue(rows));
  });

  return {
    companyValue,
    companyCash,
    companySales,
    revenue: companySales,
    profit: buildMonthlyTrend(
      buckets,
      salesRows,
      ledgerDate,
      (row) => ledgerAmount(row) * 0.65,
    ),
    expenses: buildMonthlyTrend(
      buckets,
      expenseRows,
      ledgerDate,
      (row) => ledgerAmount(row),
    ),
  };
}

function buildReportData(input: {
  ledger: JsonRecord[];
  products: JsonRecord[];
  companyCash: number;
  companySales: number;
}): InvestorPortalReportData {
  const cogs = calculateCogs(input.ledger);
  const operatingExpenses = calculateOperatingExpenses(input.ledger);
  const grossProfit = Math.max(input.companySales - cogs, 0);
  const netProfit = grossProfit - operatingExpenses;
  const grossMarginPercent = input.companySales > 0 ? (grossProfit / input.companySales) * 100 : 0;
  const netMarginPercent = input.companySales > 0 ? (netProfit / input.companySales) * 100 : 0;
  const inventoryValue = input.products.reduce((sum, product) => {
    const quantity =
      numberValue(product.quantity) ||
      numberValue(product.stock) ||
      numberValue(product.current_stock);
    const cost =
      numberValue(product.cost_price) ||
      numberValue(product.unit_cost) ||
      numberValue(product.cost) ||
      numberValue(product.purchase_price);

    return sum + quantity * cost;
  }, 0);
  const inventoryTurnover = inventoryValue > 0 ? cogs / inventoryValue : 0;
  const monthlyBurnRate = Math.max(operatingExpenses, 0);
  const cashRunwayLabel =
    monthlyBurnRate > 0
      ? `${Math.floor(input.companyCash / monthlyBurnRate)} months`
      : "No current burn";
  const healthScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        50 +
          (netProfit > 0 ? 15 : -10) +
          (grossMarginPercent > 50 ? 15 : 0) +
          (input.companyCash > 0 ? 10 : -10) +
          (input.companySales > 0 ? 10 : 0),
      ),
    ),
  );
  const businessHealthLabel =
    healthScore >= 75 ? "Strong" : healthScore >= 50 ? "Stable" : "Needs attention";

  const topProducts = input.products
    .map((product) => {
      const quantitySold =
        numberValue(product.quantity_sold) ||
        numberValue(product.sold) ||
        numberValue(product.units_sold);
      const price =
        numberValue(product.price) ||
        numberValue(product.sale_price) ||
        numberValue(product.unit_price);
      const revenue =
        numberValue(product.revenue) ||
        numberValue(product.total_revenue) ||
        quantitySold * price;

      return {
        id: text(product.id) || text(product.sku) || product.name || Math.random().toString(36),
        name: text(product.name) || text(product.product_name) || "Product",
        sku: text(product.sku) || null,
        quantitySold,
        revenue,
      };
    })
    .filter((product) => product.revenue > 0 || product.quantitySold > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return {
    revenue: input.companySales,
    cogs,
    grossProfit,
    operatingExpenses,
    netProfit,
    grossMarginPercent,
    netMarginPercent,
    ebitdaEstimate: netProfit,
    businessHealthScore: healthScore,
    businessHealthLabel,
    inventoryValue,
    inventoryTurnover,
    cashInflows: input.ledger
      .filter((row) => isCompletedLedger(row) && text(row.direction).toLowerCase() === "inflow")
      .reduce((sum, row) => sum + ledgerAmount(row), 0),
    cashOutflows: input.ledger
      .filter((row) => isCompletedLedger(row) && text(row.direction).toLowerCase() === "outflow")
      .reduce((sum, row) => sum + ledgerAmount(row), 0),
    monthlyBurnRate,
    cashRunwayLabel,
    topProducts,
  };
}

function buildCertificates(offers: InvestorPortalOffer[]): InvestorPortalCertificate[] {
  return completedOffers(offers).map((offer) => ({
    id: `cert-${offer.id}`,
    sourceOfferId: offer.id,
    certificateNumber: `EQT-${offer.id.slice(0, 8).toUpperCase()}`,
    investorId: offer.investorId,
    investorName: offer.investorName,
    equityPercent: offer.equityPercent,
    amount: offer.amount,
    issuedAt: offer.completedAt || offer.createdAt,
  }));
}

export async function getInvestorPortalReadModel(): Promise<InvestorPortalReadModel> {
  const { client, user, profile, companyId } = await getSessionContext();
  const company = await readCompanyDetails(client, companyId, text(profile.currency) || "GBP");
  const investorName = text(profile.full_name) || text(profile.name) || text(user.email) || "Investor";
  const investorEmail = text(profile.email) || text(user.email) || null;
  const investorId = text(user.id);

  const [
    offers,
    allInvestments,
    accounts,
    ledger,
    products,
    documents,
    notifications,
    activity,
    capitalRequests,
  ] =
    await Promise.all([
      readInvestorOffers(client, companyId, investorId, company.companyName),
      readAllCompanyInvestments(client, companyId),
      readCashAccounts(client, companyId),
      readCashLedger(client, companyId),
      readProducts(client, companyId),
      readDocuments(client, companyId),
      readNotifications(client, investorId),
      readInvestorActivity(client, companyId, investorId),
      readInvestorCapitalRequests(client, companyId, investorId, investorName, investorEmail),
    ]);

  offers.forEach((offer) => {
    offer.investorName = investorName;
  });

  const completed = completedOffers(offers);
  const capitalContributed = completed.reduce(
    (sum, offer) => offer.dealType === "company_raise" ? sum + offer.amount : sum,
    0,
  );
  const founderPurchaseAmount = completed.reduce(
    (sum, offer) => offer.dealType === "founder_sale" ? sum + offer.amount : sum,
    0,
  );
  const equityPercent = completed.reduce((sum, offer) => sum + offer.equityPercent, 0);
  const totalInvestment = capitalContributed + founderPurchaseAmount;
  const companyCash = calculateCompanyCash(accounts, ledger);
  const companySales = calculateSales(ledger);
  const companyCapitalRaised = calculateCompanyCapitalRaised(allInvestments);
  /*
   * Investor portal valuation rule:
   * - Do not use company cash as valuation.
   * - Do not use founder/admin deposits as valuation.
   * - Do not reprice an investor from another investor's offer.
   * - Until a formal valuation/exit/dividend/buyback exists, investor value is carried at cost.
   */
  const companyValue =
    totalInvestment > 0 && equityPercent > 0
      ? impliedPostMoney(totalInvestment, equityPercent)
      : 0;
  const estimatedHoldingValue = totalInvestment;
  const estimatedRoiPercent = 0;
  const companyInvestorEquity = companyCompletedInvestmentRows(allInvestments).reduce(
    (sum, row) => sum + numberValue(row.equity_percent),
    0,
  );
  const trends = buildTrends({
    accounts,
    ledger,
    investments: allInvestments,
  });
  const reports = buildReportData({
    ledger,
    products,
    companyCash,
    companySales,
  });
  const certificates = buildCertificates(offers);

  return {
    summary: {
      companyName: company.companyName,
      currency: company.currency,
      investorName,
      investorEmail,
      investorInitials: initials(investorName, investorEmail),
      investorId,
      companyId,
      totalInvestment,
      capitalContributed,
      founderPurchaseAmount,
      equityPercent,
      companyValue,
      estimatedHoldingValue,
      estimatedRoiPercent,
      companyCash,
      companySales,
      companyCapitalRaised,
      founderEquityPercent: Math.max(100 - companyInvestorEquity, 0),
      investorEquityPercent: Math.min(companyInvestorEquity, 100),
      pendingOfferCount: offers.filter((offer) =>
        ["draft", "pending", "sent", "accepted", "payment_received"].includes(offer.status),
      ).length,
      completedOfferCount: completed.length,
      cancelledOfferCount: offers.filter((offer) => offer.status === "cancelled").length,
      certificateCount: certificates.length,
      documentCount: documents.length + offers.length * 2 + certificates.length,
      unreadNotificationCount: notifications.filter((notice) => !notice.readAt).length,
      activeCapitalRequestCount: capitalRequests.filter((request) =>
        ["pending", "approved"].includes(request.status),
      ).length,
      completedCapitalRequestCount: capitalRequests.filter((request) => request.status === "completed").length,
      rejectedCapitalRequestCount: capitalRequests.filter((request) => request.status === "rejected").length,
    },
    offers,
    certificates,
    documents,
    notifications,
    activity,
    capitalRequests,
    trends,
    reports,
  };
}

export async function submitInvestorCapitalRequest(
  input: SubmitInvestorCapitalRequestInput,
): Promise<InvestorPortalActionResult<{ requestId: UUID; message: string }>> {
  try {
    const { client, user, profile, companyId } = await getSessionContext();
    const company = await readCompanyDetails(client, companyId, text(profile.currency) || "GBP");
    const investorName = text(profile.full_name) || text(profile.name) || text(user.email) || "Investor";
    const investorEmail = text(profile.email) || text(user.email) || null;
    const requestType = capitalRequestTypeValue(input.requestType);
    const amount = numberValue(input.amount);
    const notes = text(input.notes).slice(0, 500) || null;

    if (amount <= 0) {
      return {
        ok: false,
        error: "Enter an amount greater than 0.",
      };
    }

    const { data, error } = await client
      .from("investor_capital_requests")
      .insert({
        company_id: companyId,
        investor_id: user.id,
        request_type: requestType,
        amount,
        currency: company.currency,
        notes,
        status: "pending",
      })
      .select("*")
      .single();

    if (error || !data) {
      return {
        ok: false,
        error: error?.message || "Could not submit the capital request.",
      };
    }

    const requestId = text((data as JsonRecord).id);
    const title = `${capitalRequestTitle(requestType)} submitted`;
    const message = capitalRequestMessage({
      investorName,
      amount,
      currency: company.currency,
      requestType,
    });

    try {
      await client.from("investor_activity").insert({
        company_id: companyId,
        investor_id: user.id,
        type: "investor_capital_request_submitted",
        title,
        description: message,
      });
    } catch {
      // Do not block the request if activity write fails.
    }

    const adminRecipients = await readAdminRecipients(client, companyId);
    const recipients = Array.from(new Set([user.id, ...adminRecipients].filter(Boolean)));

    try {
      await emitEvent({
        companyId,
        actorId: user.id,
        recipients,
        type: "investor_capital_request_submitted",
        title,
        message,
        actionUrl: "/dashboard/investors",
        metadata: {
          requestId,
          investorId: user.id,
          investorName,
          investorEmail,
          requestType,
          amount,
          currency: company.currency,
          notes,
        },
      });
    } catch {
      // Notifications should never block the request submission.
    }

    revalidatePath("/investor");
    revalidatePath("/investor/investments");
    revalidatePath("/dashboard/investors");
    revalidatePath("/dashboard/activity");

    return {
      ok: true,
      data: {
        requestId,
        message: "Capital request submitted. The company has been notified.",
      },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong while submitting the capital request.",
    };
  }
}

export async function recordInvestorPortalDocumentDownload(input: {
  documentType:
    | "offer_pdf"
    | "agreement_pdf"
    | "certificate_pdf"
    | "investor_report_pdf"
    | "profit_loss_pdf"
    | "cash_flow_pdf"
    | "inventory_pdf"
    | "uploaded_document";
  documentLabel: string;
  offerId?: UUID | null;
  documentId?: UUID | null;
}): Promise<InvestorPortalActionResult<{ recorded: boolean }>> {
  try {
    const { client, user, profile, companyId } = await getSessionContext();
    const company = await readCompanyDetails(client, companyId, text(profile.currency) || "GBP");
    const investorName = text(profile.full_name) || text(user.email) || "Investor";
    const documentLabel = text(input.documentLabel) || "Investor document";
    const message = `${investorName} downloaded ${documentLabel}.`;

    try {
      await client.from("investor_activity").insert({
        company_id: companyId,
        investor_id: user.id,
        type: "investor_portal_document_downloaded",
        title: `${documentLabel} downloaded`,
        description: message,
      });
    } catch {
      // Do not block downloads.
    }

    try {
      await emitEvent({
        companyId,
        actorId: user.id,
        recipients: [user.id],
        type: "investor_portal_document_downloaded",
        title: `${documentLabel} downloaded`,
        message,
        actionUrl: "/investor/documents",
        metadata: {
          investorId: user.id,
          investorName,
          companyName: company.companyName,
          documentType: input.documentType,
          documentLabel,
          offerId: input.offerId || null,
          documentId: input.documentId || null,
        },
      });
    } catch {
      // Do not block downloads.
    }

    revalidatePath("/investor");
    revalidatePath("/investor/documents");
    revalidatePath("/investor");

    return {
      ok: true,
      data: {
        recorded: true,
      },
    };
  } catch (error) {
    return normalizeError(error);
  }
}


export async function markInvestorNotificationReadInline(
  notificationId: UUID,
): Promise<InvestorPortalActionResult<{ read: boolean }>> {
  try {
    const cleanNotificationId = text(notificationId);

    if (!cleanNotificationId) {
      return {
        ok: false,
        error: "Notification ID is required.",
      };
    }

    const { client } = await getSessionContext();

    await client
      .from("notifications")
      .update({
        read_at: nowIso(),
      })
      .eq("id", cleanNotificationId);

    revalidatePath("/investor");
    revalidatePath("/investor/investments");
    revalidatePath("/investor/reports");
    revalidatePath("/investor/documents");
    revalidatePath("/investor/profile");

    return {
      ok: true,
      data: {
        read: true,
      },
    };
  } catch (error) {
    return normalizeError(error);
  }
}

export async function markInvestorNotificationRead(formData: FormData): Promise<void> {
  const notificationId = text(formData.get("notification_id"));

  if (!notificationId) {
    redirect("/investor");
  }

  try {
    const { client, user } = await getSessionContext();

    await client
      .from("notifications")
      .update({
        read_at: nowIso(),
      })
      .eq("id", notificationId);

    await emitEvent({
      companyId: text(user.user_metadata?.company_id) || "",
      actorId: user.id,
      recipients: [user.id],
      type: "investor_notification_read",
      title: "Notification read",
      message: "An investor notification was marked as read.",
      actionUrl: "/investor",
      metadata: {
        notificationId,
      },
    });
  } catch {
    // Avoid blocking route.
  }

  revalidatePath("/investor");
  redirect("/investor");
}

export async function signOutInvestor(): Promise<void> {
  const supabase = await createClient();

  await supabase.auth.signOut();

  redirect("/investor/login");
}

