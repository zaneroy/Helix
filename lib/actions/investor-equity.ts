"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { emitEvent } from "@/lib/events/emitEvent";
import type {
  ActionResult,
  AdminInvestorCapitalRequest,
  CancelEquityOfferInput,
  CashAccountOption,
  CompleteEquityOfferInput,
  CreateEquityOfferInput,
  CreateFounderCapitalContributionInput,
  EquityCertificate,
  EquityDealType,
  EquityFinanceSnapshot,
  EquityOffer,
  EquityOfferPreview,
  EquityOfferStatus,
  EquityOwnerRow,
  EquityTrendPoint,
  InvestorCapitalRequestStatus,
  InvestorEquityReadModel,
  InvestorOption,
  JsonRecord,
  MoneyRecipient,
  PreviewEquityOfferInput,
  ReviewInvestorCapitalRequestInput,
  UUID,
} from "@/types/investor-equity";

function nowIso(): string {
  return new Date().toISOString();
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function requireId(value: unknown, label: string): string {
  const id = cleanText(value);

  if (!id) {
    throw new Error(`${label} is required.`);
  }

  return id;
}

function requirePositiveNumber(value: unknown, label: string): number {
  const parsed = numberValue(value);

  if (parsed <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }

  return parsed;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;

  return Math.min(Math.max(value, 0), 100);
}

function normalizeError(error: unknown): ActionResult<never> {
  return {
    ok: false,
    error:
      error instanceof Error
        ? error.message
        : "Something went wrong while updating investors.",
  };
}

function revalidateInvestorPaths(): void {
  revalidatePath("/dashboard/investors");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");
  revalidatePath("/investor");
  revalidatePath("/investor/investments");
  revalidatePath("/investor/documents");
}

function investorName(investor?: InvestorOption | null): string {
  return (
    cleanText(investor?.full_name) ||
    cleanText(investor?.email) ||
    "Investor"
  );
}

async function readCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id || null;
}

function currencyLabel(amount: number, currency = "GBP"): string {
  const code = cleanText(currency).toUpperCase() || "GBP";
  const symbol =
    code === "GBP" ? "£" :
    code === "USD" ? "$" :
    code === "EUR" ? "€" :
    code === "CAD" ? "C$" :
    `${code} `;

  return `${symbol}${numberValue(amount).toFixed(2)}`;
}

function distinctRecipients(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => cleanText(value))
        .filter(Boolean),
    ),
  );
}

async function writeInvestorActivity(input: {
  companyId: string;
  investorId?: string | null;
  type: string;
  title: string;
  description: string;
}): Promise<void> {
  try {
    const supabase = await createClient();
    const client = supabase as any;

    await client.from("investor_activity").insert({
      company_id: input.companyId,
      investor_id: input.investorId || null,
      type: input.type,
      title: input.title,
      description: input.description,
    });
  } catch {
    // Activity should never block the actual investor transaction.
  }
}

async function emitInvestorNotification(input: {
  companyId: string;
  actorId?: string | null;
  investorId?: string | null;
  type: string;
  title: string;
  message: string;
  metadata?: JsonRecord;
}): Promise<void> {
  try {
    const actorId = cleanText(input.actorId);
    const recipients = distinctRecipients([actorId, input.investorId]);

    if (!actorId || !recipients.length) {
      return;
    }

    await emitEvent({
      companyId: input.companyId,
      actorId,
      recipients,
      type: input.type,
      title: input.title,
      message: input.message,
      actionUrl: "/dashboard/investors",
      metadata: input.metadata || {},
    });
  } catch {
    // Notifications should never block the actual investor transaction.
  }
}

async function readInvestorNameForNotification(
  companyId: string,
  investorId: string,
): Promise<string> {
  try {
    const supabase = await createClient();
    const client = supabase as any;

    const { data } = await client
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", investorId)
      .eq("company_id", companyId)
      .maybeSingle();

    const row = (data || {}) as JsonRecord;

    return (
      cleanText(row.full_name) ||
      cleanText(row.email) ||
      "Investor"
    );
  } catch {
    return "Investor";
  }
}


async function readCompanyDetails(
  companyId: string,
  fallbackCurrency: string,
): Promise<{ companyName: string; currency: string }> {
  const supabase = await createClient();
  const client = supabase as any;

  const { data } = await client
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();

  const row = (data || {}) as JsonRecord;
  const companyName =
    cleanText(row.legal_name) ||
    cleanText(row.company_name) ||
    cleanText(row.name) ||
    cleanText(row.business_name) ||
    cleanText(row.trading_name) ||
    "Your Company";

  return {
    companyName,
    currency: cleanText(row.currency) || fallbackCurrency,
  };
}

function statusValue(value: unknown): EquityOfferStatus {
  const status = cleanText(value).toLowerCase();

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
    return status as EquityOfferStatus;
  }

  if (status === "active" || status === "paid") return "completed";

  return "pending";
}

function capitalRequestStatusValue(value: unknown): InvestorCapitalRequestStatus {
  const status = cleanText(value).toLowerCase();

  if (["pending", "approved", "rejected", "completed", "cancelled"].includes(status)) {
    return status as InvestorCapitalRequestStatus;
  }

  return "pending";
}

function capitalRequestTypeLabel(value: unknown): string {
  return cleanText(value).toLowerCase() === "withdrawal_request"
    ? "Withdrawal request"
    : "Capital in request";
}

function isCompletedStatus(value: unknown): boolean {
  const status = statusValue(value);

  return status === "completed" || status === "payment_received";
}

type OfferMetadata = {
  title?: string | null;
  note?: string | null;
  dealType?: EquityDealType;
  moneyRecipient?: MoneyRecipient;
  destinationAccountId?: string | null;
  destinationAccountName?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
};

function parseOfferMetadata(notes: unknown): OfferMetadata {
  const raw = cleanText(notes);

  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const dealType: EquityDealType =
      parsed.dealType === "founder_sale" || parsed.deal_type === "founder_sale"
        ? "founder_sale"
        : "company_raise";

    return {
      title: cleanText(parsed.title) || null,
      note: cleanText(parsed.note) || cleanText(parsed.description) || null,
      dealType,
      moneyRecipient:
        parsed.moneyRecipient === "founder_admin" ||
        parsed.money_recipient === "founder_admin" ||
        dealType === "founder_sale"
          ? "founder_admin"
          : "company",
      destinationAccountId:
        cleanText(parsed.destinationAccountId || parsed.destination_account_id) ||
        null,
      destinationAccountName:
        cleanText(parsed.destinationAccountName || parsed.destination_account_name) ||
        null,
      createdAt: cleanText(parsed.createdAt || parsed.created_at) || null,
      completedAt: cleanText(parsed.completedAt || parsed.completed_at) || null,
    };
  } catch {
    return {
      note: raw,
    };
  }
}

function offerMetadataString(input: {
  title?: string | null;
  note?: string | null;
  dealType: EquityDealType;
  moneyRecipient: MoneyRecipient;
  destinationAccountId?: string | null;
  destinationAccountName?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
}) {
  return JSON.stringify({
    helix_model: "simple_percentage_equity",
    title: cleanText(input.title) || null,
    note: cleanText(input.note) || null,
    dealType: input.dealType,
    moneyRecipient: input.moneyRecipient,
    destinationAccountId: input.destinationAccountId || null,
    destinationAccountName: input.destinationAccountName || null,
    createdAt: input.createdAt || nowIso(),
    completedAt: input.completedAt || null,
  });
}

function impliedPostMoney(amount: number, equityPercent: number): number {
  if (amount <= 0 || equityPercent <= 0) return 0;

  return amount / (equityPercent / 100);
}

async function readInvestors(companyId: string): Promise<InvestorOption[]> {
  const supabase = await createClient();
  const client = supabase as any;

  const { data, error } = await client
    .from("profiles")
    .select("id, full_name, email, access_status")
    .eq("company_id", companyId)
    .eq("role", "investor")
    .order("full_name", { ascending: true });

  if (error) throw new Error(error.message);

  return ((Array.isArray(data) ? data : []) as JsonRecord[]).map((row) => ({
    id: String(row.id),
    full_name: cleanText(row.full_name) || null,
    email: cleanText(row.email) || null,
    access_status: cleanText(row.access_status) || null,
  }));
}

async function readInvestments(companyId: string): Promise<JsonRecord[]> {
  const supabase = await createClient();
  const client = supabase as any;

  const { data, error } = await client
    .from("investments")
    .select("id, company_id, investor_id, amount, equity_percent, investment_date, status, notes")
    .eq("company_id", companyId)
    .order("investment_date", { ascending: false });

  if (error) throw new Error(error.message);

  return (Array.isArray(data) ? data : []) as JsonRecord[];
}

async function readCapitalRequests(companyId: string): Promise<JsonRecord[]> {
  const supabase = await createClient();
  const client = supabase as any;

  try {
    const { data, error } = await client
      .from("investor_capital_requests")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return [];

    return (Array.isArray(data) ? data : []) as JsonRecord[];
  } catch {
    return [];
  }
}

function buildCapitalRequests(
  rows: JsonRecord[],
  investors: InvestorOption[],
): AdminInvestorCapitalRequest[] {
  const investorMap = new Map(investors.map((investor) => [investor.id, investor]));

  return rows.map((row) => {
    const investorId = cleanText(row.investor_id);
    const investor = investorMap.get(investorId);

    return {
      id: cleanText(row.id),
      companyId: cleanText(row.company_id),
      investorId,
      investorName: investorName(investor),
      investorEmail: investor?.email || null,
      requestType:
        cleanText(row.request_type).toLowerCase() === "withdrawal_request"
          ? "withdrawal_request"
          : "capital_in",
      amount: numberValue(row.amount),
      currency: cleanText(row.currency) || "GBP",
      notes: cleanText(row.notes) || null,
      status: capitalRequestStatusValue(row.status),
      adminNote: cleanText(row.admin_note) || null,
      reviewedBy: cleanText(row.reviewed_by) || null,
      reviewedAt: cleanText(row.reviewed_at) || null,
      completedAt: cleanText(row.completed_at) || null,
      createdAt: cleanText(row.created_at) || null,
      updatedAt: cleanText(row.updated_at) || null,
    };
  });
}

async function readCashAccounts(companyId: string): Promise<JsonRecord[]> {
  const supabase = await createClient();
  const client = supabase as any;

  const { data, error } = await client
    .from("cash_accounts")
    .select("id, company_id, name, account_type, currency, opening_balance, status, notes, created_at")
    .eq("company_id", companyId)
    .order("status", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (Array.isArray(data) ? data : []) as JsonRecord[];
}

async function readCashLedger(companyId: string): Promise<JsonRecord[]> {
  const supabase = await createClient();
  const client = supabase as any;

  const { data, error } = await client
    .from("cash_ledger")
    .select("id, company_id, account_id, source_type, source_id, direction, amount, category, description, reference, transaction_date, status, reconciled, created_by, created_at, metadata")
    .eq("company_id", companyId)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw new Error(error.message);

  return (Array.isArray(data) ? data : []) as JsonRecord[];
}

function isCompletedLedger(row: JsonRecord): boolean {
  return cleanText(row.status).toLowerCase() === "completed";
}

function buildCashAccounts(
  accountRows: JsonRecord[],
  ledgerRows: JsonRecord[],
): CashAccountOption[] {
  const balances = new Map<string, number>();

  for (const account of accountRows) {
    balances.set(String(account.id), numberValue(account.opening_balance));
  }

  for (const row of ledgerRows) {
    const accountId = cleanText(row.account_id);

    if (!accountId || !isCompletedLedger(row)) continue;

    const current = balances.get(accountId) ?? 0;
    const amount = numberValue(row.amount);
    const direction = cleanText(row.direction).toLowerCase();

    if (direction === "inflow") {
      balances.set(accountId, current + amount);
    }

    if (direction === "outflow") {
      balances.set(accountId, current - amount);
    }
  }

  return accountRows.map((account) => ({
    id: String(account.id),
    name: cleanText(account.name) || "Account",
    accountType: cleanText(account.account_type) || "account",
    currency: cleanText(account.currency) || "USD",
    status: cleanText(account.status) || "active",
    openingBalance: numberValue(account.opening_balance),
    balance: balances.get(String(account.id)) ?? 0,
  }));
}

function ledgerCategory(row: JsonRecord): string {
  return [row.source_type, row.category, row.description]
    .map((value) => cleanText(value).toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function sumLedgerRows(
  rows: JsonRecord[],
  matcher: (row: JsonRecord, haystack: string) => boolean,
): number {
  return rows.reduce((sum, row) => {
    if (!isCompletedLedger(row)) return sum;
    if (cleanText(row.direction).toLowerCase() !== "inflow") return sum;

    const haystack = ledgerCategory(row);

    return matcher(row, haystack) ? sum + numberValue(row.amount) : sum;
  }, 0);
}

type TrendBucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

function safeDate(value: unknown): Date | null {
  const raw = cleanText(value);

  if (!raw) return null;

  const date = new Date(raw);

  return Number.isNaN(date.getTime()) ? null : date;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  return months[date.getUTCMonth()] || "";
}

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

function trendPoint(bucket: TrendBucket, value: number): EquityTrendPoint {
  return {
    key: bucket.key,
    label: bucket.label,
    value,
  };
}

function ledgerDate(row: JsonRecord): Date | null {
  return safeDate(row.transaction_date) || safeDate(row.created_at);
}

function investmentDate(row: JsonRecord): Date | null {
  const metadata = parseOfferMetadata(row.notes);

  return (
    safeDate(metadata.completedAt) ||
    safeDate(row.investment_date) ||
    safeDate(metadata.createdAt)
  );
}

function isSalesLedgerRow(row: JsonRecord): boolean {
  const haystack = ledgerCategory(row);

  return (
    haystack.includes("sale") ||
    haystack.includes("sales") ||
    haystack.includes("invoice payment")
  );
}

function isFounderCapitalLedgerRow(row: JsonRecord): boolean {
  const haystack = ledgerCategory(row);

  return (
    haystack.includes("founder_capital") ||
    haystack.includes("founder capital") ||
    haystack.includes("admin capital") ||
    haystack.includes("owner capital")
  );
}

function buildMonthlySalesTrend(
  ledgerRows: JsonRecord[],
  buckets: TrendBucket[],
): EquityTrendPoint[] {
  return buckets.map((bucket) => {
    const value = ledgerRows.reduce((sum, row) => {
      if (!isCompletedLedger(row)) return sum;
      if (cleanText(row.direction).toLowerCase() !== "inflow") return sum;
      if (!isSalesLedgerRow(row)) return sum;

      const date = ledgerDate(row);

      if (!date || date < bucket.start || date > bucket.end) return sum;

      return sum + numberValue(row.amount);
    }, 0);

    return trendPoint(bucket, value);
  });
}

function buildCashTrend(
  accountRows: JsonRecord[],
  ledgerRows: JsonRecord[],
  buckets: TrendBucket[],
): EquityTrendPoint[] {
  const activeAccounts = accountRows.filter((account) => {
    const status = cleanText(account.status).toLowerCase();

    return !status || status === "active";
  });
  const activeAccountIds = new Set(activeAccounts.map((account) => String(account.id)));
  const openingBalance = activeAccounts.reduce(
    (sum, account) => sum + numberValue(account.opening_balance),
    0,
  );

  return buckets.map((bucket) => {
    const value = ledgerRows.reduce((sum, row) => {
      const accountId = cleanText(row.account_id);

      if (!accountId || !activeAccountIds.has(accountId)) return sum;
      if (!isCompletedLedger(row)) return sum;

      const date = ledgerDate(row);

      if (!date || date > bucket.end) return sum;

      const amount = numberValue(row.amount);
      const direction = cleanText(row.direction).toLowerCase();

      if (direction === "inflow") return sum + amount;
      if (direction === "outflow") return sum - amount;

      return sum;
    }, openingBalance);

    return trendPoint(bucket, value);
  });
}

function buildFounderCapitalTrend(
  ledgerRows: JsonRecord[],
  buckets: TrendBucket[],
): EquityTrendPoint[] {
  return buckets.map((bucket) => {
    const value = ledgerRows.reduce((sum, row) => {
      if (!isCompletedLedger(row)) return sum;
      if (cleanText(row.direction).toLowerCase() !== "inflow") return sum;
      if (!isFounderCapitalLedgerRow(row)) return sum;

      const date = ledgerDate(row);

      if (!date || date > bucket.end) return sum;

      return sum + numberValue(row.amount);
    }, 0);

    return trendPoint(bucket, value);
  });
}

function buildCompanyCapitalRaisedTrend(
  investmentRows: JsonRecord[],
  buckets: TrendBucket[],
): EquityTrendPoint[] {
  return buckets.map((bucket) => {
    const value = investmentRows.reduce((sum, row) => {
      if (!isCompletedStatus(row.status)) return sum;

      const metadata = parseOfferMetadata(row.notes);
      const dealType: EquityDealType = metadata.dealType || "company_raise";

      if (dealType === "founder_sale") return sum;

      const date = investmentDate(row);

      if (!date || date > bucket.end) return sum;

      return sum + numberValue(row.amount);
    }, 0);

    return trendPoint(bucket, value);
  });
}

function buildCompanyValueTrend(input: {
  investmentRows: JsonRecord[];
  cashTrend: EquityTrendPoint[];
  capitalRaisedTrend: EquityTrendPoint[];
  founderCapitalTrend: EquityTrendPoint[];
  buckets: TrendBucket[];
}): EquityTrendPoint[] {
  return input.buckets.map((bucket, index) => {
    let latestImpliedValue = 0;
    let latestImpliedAt = 0;

    for (const row of input.investmentRows) {
      if (!isCompletedStatus(row.status)) continue;

      const date = investmentDate(row);

      if (!date || date > bucket.end) continue;

      const valuation = impliedPostMoney(
        numberValue(row.amount),
        numberValue(row.equity_percent),
      );
      const timestamp = date.getTime();

      if (valuation > 0 && timestamp >= latestImpliedAt) {
        latestImpliedValue = valuation;
        latestImpliedAt = timestamp;
      }
    }

    const capitalPool =
      (input.capitalRaisedTrend[index]?.value ?? 0) +
      (input.founderCapitalTrend[index]?.value ?? 0);
    const cash = input.cashTrend[index]?.value ?? 0;

    return trendPoint(bucket, Math.max(latestImpliedValue, capitalPool, cash));
  });
}

function emptyTrend(): EquityTrendPoint[] {
  return buildTrendBuckets(12).map((bucket) => trendPoint(bucket, 0));
}

function buildEquityTrends(input: {
  accountRows: JsonRecord[];
  ledgerRows: JsonRecord[];
  investmentRows: JsonRecord[];
}) {
  try {
    const buckets = buildTrendBuckets(12);
    const companyCash = buildCashTrend(input.accountRows, input.ledgerRows, buckets);
    const companySales = buildMonthlySalesTrend(input.ledgerRows, buckets);
    const companyCapitalRaised = buildCompanyCapitalRaisedTrend(input.investmentRows, buckets);
    const founderCapital = buildFounderCapitalTrend(input.ledgerRows, buckets);
    const companyValue = buildCompanyValueTrend({
      investmentRows: input.investmentRows,
      cashTrend: companyCash,
      capitalRaisedTrend: companyCapitalRaised,
      founderCapitalTrend: founderCapital,
      buckets,
    });

    return {
      companyValue,
      companyCash,
      companySales,
      companyCapitalRaised,
    };
  } catch {
    return {
      companyValue: emptyTrend(),
      companyCash: emptyTrend(),
      companySales: emptyTrend(),
      companyCapitalRaised: emptyTrend(),
    };
  }
}


async function readActiveAccount(
  companyId: string,
  accountId: string,
): Promise<{ id: string; name: string; currency: string; account_type: string } | null> {
  const supabase = await createClient();
  const client = supabase as any;

  const { data, error } = await client
    .from("cash_accounts")
    .select("id, name, currency, account_type, status")
    .eq("id", accountId)
    .eq("company_id", companyId)
    .eq("status", "active")
    .single();

  if (error || !data) return null;

  return {
    id: String(data.id),
    name: cleanText(data.name) || "Account",
    currency: cleanText(data.currency) || "USD",
    account_type: cleanText(data.account_type) || "account",
  };
}

async function createCashLedgerInflow(input: {
  companyId: string;
  accountId: string;
  amount: number;
  category: string;
  description: string;
  sourceType: string;
  sourceId: string;
  referencePrefix: string;
  metadata?: JsonRecord;
}): Promise<ActionResult<{ id: string }>> {
  const account = await readActiveAccount(input.companyId, input.accountId);

  if (!account) {
    return {
      ok: false,
      error: "Select an active company account for this money.",
    };
  }

  const supabase = await createClient();
  const client = supabase as any;
  const userId = await readCurrentUserId();
  const ledgerId = randomUUID();
  const reference = `${input.referencePrefix}-${ledgerId.slice(0, 8).toUpperCase()}`;

  const { error } = await client.from("cash_ledger").insert({
    id: ledgerId,
    company_id: input.companyId,
    account_id: account.id,
    category_id: null,
    source_type: input.sourceType,
    source_id: input.sourceId,
    direction: "inflow",
    amount: input.amount,
    category: input.category,
    description: input.description,
    reference,
    transaction_date: nowIso(),
    status: "completed",
    reconciled: false,
    created_by: userId,
    metadata: {
      ...(input.metadata || {}),
      accountId: account.id,
      accountName: account.name,
      accountType: account.account_type,
      reference,
    },
  });

  if (error) {
    return {
      ok: false,
      error: error.message,
    };
  }

  return {
    ok: true,
    data: {
      id: ledgerId,
    },
  };
}

function buildOfferFromInvestment(
  row: JsonRecord,
  investorMap: Map<string, InvestorOption>,
  currency: string,
  founderEquityBefore: number,
  investorEquityBefore: number,
): EquityOffer {
  const investorId = String(row.investor_id ?? "");
  const investor = investorMap.get(investorId);
  const metadata = parseOfferMetadata(row.notes);
  const amount = numberValue(row.amount);
  const equityPercent = numberValue(row.equity_percent);
  const status = statusValue(row.status);
  const dealType: EquityDealType = metadata.dealType || "company_raise";
  const moneyRecipient: MoneyRecipient =
    metadata.moneyRecipient ||
    (dealType === "founder_sale" ? "founder_admin" : "company");
  const companyReceives = moneyRecipient === "company" ? amount : 0;
  const founderReceives = moneyRecipient === "founder_admin" ? amount : 0;
  const postMoney = impliedPostMoney(amount, equityPercent);

  return {
    id: String(row.id),
    investorId,
    investorName: investorName(investor),
    investorEmail: investor?.email ?? null,
    dealType,
    moneyRecipient,
    destinationAccountId: metadata.destinationAccountId || null,
    destinationAccountName: metadata.destinationAccountName || null,
    amount,
    equityPercent,
    currency,
    status,
    title:
      metadata.title ||
      (dealType === "founder_sale"
        ? "Founder/Admin equity sale"
        : "Company equity offer"),
    note: metadata.note || null,
    createdAt: metadata.createdAt || cleanText(row.investment_date) || null,
    completedAt: metadata.completedAt || null,
    companyReceives,
    founderReceives,
    impliedPostMoneyValuation: postMoney,
    founderEquityBefore,
    founderEquityAfter: clampPercent(founderEquityBefore - equityPercent),
    investorEquityBefore,
    investorEquityAfter: clampPercent(investorEquityBefore + equityPercent),
    canComplete: ["pending", "sent", "accepted", "payment_received"].includes(status),
    canCancel: !["completed", "cancelled", "rejected"].includes(status),
    canDownloadOfferPdf: true,
    canDownloadAgreementPdf: true,
    canDownloadCertificatePdf: status === "completed",
  };
}

export async function getInvestorEquityReadModel(
  companyId: UUID,
  currency = "USD",
): Promise<ActionResult<InvestorEquityReadModel>> {
  try {
    const id = requireId(companyId, "Company ID");
    const [companyDetails, investors, investments, accountRows, ledgerRows, capitalRequestRows] =
      await Promise.all([
        readCompanyDetails(id, currency),
        readInvestors(id),
        readInvestments(id),
        readCashAccounts(id),
        readCashLedger(id),
        readCapitalRequests(id),
      ]);
    const documentCurrency = companyDetails.currency || currency;
    const cashAccounts = buildCashAccounts(accountRows, ledgerRows);
    const activeCashAccounts = cashAccounts.filter((account) => account.status === "active");
    const companyCash = activeCashAccounts.reduce((sum, account) => sum + account.balance, 0);
    const companySales = sumLedgerRows(ledgerRows, (_row, haystack) =>
      haystack.includes("sale") || haystack.includes("sales") || haystack.includes("invoice payment"),
    );
    const founderCapitalContributed = sumLedgerRows(ledgerRows, (_row, haystack) =>
      haystack.includes("founder_capital") ||
      haystack.includes("founder capital") ||
      haystack.includes("admin capital") ||
      haystack.includes("owner capital"),
    );

    const investorMap = new Map(investors.map((investor) => [investor.id, investor]));
    const completedRows = investments.filter((row) => isCompletedStatus(row.status));
    const pendingRows = investments.filter((row) => !isCompletedStatus(row.status));
    const equityByInvestor = new Map<string, number>();
    const capitalByInvestor = new Map<string, number>();
    const founderPurchaseByInvestor = new Map<string, number>();
    const completedOffersByInvestor = new Map<string, number>();

    let companyCapitalRaised = 0;
    let founderSaleProceeds = 0;
    let lastPostMoney = 0;
    let lastPostMoneyAt = 0;

    for (const row of completedRows) {
      const investorId = String(row.investor_id ?? "");
      const metadata = parseOfferMetadata(row.notes);
      const dealType: EquityDealType = metadata.dealType || "company_raise";
      const amount = numberValue(row.amount);
      const equityPercent = numberValue(row.equity_percent);

      equityByInvestor.set(
        investorId,
        (equityByInvestor.get(investorId) ?? 0) + equityPercent,
      );
      completedOffersByInvestor.set(
        investorId,
        (completedOffersByInvestor.get(investorId) ?? 0) + 1,
      );

      if (dealType === "founder_sale") {
        founderSaleProceeds += amount;
        founderPurchaseByInvestor.set(
          investorId,
          (founderPurchaseByInvestor.get(investorId) ?? 0) + amount,
        );
      } else {
        companyCapitalRaised += amount;
        capitalByInvestor.set(
          investorId,
          (capitalByInvestor.get(investorId) ?? 0) + amount,
        );
      }

      const valuation = impliedPostMoney(amount, equityPercent);
      const valuationDate = investmentDate(row)?.getTime() ?? 0;

      if (valuation > 0 && valuationDate >= lastPostMoneyAt) {
        lastPostMoney = valuation;
        lastPostMoneyAt = valuationDate;
      }
    }

    const investorEquityPercent = Array.from(equityByInvestor.values()).reduce(
      (sum, value) => sum + value,
      0,
    );
    const founderEquityPercent = clampPercent(100 - investorEquityPercent);
    const capitalPool = founderCapitalContributed + companyCapitalRaised;
    const estimatedCompanyValue = Math.max(lastPostMoney, capitalPool, companyCash);

    const owners: EquityOwnerRow[] = [
      {
        id: "founder_admin",
        ownerType: "founder_admin",
        name: "Founder/Admin",
        email: null,
        equityPercent: founderEquityPercent,
        capitalContributed: founderCapitalContributed,
        founderPurchaseAmount: 0,
        founderSaleProceeds,
        totalInvested: founderCapitalContributed,
        activeOfferCount: completedRows.length,
      },
      ...investors
        .map((investor) => ({
          id: investor.id,
          ownerType: "investor" as const,
          name: investorName(investor),
          email: investor.email ?? null,
          equityPercent: equityByInvestor.get(investor.id) ?? 0,
          capitalContributed: capitalByInvestor.get(investor.id) ?? 0,
          founderPurchaseAmount: founderPurchaseByInvestor.get(investor.id) ?? 0,
          founderSaleProceeds: 0,
          totalInvested:
            (capitalByInvestor.get(investor.id) ?? 0) +
            (founderPurchaseByInvestor.get(investor.id) ?? 0),
          activeOfferCount: completedOffersByInvestor.get(investor.id) ?? 0,
        }))
        .sort((a, b) => b.equityPercent - a.equityPercent),
    ];

    const offers: EquityOffer[] = investments.map((row) => {
      const investorId = String(row.investor_id ?? "");
      const investorExisting = equityByInvestor.get(investorId) ?? 0;

      return buildOfferFromInvestment(
        row,
        investorMap,
        documentCurrency,
        founderEquityPercent,
        investorExisting,
      );
    });

    const certificates: EquityCertificate[] = offers
      .filter((offer) => offer.status === "completed")
      .map((offer) => ({
        id: offer.id,
        certificateNumber: `EQT-${offer.id.slice(0, 8).toUpperCase()}`,
        investorId: offer.investorId,
        investorName: offer.investorName,
        investorEmail: offer.investorEmail ?? null,
        equityPercent: offer.equityPercent,
        amount: offer.amount,
        currency: offer.currency || documentCurrency,
        issuedAt: offer.completedAt || offer.createdAt || null,
        sourceOfferId: offer.id,
        canDownloadPdf: true,
      }));

    const capitalRequests = buildCapitalRequests(capitalRequestRows, investors);

    const warnings: string[] = [];

    if (investorEquityPercent > 100) {
      warnings.push("Investor equity is above 100%. Review completed investment records.");
    }

    if (!activeCashAccounts.length) {
      warnings.push("Add an active company account before completing company investment offers.");
    }

    const finance: EquityFinanceSnapshot = {
      cashInAccounts: companyCash,
      companySales,
      founderCapitalContributed,
      investorCapitalContributed: companyCapitalRaised,
      capitalPool,
      estimatedCompanyValue,
      activeAccountCount: activeCashAccounts.length,
    };

    const trends = buildEquityTrends({
      accountRows,
      ledgerRows,
      investmentRows: investments,
    });

    const summary = {
      companyId: id,
      companyName: companyDetails.companyName,
      currency: documentCurrency,
      founderEquityPercent,
      investorEquityPercent,
      companyCapitalRaised,
      founderCapitalContributed,
      founderSaleProceeds,
      companySales,
      companyCash,
      capitalPool,
      estimatedCompanyValue,
      impliedPostMoneyValuation: lastPostMoney,
      completedInvestorCount: Array.from(equityByInvestor.keys()).length,
      pendingOfferCount: pendingRows.length,
      canCreateOffer: founderEquityPercent > 0 && investors.length > 0,
      warnings,
    };

    return {
      ok: true,
      data: {
        companyId: id,
        companyName: companyDetails.companyName,
        currency: documentCurrency,
        refreshedAt: nowIso(),
        summary,
        finance,
        trends,
        investors,
        cashAccounts,
        owners,
        offers,
        certificates,
        capitalRequests,
        raw: {
          investors: investors as unknown as JsonRecord[],
          investments,
          cashAccounts: accountRows,
          cashLedger: ledgerRows,
          capitalRequests: capitalRequestRows,
        },
        warnings,
      },
    };
  } catch (error) {
    return normalizeError(error);
  }
}

export async function reviewInvestorCapitalRequest(
  input: ReviewInvestorCapitalRequestInput,
): Promise<ActionResult<{ requestId: UUID; status: InvestorCapitalRequestStatus }>> {
  try {
    const companyId = requireId(input.companyId, "Company ID");
    const requestId = requireId(input.requestId, "Capital request");
    const status = capitalRequestStatusValue(input.status);
    const adminNote = cleanText(input.adminNote).slice(0, 500) || null;
    const actorId = await readCurrentUserId();

    if (!["approved", "rejected", "completed", "cancelled"].includes(status)) {
      return {
        ok: false,
        error: "Choose approved, rejected, completed or cancelled.",
      };
    }

    const supabase = await createClient();
    const client = supabase as any;

    const patch: JsonRecord = {
      status,
      admin_note: adminNote,
      reviewed_by: actorId,
      reviewed_at: nowIso(),
    };

    if (status === "completed") {
      patch.completed_at = nowIso();
    }

    const { data, error } = await client
      .from("investor_capital_requests")
      .update(patch)
      .eq("id", requestId)
      .eq("company_id", companyId)
      .select("*")
      .single();

    if (error || !data) {
      return {
        ok: false,
        error: error?.message || "Could not update the capital request.",
      };
    }

    const row = data as JsonRecord;
    const investorId = cleanText(row.investor_id);
    const amount = numberValue(row.amount);
    const currency = cleanText(row.currency) || "GBP";
    const requestType = capitalRequestTypeLabel(row.request_type);
    const investor = await readInvestorNameForNotification(companyId, investorId);
    const message = `${requestType} for ${currencyLabel(amount, currency)} was marked ${status.replaceAll("_", " ")}.`;

    await writeInvestorActivity({
      companyId,
      investorId,
      type: "investor_capital_request_reviewed",
      title: `${requestType} ${status.replaceAll("_", " ")}`,
      description: `${investor}: ${message}`,
    });

    await emitInvestorNotification({
      companyId,
      actorId,
      investorId,
      type: "investor_capital_request_reviewed",
      title: `${requestType} ${status.replaceAll("_", " ")}`,
      message,
      metadata: {
        requestId,
        investorId,
        status,
        adminNote,
      },
    });

    revalidateInvestorPaths();

    return {
      ok: true,
      data: {
        requestId,
        status,
      },
    };
  } catch (error) {
    return normalizeError(error);
  }
}

export async function previewEquityOffer(
  input: PreviewEquityOfferInput,
): Promise<ActionResult<EquityOfferPreview>> {
  try {
    const companyId = requireId(input.companyId, "Company ID");
    const investorId = requireId(input.investorId, "Investor");
    const amount = requirePositiveNumber(input.amount, "Investment amount");
    const equityPercent = requirePositiveNumber(input.equityPercent, "Equity percentage");
    const currency = cleanText(input.currency) || "USD";
    const dealType: EquityDealType =
      input.dealType === "founder_sale" ? "founder_sale" : "company_raise";
    const moneyRecipient: MoneyRecipient =
      dealType === "founder_sale" ? "founder_admin" : "company";

    const readModel = await getInvestorEquityReadModel(companyId, currency);

    if (!readModel.ok || !readModel.data) {
      return {
        ok: false,
        error: readModel.error || "Could not load current ownership.",
      };
    }

    const current = readModel.data;
    const investor = current.investors.find((item) => item.id === investorId);

    if (!investor) {
      return {
        ok: false,
        error: "Investor not found.",
      };
    }

    const destinationAccount = input.destinationAccountId
      ? current.cashAccounts.find(
          (account) => account.id === input.destinationAccountId && account.status === "active",
        )
      : null;

    const existingInvestorEquity =
      current.owners.find((owner) => owner.id === investorId)?.equityPercent ?? 0;
    const founderBefore = current.summary.founderEquityPercent;
    const founderAfter = clampPercent(founderBefore - equityPercent);
    const investorAfter = clampPercent(existingInvestorEquity + equityPercent);
    const companyReceives = moneyRecipient === "company" ? amount : 0;
    const founderReceives = moneyRecipient === "founder_admin" ? amount : 0;
    const postMoney = impliedPostMoney(amount, equityPercent);
    const blockingReasons: string[] = [];
    const warnings: string[] = [];

    if (equityPercent > founderBefore) {
      blockingReasons.push(`Only ${founderBefore.toFixed(2)}% equity is currently available.`);
    }

    if (equityPercent >= 100) {
      blockingReasons.push("An investor offer cannot be 100% or more.");
    }

    if (dealType === "company_raise" && !destinationAccount) {
      blockingReasons.push("Select the company account where the investor money will be received.");
    }

    if (dealType === "founder_sale") {
      warnings.push("Founder/Admin receives the money. Company cash and company capital raised will not increase.");
    }

    return {
      ok: true,
      data: {
        dealType,
        moneyRecipient,
        investorId,
        investorName: investorName(investor),
        destinationAccountId: destinationAccount?.id ?? null,
        destinationAccountName: destinationAccount?.name ?? null,
        amount,
        equityPercent,
        currency: current.currency,
        companyReceives,
        founderReceives,
        founderEquityBefore: founderBefore,
        founderEquityAfter: founderAfter,
        investorEquityBefore: existingInvestorEquity,
        investorEquityAfter: investorAfter,
        investorEquityExisting: existingInvestorEquity,
        investorEquityTotalAfter: investorAfter,
        companyCapitalBefore: current.summary.companyCapitalRaised,
        companyCapitalAfter: current.summary.companyCapitalRaised + companyReceives,
        founderSaleProceedsBefore: current.summary.founderSaleProceeds,
        founderSaleProceedsAfter: current.summary.founderSaleProceeds + founderReceives,
        impliedPostMoneyValuation: postMoney,
        impliedPreMoneyValuation: Math.max(postMoney - amount, 0),
        rows: [
          {
            id: "founder_admin",
            ownerType: "founder_admin",
            name: "Founder/Admin",
            equityBefore: founderBefore,
            equityChange: -equityPercent,
            equityAfter: founderAfter,
          },
          {
            id: investorId,
            ownerType: "investor",
            name: investorName(investor),
            equityBefore: existingInvestorEquity,
            equityChange: equityPercent,
            equityAfter: investorAfter,
          },
        ],
        warnings,
        blockingReasons,
      },
    };
  } catch (error) {
    return normalizeError(error);
  }
}

export async function createEquityOffer(
  input: CreateEquityOfferInput,
): Promise<ActionResult<EquityOffer>> {
  try {
    const companyId = requireId(input.companyId, "Company ID");
    const investorId = requireId(input.investorId, "Investor");
    const amount = requirePositiveNumber(input.amount, "Investment amount");
    const equityPercent = requirePositiveNumber(input.equityPercent, "Equity percentage");
    const currency = cleanText(input.currency) || "USD";
    const dealType: EquityDealType =
      input.dealType === "founder_sale" ? "founder_sale" : "company_raise";
    const moneyRecipient: MoneyRecipient =
      dealType === "founder_sale" ? "founder_admin" : "company";

    const preview = await previewEquityOffer({
      companyId,
      investorId,
      amount,
      equityPercent,
      currency,
      dealType,
      destinationAccountId: input.destinationAccountId || null,
      title: input.title,
      note: input.note,
    });

    if (!preview.ok || !preview.data) {
      return {
        ok: false,
        error: preview.error || "Could not preview this offer.",
      };
    }

    if (preview.data.blockingReasons.length) {
      return {
        ok: false,
        error: preview.data.blockingReasons.join(" "),
      };
    }

    const supabase = await createClient();
    const client = supabase as any;
    const createdAt = nowIso();
    const title =
      cleanText(input.title) ||
      (dealType === "founder_sale"
        ? "Founder/Admin equity sale"
        : "Company equity offer");

    const { data, error } = await client
      .from("investments")
      .insert({
        company_id: companyId,
        investor_id: investorId,
        amount,
        equity_percent: equityPercent,
        investment_date: createdAt,
        status: "pending",
        notes: offerMetadataString({
          title,
          note: input.note,
          dealType,
          moneyRecipient,
          destinationAccountId: preview.data.destinationAccountId || null,
          destinationAccountName: preview.data.destinationAccountName || null,
          createdAt,
        }),
      })
      .select("id, company_id, investor_id, amount, equity_percent, investment_date, status, notes")
      .single();

    if (error) {
      return {
        ok: false,
        error: error.message,
      };
    }

    const actorId = await readCurrentUserId();
    const notificationMessage =
      dealType === "founder_sale"
        ? `${preview.data.investorName} was offered ${currencyLabel(amount, preview.data.currency)} for ${equityPercent.toFixed(2)}% equity. Funds go to Founder/Admin if completed.`
        : `${preview.data.investorName} was offered ${currencyLabel(amount, preview.data.currency)} for ${equityPercent.toFixed(2)}% equity. Funds will go to ${preview.data.destinationAccountName || "the selected company account"} if completed.`;

    await writeInvestorActivity({
      companyId,
      investorId,
      type: "equity_offer_created",
      title: "Equity offer created",
      description: notificationMessage,
    });

    await emitInvestorNotification({
      companyId,
      actorId,
      investorId,
      type: "investor_equity_offer_created",
      title: "Equity offer created",
      message: notificationMessage,
      metadata: {
        offerId: String(data.id),
        investorId,
        investorName: preview.data.investorName,
        amount,
        equityPercent,
        dealType,
        moneyRecipient,
        destinationAccountId: preview.data.destinationAccountId || null,
        destinationAccountName: preview.data.destinationAccountName || null,
        documentsReady: ["offer_pdf", "agreement_pdf"],
      },
    });

    revalidateInvestorPaths();

    return {
      ok: true,
      data: buildOfferFromInvestment(
        data as JsonRecord,
        new Map([[investorId, { id: investorId, full_name: preview.data.investorName }]]),
        preview.data.currency,
        preview.data.founderEquityBefore,
        preview.data.investorEquityBefore,
      ),
    };
  } catch (error) {
    return normalizeError(error);
  }
}

export async function completeEquityOffer(
  input: CompleteEquityOfferInput,
): Promise<ActionResult<{ id: UUID }>> {
  try {
    const companyId = requireId(input.companyId, "Company ID");
    const offerId = requireId(input.offerId, "Offer ID");
    const supabase = await createClient();
    const client = supabase as any;

    const { data: existing, error: existingError } = await client
      .from("investments")
      .select("id, company_id, investor_id, amount, equity_percent, investment_date, status, notes")
      .eq("id", offerId)
      .eq("company_id", companyId)
      .single();

    if (existingError || !existing) {
      return {
        ok: false,
        error: existingError?.message || "Offer not found.",
      };
    }

    const metadata = parseOfferMetadata(existing.notes);
    const dealType = metadata.dealType || "company_raise";
    const amount = numberValue(existing.amount);

    if (dealType === "company_raise") {
      const destinationAccountId = metadata.destinationAccountId;

      if (!destinationAccountId) {
        return {
          ok: false,
          error: "This offer has no destination account. Create a new offer and select where the money goes.",
        };
      }

      const { data: existingLedger } = await client
        .from("cash_ledger")
        .select("id")
        .eq("company_id", companyId)
        .eq("source_type", "investor_capital")
        .eq("source_id", offerId)
        .maybeSingle();

      if (!existingLedger) {
        const inflow = await createCashLedgerInflow({
          companyId,
          accountId: destinationAccountId,
          amount,
          category: "Investor Capital Contribution",
          description: `${metadata.title || "Investor capital contribution"}`,
          sourceType: "investor_capital",
          sourceId: offerId,
          referencePrefix: "INV",
          metadata: {
            investmentId: offerId,
            investorId: cleanText(existing.investor_id),
            equityPercent: numberValue(existing.equity_percent),
            dealType,
          },
        });

        if (!inflow.ok) {
          return {
            ok: false,
            error: inflow.error || "Could not record investor money in the company account.",
          };
        }
      }
    }

    const notes = offerMetadataString({
      title: metadata.title,
      note: metadata.note,
      dealType,
      moneyRecipient: metadata.moneyRecipient || (dealType === "founder_sale" ? "founder_admin" : "company"),
      destinationAccountId: metadata.destinationAccountId || null,
      destinationAccountName: metadata.destinationAccountName || null,
      createdAt: metadata.createdAt,
      completedAt: nowIso(),
    });

    const { error } = await client
      .from("investments")
      .update({
        status: "completed",
        notes,
      })
      .eq("id", offerId)
      .eq("company_id", companyId);

    if (error) {
      return {
        ok: false,
        error: error.message,
      };
    }

    const actorId = await readCurrentUserId();
    const investorId = cleanText(existing.investor_id);
    const investorName = await readInvestorNameForNotification(companyId, investorId);
    const equityPercent = numberValue(existing.equity_percent);
    const companyDetails = await readCompanyDetails(companyId, "GBP");
    const moneyRecipient =
      dealType === "founder_sale" ? "Founder/Admin" : (metadata.destinationAccountName || companyDetails.companyName);
    const notificationMessage =
      dealType === "founder_sale"
        ? `${investorName}'s founder equity purchase was completed: ${currencyLabel(amount, companyDetails.currency)} for ${equityPercent.toFixed(2)}%. Company cash did not change. Certificate PDF is ready.`
        : `${investorName}'s investment was completed: ${currencyLabel(amount, companyDetails.currency)} for ${equityPercent.toFixed(2)}%. Funds were recorded in ${moneyRecipient}. Certificate PDF is ready.`;

    await writeInvestorActivity({
      companyId,
      investorId,
      type: "equity_offer_completed",
      title: dealType === "founder_sale" ? "Founder equity sale completed" : "Investor capital completed",
      description: notificationMessage,
    });

    await emitInvestorNotification({
      companyId,
      actorId,
      investorId,
      type: "investor_equity_offer_completed",
      title: dealType === "founder_sale" ? "Founder equity sale completed" : "Investor capital completed",
      message: notificationMessage,
      metadata: {
        offerId,
        investorId,
        investorName,
        amount,
        equityPercent,
        dealType,
        moneyRecipient: dealType === "founder_sale" ? "founder_admin" : "company",
        destinationAccountId: metadata.destinationAccountId || null,
        destinationAccountName: metadata.destinationAccountName || null,
        certificateReady: true,
      },
    });

    revalidateInvestorPaths();

    return {
      ok: true,
      data: {
        id: offerId,
      },
    };
  } catch (error) {
    return normalizeError(error);
  }
}

export async function cancelEquityOffer(
  input: CancelEquityOfferInput,
): Promise<ActionResult<{ id: UUID }>> {
  try {
    const companyId = requireId(input.companyId, "Company ID");
    const offerId = requireId(input.offerId, "Offer ID");
    const supabase = await createClient();
    const client = supabase as any;

    const { data: existing } = await client
      .from("investments")
      .select("id, company_id, investor_id, amount, equity_percent, investment_date, status, notes")
      .eq("id", offerId)
      .eq("company_id", companyId)
      .maybeSingle();

    const { error } = await client
      .from("investments")
      .update({
        status: "cancelled",
      })
      .eq("id", offerId)
      .eq("company_id", companyId);

    if (error) {
      return {
        ok: false,
        error: error.message,
      };
    }

    const actorId = await readCurrentUserId();

    if (existing) {
      const investorId = cleanText(existing.investor_id);
      const investorName = await readInvestorNameForNotification(companyId, investorId);
      const metadata = parseOfferMetadata(existing.notes);
      const companyDetails = await readCompanyDetails(companyId, "GBP");
      const amount = numberValue(existing.amount);
      const equityPercent = numberValue(existing.equity_percent);
      const message = `${investorName}'s equity offer was cancelled: ${currencyLabel(amount, companyDetails.currency)} for ${equityPercent.toFixed(2)}%. Ownership was not changed.`;

      await writeInvestorActivity({
        companyId,
        investorId,
        type: "equity_offer_cancelled",
        title: "Equity offer cancelled",
        description: message,
      });

      await emitInvestorNotification({
        companyId,
        actorId,
        investorId,
        type: "investor_equity_offer_cancelled",
        title: "Equity offer cancelled",
        message,
        metadata: {
          offerId,
          investorId,
          investorName,
          amount,
          equityPercent,
          dealType: metadata.dealType || "company_raise",
        },
      });
    }

    revalidateInvestorPaths();

    return {
      ok: true,
      data: {
        id: offerId,
      },
    };
  } catch (error) {
    return normalizeError(error);
  }
}

export async function createFounderCapitalContribution(
  input: CreateFounderCapitalContributionInput,
): Promise<ActionResult<{ id: UUID }>> {
  try {
    const companyId = requireId(input.companyId, "Company ID");
    const accountId = requireId(input.destinationAccountId, "Destination account");
    const amount = requirePositiveNumber(input.amount, "Founder/Admin contribution");

    const inflow = await createCashLedgerInflow({
      companyId,
      accountId,
      amount,
      category: "Founder Capital Contribution",
      description: cleanText(input.note) || "Founder/Admin capital contribution",
      sourceType: "founder_capital",
      sourceId: randomUUID(),
      referencePrefix: "FND",
      metadata: {
        enteredFrom: "investors_page",
        contributionType: "founder_admin_capital",
        note: cleanText(input.note) || null,
      },
    });

    if (!inflow.ok) {
      return inflow;
    }

    const actorId = await readCurrentUserId();
    const account = await readActiveAccount(companyId, accountId);
    const companyDetails = await readCompanyDetails(companyId, cleanText(input.currency) || "GBP");
    const message = `Founder/Admin capital of ${currencyLabel(amount, companyDetails.currency)} was recorded in ${account?.name || "the selected company account"}.`;

    await writeInvestorActivity({
      companyId,
      investorId: null,
      type: "founder_capital_recorded",
      title: "Founder/Admin capital recorded",
      description: message,
    });

    await emitInvestorNotification({
      companyId,
      actorId,
      investorId: null,
      type: "founder_capital_recorded",
      title: "Founder/Admin capital recorded",
      message,
      metadata: {
        amount,
        destinationAccountId: accountId,
        destinationAccountName: account?.name || null,
        ledgerId: inflow.data?.id || null,
      },
    });

    revalidateInvestorPaths();

    return inflow;
  } catch (error) {
    return normalizeError(error);
  }
}


export async function recordInvestorDocumentDownload(input: {
  companyId: UUID;
  offerId?: UUID | null;
  investorId?: UUID | null;
  documentType: "offer_pdf" | "agreement_pdf" | "certificate_pdf";
  documentLabel?: string | null;
}): Promise<ActionResult<{ recorded: boolean }>> {
  try {
    const companyId = requireId(input.companyId, "Company ID");
    const actorId = await readCurrentUserId();

    if (!actorId) {
      return {
        ok: false,
        error: "You must be logged in to record this download.",
      };
    }

    const supabase = await createClient();
    const client = supabase as any;
    const offerId = cleanText(input.offerId);
    let investorId = cleanText(input.investorId);
    let investorName = "Investor";
    let amount = 0;
    let equityPercent = 0;

    if (offerId) {
      const { data: offer } = await client
        .from("investments")
        .select("id, investor_id, amount, equity_percent, status, notes")
        .eq("id", offerId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (offer) {
        investorId = investorId || cleanText(offer.investor_id);
        amount = numberValue(offer.amount);
        equityPercent = numberValue(offer.equity_percent);
      }
    }

    if (investorId) {
      investorName = await readInvestorNameForNotification(companyId, investorId);
    }

    const companyDetails = await readCompanyDetails(companyId, "GBP");
    const documentLabel =
      cleanText(input.documentLabel) ||
      (input.documentType === "certificate_pdf"
        ? "Certificate PDF"
        : input.documentType === "agreement_pdf"
          ? "Agreement PDF"
          : "Offer PDF");
    const message = `${documentLabel} was downloaded for ${investorName}.`;

    await writeInvestorActivity({
      companyId,
      investorId: investorId || null,
      type: "investor_document_downloaded",
      title: `${documentLabel} downloaded`,
      description: message,
    });

    await emitEvent({
      companyId,
      actorId,
      recipients: [actorId],
      type: "investor_document_downloaded",
      title: `${documentLabel} downloaded`,
      message,
      actionUrl: "/dashboard/investors",
      metadata: {
        offerId: offerId || null,
        investorId: investorId || null,
        investorName,
        documentType: input.documentType,
        documentLabel,
        amount,
        equityPercent,
        companyName: companyDetails.companyName,
      },
    });

    revalidateInvestorPaths();

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

export const createAndSendInvestmentOffer = createEquityOffer;
export const previewInvestmentTransaction = previewEquityOffer;

export async function createDefaultOrdinaryShareClass(): Promise<ActionResult> {
  return {
    ok: true,
    data: {
      skipped: true,
      reason: "Simple percentage equity mode does not use equity categories.",
    },
  };
}

export async function configureCompanyEquitySetup(): Promise<ActionResult> {
  return {
    ok: true,
    data: {
      skipped: true,
      reason: "Simple percentage equity mode starts Founder/Admin at 100% automatically.",
    },
  };
}

