import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getUserNotifications } from "@/lib/notifications/server";
import { emitEvent } from "@/lib/events/emitEvent";

import AccountsClient from "./AccountsClient";

export type CashAccount = {
  id: string;
  company_id: string;
  name: string;
  account_type: string;
  accounting_account_id: string | null;
  currency: string;
  opening_balance: number | string;
  status: string;
  notes: string | null;
  created_at: string | null;
  balance: number;
};

export type AccountingAccount = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  account_type: string;
  account_subtype: string | null;
  normal_balance: string;
  system_key: string | null;
  parent_account_id: string | null;
  description: string | null;
  currency_code: string | null;
  is_system: boolean;
  is_contra: boolean;
  allow_manual_posting: boolean;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type AccountingPeriod = {
  id: string;
  company_id: string;
  fiscal_year_label: string;
  period_number: number;
  name: string;
  start_date: string;
  end_date: string;
  status: "open" | "soft_closed" | "locked";
  is_adjustment_period: boolean;
  closed_at: string | null;
  closed_by: string | null;
  locked_at: string | null;
  locked_by: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type JournalEntry = {
  id: string;
  company_id: string;
  accounting_period_id: string | null;
  entry_number: number | null;
  entry_date: string;
  description: string;
  reference: string | null;
  source_type: string;
  source_id: string | null;
  source_action: string | null;
  base_currency_code: string;
  status: "draft" | "posted" | "reversed";
  reverses_entry_id: string | null;
  posted_at: string | null;
  posted_by: string | null;
  reversed_at: string | null;
  reversed_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type JournalLine = {
  id: string;
  company_id: string;
  journal_entry_id: string;
  line_number: number;
  account_id: string;
  description: string | null;
  debit: number | string;
  credit: number | string;
  currency_code: string;
  exchange_rate: number | string;
  base_debit: number | string;
  base_credit: number | string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CashCategory = {
  id: string;
  name: string;
  category_type: string;
  status: string | null;
};

export type CashTransaction = {
  id: string;
  company_id: string | null;
  account_id: string | null;
  category_id: string | null;
  source_type: string;
  source_id: string | null;
  direction: string;
  amount: number | string;
  category: string | null;
  description: string | null;
  reference: string | null;
  transaction_date: string | null;
  status: string;
  reconciled: boolean;
  created_by: string | null;
  created_at: string | null;
  account?:
    | {
        id: string;
        name: string;
        account_type: string;
      }
    | {
        id: string;
        name: string;
        account_type: string;
      }[]
    | null;
  cash_category?:
    | {
        id: string;
        name: string;
        category_type: string;
      }
    | {
        id: string;
        name: string;
        category_type: string;
      }[]
    | null;
};

type TransactionDirection = "inflow" | "outflow";

type AccountBalanceRow = {
  id: string;
  opening_balance: number | string | null;
  account_type: string;
  status: string;
};

type LedgerBalanceRow = {
  direction: string;
  amount: number | string | null;
  status: string | null;
};

const allowedAccountTypes = [
  "bank",
  "cash",
  "petty_cash",
  "payment_processor",
  "credit_card",
  "loan",
  "other",
] as const;

const allowedAccountingAccountTypes = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "cost_of_sales",
  "expense",
] as const;

type AccountingAccountType =
  (typeof allowedAccountingAccountTypes)[number];

function getAccountingNormalBalance(
  accountType: AccountingAccountType,
  isContra: boolean
) {
  const regularNormalBalance =
    accountType === "asset" ||
    accountType === "cost_of_sales" ||
    accountType === "expense"
      ? "debit"
      : "credit";

  if (!isContra) {
    return regularNormalBalance;
  }

  return regularNormalBalance === "debit"
    ? "credit"
    : "debit";
}

function isDirection(value: string): value is TransactionDirection {
  return value === "inflow" || value === "outflow";
}

function getErrorMessage(
  error:
    | {
        message?: string;
      }
    | null
    | undefined
) {
  return error?.message || "Something went wrong. Please try again.";
}

function normalizeTransactionDate(value: FormDataEntryValue | null) {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return new Date().toISOString();
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return `${rawValue}T12:00:00.000Z`;
  }

  const parsedDate = new Date(rawValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return new Date().toISOString();
  }

  return parsedDate.toISOString();
}

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function calculateBalance(
  openingBalance: number | string | null,
  transactions: LedgerBalanceRow[]
) {
  let balance = Number(openingBalance || 0);

  for (const transaction of transactions) {
    if (transaction.status !== "completed") {
      continue;
    }

    const amount = Number(transaction.amount || 0);

    if (!Number.isFinite(amount)) {
      continue;
    }

    if (transaction.direction === "inflow") {
      balance += amount;
    }

    if (transaction.direction === "outflow") {
      balance -= amount;
    }
  }

  return balance;
}

async function getAdminContext() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, company_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || !profile.company_id) {
    redirect("/admin/login");
  }

  return {
    supabase,
    user,
    profile,
  };
}

async function getCompanyCurrency(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string
) {
  const { data: company } = await supabase
    .from("companies")
    .select("currency")
    .eq("id", companyId)
    .single();

  return company?.currency || "USD";
}

async function getAccountBalance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  accountId: string
) {
  const { data: account, error: accountError } = await supabase
    .from("cash_accounts")
    .select("id, opening_balance, account_type, status")
    .eq("id", accountId)
    .eq("company_id", companyId)
    .single();

  if (accountError || !account) {
    return null;
  }

  const { data: ledgerRows, error: ledgerError } = await supabase
    .from("cash_ledger")
    .select("direction, amount, status")
    .eq("company_id", companyId)
    .eq("account_id", accountId);

  if (ledgerError) {
    return null;
  }

  return {
    account: account as AccountBalanceRow,
    balance: calculateBalance(
      account.opening_balance,
      (ledgerRows || []) as LedgerBalanceRow[]
    ),
  };
}

function revalidateAccountsPages() {
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");
}

async function addAccountingAccount(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminContext();

  const code = String(formData.get("code") || "")
    .trim()
    .toUpperCase();

  const name = String(formData.get("name") || "").trim();

  const requestedAccountType = String(
    formData.get("account_type") || ""
  ).trim();

  const description = String(
    formData.get("description") || ""
  ).trim();

  const isContra =
    String(formData.get("is_contra") || "") === "true";

  if (!code) {
    redirect(
      "/dashboard/accounts?error=GL account code is required."
    );
  }

  if (!/^[A-Z0-9.-]{1,20}$/.test(code)) {
    redirect(
      "/dashboard/accounts?error=GL account code can only contain letters, numbers, dots and hyphens."
    );
  }

  if (!name) {
    redirect(
      "/dashboard/accounts?error=GL account name is required."
    );
  }

  if (name.length > 120) {
    redirect(
      "/dashboard/accounts?error=GL account name must be 120 characters or fewer."
    );
  }

  if (
    !allowedAccountingAccountTypes.includes(
      requestedAccountType as AccountingAccountType
    )
  ) {
    redirect(
      "/dashboard/accounts?error=Select a valid GL account type."
    );
  }

  const accountType =
    requestedAccountType as AccountingAccountType;

  const normalBalance =
    getAccountingNormalBalance(accountType, isContra);

  const { data: existingAccount, error: lookupError } =
    await supabase
      .from("accounting_accounts")
      .select("id")
      .eq("company_id", profile.company_id)
      .ilike("code", code)
      .maybeSingle();

  if (lookupError) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        getErrorMessage(lookupError)
      )}`
    );
  }

  if (existingAccount) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        `GL account code ${code} already exists.`
      )}`
    );
  }

  const { data: generalLedgerRows } = await supabase
  .from("general_ledger_view")
  .select("*")
  .eq("company_id", profile.company_id)
  .order("entry_date", { ascending: false })
  .order("account_code", { ascending: true });

  const companyCurrency = (
    await getCompanyCurrency(
      supabase,
      profile.company_id
    )
  )
    .trim()
    .toUpperCase();

  const currencyCode = /^[A-Z]{3}$/.test(companyCurrency)
    ? companyCurrency
    : "USD";

  const { error } = await supabase
    .from("accounting_accounts")
    .insert({
      company_id: profile.company_id,
      code,
      name,
      account_type: accountType,
      account_subtype: null,
      normal_balance: normalBalance,
      parent_account_id: null,
      description: description || null,
      currency_code: currencyCode,
      is_contra: isContra,
      allow_manual_posting: true,
      status: "active",
      sort_order: 900000,
      created_by: user.id,
    });

  if (error) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        getErrorMessage(error)
      )}`
    );
  }

  revalidateAccountsPages();

  redirect(
    `/dashboard/accounts?success=${encodeURIComponent(
      `GL account ${code} — ${name} created successfully.`
    )}`
  );
}

async function updateAccountingAccount(formData: FormData) {
  "use server";

  const { supabase, profile } = await getAdminContext();

  const accountId = String(
    formData.get("account_id") || ""
  ).trim();

  const code = String(formData.get("code") || "")
    .trim()
    .toUpperCase();

  const name = String(formData.get("name") || "").trim();

  const description = String(
    formData.get("description") || ""
  ).trim();

  const allowManualPosting =
    String(formData.get("allow_manual_posting") || "") ===
    "true";

  if (!accountId) {
    redirect(
      "/dashboard/accounts?error=GL account was not found."
    );
  }

  if (!code) {
    redirect(
      "/dashboard/accounts?error=GL account code is required."
    );
  }

  if (!/^[A-Z0-9.-]{1,20}$/.test(code)) {
    redirect(
      "/dashboard/accounts?error=GL account code can only contain letters, numbers, dots and hyphens."
    );
  }

  if (!name) {
    redirect(
      "/dashboard/accounts?error=GL account name is required."
    );
  }

  if (name.length > 120) {
    redirect(
      "/dashboard/accounts?error=GL account name must be 120 characters or fewer."
    );
  }

  const { data: account, error: accountError } =
    await supabase
      .from("accounting_accounts")
      .select(
        `
          id,
          code,
          name,
          is_system,
          system_key,
          allow_manual_posting,
          status
        `
      )
      .eq("id", accountId)
      .eq("company_id", profile.company_id)
      .maybeSingle();

  if (accountError) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        getErrorMessage(accountError)
      )}`
    );
  }

  if (!account) {
    redirect(
      "/dashboard/accounts?error=GL account was not found."
    );
  }

  const { data: duplicateCode, error: duplicateError } =
    await supabase
      .from("accounting_accounts")
      .select("id")
      .eq("company_id", profile.company_id)
      .ilike("code", code)
      .neq("id", accountId)
      .maybeSingle();

  if (duplicateError) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        getErrorMessage(duplicateError)
      )}`
    );
  }

  if (duplicateCode) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        `GL account code ${code} already exists.`
      )}`
    );
  }

  const updateValues: {
    code: string;
    name: string;
    description: string | null;
    allow_manual_posting?: boolean;
  } = {
    code,
    name,
    description: description || null,
  };

  if (!account.is_system) {
    updateValues.allow_manual_posting =
      allowManualPosting;
  }

  const { error } = await supabase
    .from("accounting_accounts")
    .update(updateValues)
    .eq("id", accountId)
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        getErrorMessage(error)
      )}`
    );
  }

  revalidateAccountsPages();

  redirect(
    `/dashboard/accounts?success=${encodeURIComponent(
      `GL account ${code} — ${name} updated successfully.`
    )}`
  );
}

async function archiveAccountingAccount(formData: FormData) {
  "use server";

  const { supabase, profile } = await getAdminContext();

  const accountId = String(
    formData.get("account_id") || ""
  ).trim();

  if (!accountId) {
    redirect(
      "/dashboard/accounts?error=GL account was not found."
    );
  }

  const { data: account, error: accountError } =
    await supabase
      .from("accounting_accounts")
      .select(
        `
          id,
          code,
          name,
          system_key,
          is_system,
          status
        `
      )
      .eq("id", accountId)
      .eq("company_id", profile.company_id)
      .maybeSingle();

  if (accountError) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        getErrorMessage(accountError)
      )}`
    );
  }

  if (!account) {
    redirect(
      "/dashboard/accounts?error=GL account was not found."
    );
  }

  if (account.is_system || account.system_key) {
    redirect(
      "/dashboard/accounts?error=Helix system accounts cannot be archived."
    );
  }

  if (account.status === "archived") {
    redirect(
      "/dashboard/accounts?error=This GL account is already archived."
    );
  }

  const { error } = await supabase
    .from("accounting_accounts")
    .update({
      status: "archived",
    })
    .eq("id", account.id)
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        getErrorMessage(error)
      )}`
    );
  }

  revalidateAccountsPages();

  redirect(
    `/dashboard/accounts?success=${encodeURIComponent(
      `GL account ${account.code} — ${account.name} archived successfully.`
    )}`
  );
}

async function restoreAccountingAccount(formData: FormData) {
  "use server";

  const { supabase, profile } = await getAdminContext();

  const accountId = String(
    formData.get("account_id") || ""
  ).trim();

  if (!accountId) {
    redirect(
      "/dashboard/accounts?error=GL account was not found."
    );
  }

  const { data: account, error: accountError } =
    await supabase
      .from("accounting_accounts")
      .select(
        `
          id,
          code,
          name,
          system_key,
          is_system,
          status
        `
      )
      .eq("id", accountId)
      .eq("company_id", profile.company_id)
      .maybeSingle();

  if (accountError) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        getErrorMessage(accountError)
      )}`
    );
  }

  if (!account) {
    redirect(
      "/dashboard/accounts?error=GL account was not found."
    );
  }

  if (account.is_system || account.system_key) {
    redirect(
      "/dashboard/accounts?error=Helix system accounts cannot be restored through the custom account workflow."
    );
  }

  if (account.status !== "archived") {
    redirect(
      "/dashboard/accounts?error=This GL account is not archived."
    );
  }

  const { error } = await supabase
    .from("accounting_accounts")
    .update({
      status: "active",
    })
    .eq("id", account.id)
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        getErrorMessage(error)
      )}`
    );
  }

  revalidateAccountsPages();

  redirect(
    `/dashboard/accounts?success=${encodeURIComponent(
      `GL account ${account.code} — ${account.name} restored successfully.`
    )}`
  );
}

async function createAccountingFiscalYear(
  formData: FormData
) {
  "use server";

  const { supabase, user, profile } =
    await getAdminContext();

  const fiscalYearLabel = String(
    formData.get("fiscal_year_label") || ""
  ).trim();

  const startDateRaw = String(
    formData.get("start_date") || ""
  ).trim();

  const notes = String(
    formData.get("notes") || ""
  ).trim();

  if (!fiscalYearLabel) {
    redirect(
      "/dashboard/accounts?error=Fiscal year label is required."
    );
  }

  const startMatch =
    /^(\d{4})-(\d{2})-01$/.exec(startDateRaw);

  if (!startMatch) {
    redirect(
      "/dashboard/accounts?error=Fiscal year must start on the first day of a month."
    );
  }

  const startYear = Number(startMatch[1]);
  const startMonth = Number(startMatch[2]);

  if (
    !Number.isInteger(startYear) ||
    startYear < 1900 ||
    startYear > 2200 ||
    startMonth < 1 ||
    startMonth > 12
  ) {
    redirect(
      "/dashboard/accounts?error=Enter a valid fiscal year start date."
    );
  }

  const fiscalYearStart = new Date(
    Date.UTC(startYear, startMonth - 1, 1)
  );

  const fiscalYearEnd = new Date(
    Date.UTC(startYear, startMonth - 1 + 12, 0)
  );

  const fiscalYearStartIso =
    fiscalYearStart.toISOString().slice(0, 10);

  const fiscalYearEndIso =
    fiscalYearEnd.toISOString().slice(0, 10);

  const {
    data: existingLabelRows,
    error: existingLabelError,
  } = await supabase
    .from("accounting_periods")
    .select("id")
    .eq("company_id", profile.company_id)
    .eq("fiscal_year_label", fiscalYearLabel)
    .limit(1);

  if (existingLabelError) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        getErrorMessage(existingLabelError)
      )}`
    );
  }

  if ((existingLabelRows || []).length > 0) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        `Fiscal year ${fiscalYearLabel} already exists.`
      )}`
    );
  }

  const {
    data: overlappingPeriods,
    error: overlapError,
  } = await supabase
    .from("accounting_periods")
    .select(
      "id, fiscal_year_label, start_date, end_date"
    )
    .eq("company_id", profile.company_id)
    .lte("start_date", fiscalYearEndIso)
    .gte("end_date", fiscalYearStartIso)
    .limit(1);

  if (overlapError) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        getErrorMessage(overlapError)
      )}`
    );
  }

  if ((overlappingPeriods || []).length > 0) {
    const overlapping =
      overlappingPeriods![0];

    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        `This fiscal year overlaps with ${overlapping.fiscal_year_label}.`
      )}`
    );
  }

  const periods = Array.from(
    { length: 12 },
    (_, index) => {
      const periodStart = new Date(
        Date.UTC(
          startYear,
          startMonth - 1 + index,
          1
        )
      );

      const periodEnd = new Date(
        Date.UTC(
          startYear,
          startMonth - 1 + index + 1,
          0
        )
      );

      const name = new Intl.DateTimeFormat(
        "en-GB",
        {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }
      ).format(periodStart);

      return {
        company_id: profile.company_id,
        fiscal_year_label: fiscalYearLabel,
        period_number: index + 1,
        name,
        start_date: periodStart
          .toISOString()
          .slice(0, 10),
        end_date: periodEnd
          .toISOString()
          .slice(0, 10),
        status: "open",
        is_adjustment_period: false,
        notes: notes || null,
        created_by: user.id,
      };
    }
  );

  const { error } = await supabase
    .from("accounting_periods")
    .insert(periods);

  if (error) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        getErrorMessage(error)
      )}`
    );
  }

  revalidateAccountsPages();

  redirect(
    `/dashboard/accounts?success=${encodeURIComponent(
      `Fiscal year ${fiscalYearLabel} created with 12 monthly accounting periods.`
    )}`
  );
}

async function softCloseAccountingPeriod(
  formData: FormData
) {
  "use server";

  const { supabase } = await getAdminContext();

  const periodId = String(
    formData.get("period_id") || ""
  ).trim();

  if (!periodId) {
    redirect(
      "/dashboard/accounts?error=Accounting period was not found."
    );
  }

  const { error } = await supabase.rpc(
    "soft_close_accounting_period",
    {
      p_period_id: periodId,
    }
  );

  if (error) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        getErrorMessage(error)
      )}`
    );
  }

  revalidateAccountsPages();

  redirect(
    "/dashboard/accounts?success=Accounting period soft closed successfully."
  );
}

async function reopenAccountingPeriod(
  formData: FormData
) {
  "use server";

  const { supabase } = await getAdminContext();

  const periodId = String(
    formData.get("period_id") || ""
  ).trim();

  if (!periodId) {
    redirect(
      "/dashboard/accounts?error=Accounting period was not found."
    );
  }

  const { error } = await supabase.rpc(
    "reopen_accounting_period",
    {
      p_period_id: periodId,
    }
  );

  if (error) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        getErrorMessage(error)
      )}`
    );
  }

  revalidateAccountsPages();

  redirect(
    "/dashboard/accounts?success=Accounting period reopened successfully."
  );
}

async function lockAccountingPeriod(
  formData: FormData
) {
  "use server";

  const { supabase } = await getAdminContext();

  const periodId = String(
    formData.get("period_id") || ""
  ).trim();

  if (!periodId) {
    redirect(
      "/dashboard/accounts?error=Accounting period was not found."
    );
  }

  const { error } = await supabase.rpc(
    "lock_accounting_period",
    {
      p_period_id: periodId,
    }
  );

  if (error) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        getErrorMessage(error)
      )}`
    );
  }

  revalidateAccountsPages();

  redirect(
    "/dashboard/accounts?success=Accounting period locked successfully."
  );
}

async function addCashAccount(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminContext();

  const name = String(formData.get("name") || "").trim();
  const accountType = String(
    formData.get("account_type") || "bank"
  ).trim();
  const currency = String(formData.get("currency") || "USD")
    .trim()
    .toUpperCase();
  const openingBalance = Number(
    formData.get("opening_balance") || 0
  );
  const notes = String(formData.get("notes") || "").trim();

  if (!name) {
    redirect("/dashboard/accounts?error=Account name is required.");
  }

  if (!allowedAccountTypes.includes(
    accountType as (typeof allowedAccountTypes)[number]
  )) {
    redirect("/dashboard/accounts?error=Invalid account type.");
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    redirect(
      "/dashboard/accounts?error=Currency must use a valid three-letter code."
    );
  }

  if (!Number.isFinite(openingBalance)) {
    redirect(
      "/dashboard/accounts?error=Enter a valid opening balance."
    );
  }

  const { data: existingAccount } = await supabase
    .from("cash_accounts")
    .select("id")
    .eq("company_id", profile.company_id)
    .ilike("name", name)
    .maybeSingle();

  if (existingAccount) {
    redirect(
      "/dashboard/accounts?error=An account with this name already exists."
    );
  }

  const { data: account, error } = await supabase
    .from("cash_accounts")
    .insert({
      company_id: profile.company_id,
      name,
      account_type: accountType,
      currency,
      opening_balance: openingBalance,
      status: "active",
      notes: notes || null,
      created_by: user.id,
    })
    .select(
      "id, name, account_type, currency, opening_balance, notes, status"
    )
    .single();

  if (error || !account) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        getErrorMessage(error)
      )}`
    );
  }

  const {
  data: accountingAccountId,
  error: accountingMappingError,
} = await supabase.rpc(
  "ensure_cash_account_gl_mapping",
  {
    p_cash_account_id: account.id,
  }
);

if (
  accountingMappingError ||
  !accountingAccountId
) {
  await supabase
    .from("cash_accounts")
    .delete()
    .eq("id", account.id)
    .eq(
      "company_id",
      profile.company_id
    );

  redirect(
    `/dashboard/accounts?error=${encodeURIComponent(
      `The financial account was not created because its General Ledger account could not be created: ${getErrorMessage(
        accountingMappingError
      )}`
    )}`
  );
}

  const formattedOpeningBalance = formatAmount(
    Number(account.opening_balance || 0),
    account.currency
  );

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id],
    type: "cash_account_created",
    title: "Financial account added",
    message: `${account.name} was added with an opening balance of ${formattedOpeningBalance}.`,
    actionUrl: "/dashboard/accounts",
    metadata: {
  accountId: account.id,
  accountingAccountId,
  accountName: account.name,
  accountType: account.account_type,
  currency: account.currency,
  openingBalance: Number(account.opening_balance || 0),
  notes: account.notes,
  status: account.status,
},
  });

  revalidateAccountsPages();

  redirect("/dashboard/accounts?success=Account added successfully.");
}

async function updateCashAccount(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminContext();

  const accountId = String(formData.get("account_id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!accountId) {
    redirect("/dashboard/accounts?error=Account not found.");
  }

  if (!name) {
    redirect("/dashboard/accounts?error=Account name is required.");
  }

  const { data: existingAccount, error: lookupError } = await supabase
    .from("cash_accounts")
    .select(
      "id, name, notes, account_type, currency, opening_balance, status"
    )
    .eq("id", accountId)
    .eq("company_id", profile.company_id)
    .single();

  if (lookupError || !existingAccount) {
    redirect("/dashboard/accounts?error=Account not found.");
  }

  const { data: duplicateAccount } = await supabase
    .from("cash_accounts")
    .select("id")
    .eq("company_id", profile.company_id)
    .ilike("name", name)
    .neq("id", accountId)
    .maybeSingle();

  if (duplicateAccount) {
    redirect(
      "/dashboard/accounts?error=Another account already uses this name."
    );
  }

  const changes: string[] = [];

  if (existingAccount.name !== name) {
    changes.push(`name "${existingAccount.name}" → "${name}"`);
  }

  if ((existingAccount.notes || "") !== notes) {
    changes.push("notes updated");
  }

  if (changes.length === 0) {
    redirect(
      "/dashboard/accounts?success=No account changes were required."
    );
  }

  const { error: updateError } = await supabase
    .from("cash_accounts")
    .update({
      name,
      notes: notes || null,
    })
    .eq("id", accountId)
    .eq("company_id", profile.company_id);

  if (updateError) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        updateError.message
      )}`
    );
  }

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id],
    type: "cash_account_updated",
    title: "Financial account updated",
    message: `${existingAccount.name}: ${changes.join("; ")}.`,
    actionUrl: "/dashboard/accounts",
    metadata: {
      accountId,
      previous: {
        name: existingAccount.name,
        notes: existingAccount.notes,
        accountType: existingAccount.account_type,
        currency: existingAccount.currency,
        openingBalance: Number(existingAccount.opening_balance || 0),
        status: existingAccount.status,
      },
      updated: {
        name,
        notes: notes || null,
      },
      changedFields: changes,
    },
  });

  revalidateAccountsPages();

  redirect("/dashboard/accounts?success=Account updated successfully.");
}

async function archiveCashAccount(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminContext();

  const accountId = String(formData.get("account_id") || "").trim();

  if (!accountId) {
    redirect("/dashboard/accounts?error=Account not found.");
  }

  const { data: account, error: accountError } = await supabase
    .from("cash_accounts")
    .select(
      "id, name, account_type, currency, opening_balance, status, notes"
    )
    .eq("id", accountId)
    .eq("company_id", profile.company_id)
    .single();

  if (accountError || !account) {
    redirect("/dashboard/accounts?error=Account not found.");
  }

  if (account.status === "archived") {
    redirect("/dashboard/accounts?error=This account is already archived.");
  }

  const { count: activeAccountCount } = await supabase
    .from("cash_accounts")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("company_id", profile.company_id)
    .eq("status", "active");

  if ((activeAccountCount || 0) <= 1) {
    redirect(
      "/dashboard/accounts?error=You cannot archive the final active financial account."
    );
  }

  const balanceResult = await getAccountBalance(
    supabase,
    profile.company_id,
    accountId
  );

  if (!balanceResult) {
    redirect(
      "/dashboard/accounts?error=The account balance could not be verified."
    );
  }

  const roundedBalance =
    Math.round(balanceResult.balance * 100) / 100;

  if (roundedBalance !== 0) {
    const formattedBalance = formatAmount(
      roundedBalance,
      account.currency
    );

    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        `Move or adjust the remaining ${formattedBalance} balance before archiving this account.`
      )}`
    );
  }

  const { error: archiveError } = await supabase
    .from("cash_accounts")
    .update({
      status: "archived",
    })
    .eq("id", accountId)
    .eq("company_id", profile.company_id)
    .eq("status", "active");

  if (archiveError) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        archiveError.message
      )}`
    );
  }

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id],
    type: "cash_account_archived",
    title: "Financial account archived",
    message: `${account.name} was archived. Its transaction history remains available for reporting and audit purposes.`,
    actionUrl: "/dashboard/accounts",
    metadata: {
      accountId: account.id,
      accountName: account.name,
      accountType: account.account_type,
      currency: account.currency,
      openingBalance: Number(account.opening_balance || 0),
      closingBalance: roundedBalance,
      previousStatus: account.status,
      newStatus: "archived",
    },
  });

  revalidateAccountsPages();

  redirect("/dashboard/accounts?success=Account archived successfully.");
}

async function addCashTransaction(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminContext();

  const accountId = String(formData.get("account_id") || "").trim();
  const categoryId = String(
    formData.get("category_id") || ""
  ).trim();
  const requestedDirection = String(
    formData.get("direction") || ""
  ).trim();
  const amount = Number(formData.get("amount") || 0);
  const description = String(
    formData.get("description") || ""
  ).trim();
  const reference = String(
    formData.get("reference") || ""
  ).trim();
  const transactionDate = normalizeTransactionDate(
    formData.get("transaction_date")
  );

  if (!accountId) {
    redirect("/dashboard/accounts?error=Select an account.");
  }

  if (!isDirection(requestedDirection)) {
    redirect(
      "/dashboard/accounts?error=Select inflow or outflow."
    );
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    redirect(
      "/dashboard/accounts?error=Amount must be greater than zero."
    );
  }

  const { data: account, error: accountError } = await supabase
    .from("cash_accounts")
    .select("id, name, currency, account_type, status")
    .eq("id", accountId)
    .eq("company_id", profile.company_id)
    .eq("status", "active")
    .single();

  if (accountError || !account) {
    redirect("/dashboard/accounts?error=Active account not found.");
  }

  let categoryName = "Manual transaction";
  let categoryType: string | null = null;

  if (categoryId) {
    const { data: category, error: categoryError } = await supabase
      .from("cash_categories")
      .select("id, name, category_type")
      .eq("id", categoryId)
      .eq("company_id", profile.company_id)
      .eq("status", "active")
      .single();

    if (categoryError || !category) {
      redirect("/dashboard/accounts?error=Category not found.");
    }

    categoryName = category.name;
    categoryType = category.category_type;
  }

  const transactionId = randomUUID();

  const { data: transaction, error } = await supabase
    .from("cash_ledger")
    .insert({
      id: transactionId,
      company_id: profile.company_id,
      account_id: accountId,
      category_id: categoryId || null,
      source_type: "manual",
      source_id: null,
      direction: requestedDirection,
      amount,
      category: categoryName,
      description: description || categoryName,
      reference: reference || `MAN-${transactionId.slice(0, 8).toUpperCase()}`,
      transaction_date: transactionDate,
      status: "completed",
      reconciled: false,
      created_by: user.id,
      metadata: {
        enteredFrom: "accounts_page",
        categoryType,
        transactionId,
      },
    })
    .select("id")
    .single();

  if (error || !transaction) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        getErrorMessage(error)
      )}`
    );
  }

  const formattedAmount = formatAmount(amount, account.currency);

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id],
    type:
      requestedDirection === "inflow"
        ? "manual_cash_inflow_created"
        : "manual_cash_outflow_created",
    title:
      requestedDirection === "inflow"
        ? "Cash inflow recorded"
        : "Cash outflow recorded",
    message: `${formattedAmount} was recorded as an ${requestedDirection} in ${account.name}${
      description ? ` for ${description}` : ""
    }.`,
    actionUrl: "/dashboard/accounts",
    metadata: {
      transactionId: transaction.id,
      accountId,
      accountName: account.name,
      accountType: account.account_type,
      categoryId: categoryId || null,
      categoryName,
      categoryType,
      direction: requestedDirection,
      amount,
      currency: account.currency,
      description,
      reference,
      transactionDate,
    },
  });

  revalidateAccountsPages();

  redirect(
    "/dashboard/accounts?success=Transaction recorded successfully."
  );
}

async function transferCash(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminContext();

  const fromAccountId = String(
    formData.get("from_account_id") || ""
  ).trim();
  const toAccountId = String(
    formData.get("to_account_id") || ""
  ).trim();
  const amount = Number(formData.get("amount") || 0);
  const description = String(
    formData.get("description") || ""
  ).trim();
  const transactionDate = normalizeTransactionDate(
    formData.get("transaction_date")
  );

  if (!fromAccountId || !toAccountId) {
    redirect(
      "/dashboard/accounts?error=Select both transfer accounts."
    );
  }

  if (fromAccountId === toAccountId) {
    redirect(
      "/dashboard/accounts?error=Transfer accounts must be different."
    );
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    redirect(
      "/dashboard/accounts?error=Transfer amount must be greater than zero."
    );
  }

  const { data: accounts, error: accountsError } = await supabase
    .from("cash_accounts")
    .select("id, name, currency, account_type, status")
    .eq("company_id", profile.company_id)
    .eq("status", "active")
    .in("id", [fromAccountId, toAccountId]);

  if (accountsError || !accounts || accounts.length !== 2) {
    redirect(
      "/dashboard/accounts?error=One or more active transfer accounts were not found."
    );
  }

  const fromAccount = accounts.find(
    (account) => account.id === fromAccountId
  );
  const toAccount = accounts.find(
    (account) => account.id === toAccountId
  );

  if (!fromAccount || !toAccount) {
    redirect(
      "/dashboard/accounts?error=Transfer accounts were not found."
    );
  }

  if (fromAccount.currency !== toAccount.currency) {
    redirect(
      "/dashboard/accounts?error=Transfers between different currencies are not supported yet."
    );
  }

  const balanceResult = await getAccountBalance(
    supabase,
    profile.company_id,
    fromAccountId
  );

  if (!balanceResult) {
    redirect(
      "/dashboard/accounts?error=The source account balance could not be verified."
    );
  }

  const availableBalance =
    Math.round(balanceResult.balance * 100) / 100;

  if (amount > availableBalance) {
    const formattedAvailableBalance = formatAmount(
      availableBalance,
      fromAccount.currency
    );

    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        `Insufficient balance. ${fromAccount.name} currently has ${formattedAvailableBalance} available.`
      )}`
    );
  }

  const transferId = randomUUID();
  const outgoingEntryId = randomUUID();
  const incomingEntryId = randomUUID();
  const transferReference = `TRF-${transferId
    .slice(0, 8)
    .toUpperCase()}`;

  const transferDescription =
    description ||
    `Transfer from ${fromAccount.name} to ${toAccount.name}`;

  const { error: transferError } = await supabase
    .from("cash_ledger")
    .insert([
      {
        id: outgoingEntryId,
        company_id: profile.company_id,
        account_id: fromAccountId,
        category_id: null,
        source_type: "transfer",
        source_id: transferId,
        direction: "outflow",
        amount,
        category: "Transfer",
        description: transferDescription,
        reference: transferReference,
        transaction_date: transactionDate,
        status: "completed",
        reconciled: false,
        created_by: user.id,
        metadata: {
          transferId,
          transferReference,
          transferSide: "outgoing",
          pairedEntryId: incomingEntryId,
          counterpartyAccountId: toAccountId,
          counterpartyAccountName: toAccount.name,
        },
      },
      {
        id: incomingEntryId,
        company_id: profile.company_id,
        account_id: toAccountId,
        category_id: null,
        source_type: "transfer",
        source_id: transferId,
        direction: "inflow",
        amount,
        category: "Transfer",
        description: transferDescription,
        reference: transferReference,
        transaction_date: transactionDate,
        status: "completed",
        reconciled: false,
        created_by: user.id,
        metadata: {
          transferId,
          transferReference,
          transferSide: "incoming",
          pairedEntryId: outgoingEntryId,
          counterpartyAccountId: fromAccountId,
          counterpartyAccountName: fromAccount.name,
        },
      },
    ]);

  if (transferError) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        getErrorMessage(transferError)
      )}`
    );
  }

  const formattedAmount = formatAmount(
    amount,
    fromAccount.currency
  );

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id],
    type: "cash_transfer_completed",
    title: "Funds transferred",
    message: `${formattedAmount} was transferred from ${fromAccount.name} to ${toAccount.name}.`,
    actionUrl: "/dashboard/accounts",
    metadata: {
      transferId,
      transferReference,
      outgoingEntryId,
      incomingEntryId,
      fromAccountId,
      fromAccountName: fromAccount.name,
      fromAccountType: fromAccount.account_type,
      toAccountId,
      toAccountName: toAccount.name,
      toAccountType: toAccount.account_type,
      amount,
      currency: fromAccount.currency,
      previousSourceBalance: availableBalance,
      newSourceBalance: availableBalance - amount,
      description: transferDescription,
      transactionDate,
    },
  });

  revalidateAccountsPages();

  redirect(
    "/dashboard/accounts?success=Funds transferred successfully."
  );
}

async function createJournalEntry(formData: FormData) {
  "use server";

  const { supabase, user, profile } =
    await getAdminContext();

  const entryDate = String(
    formData.get("entry_date") || ""
  ).trim();

  const description = String(
    formData.get("description") || ""
  ).trim();

  const reference = String(
    formData.get("reference") || ""
  ).trim();

  const debitAccountId = String(
    formData.get("debit_account_id") || ""
  ).trim();

  const creditAccountId = String(
    formData.get("credit_account_id") || ""
  ).trim();

  const amount = Number(
    formData.get("amount") || 0
  );

  if (
    !entryDate ||
    !description ||
    !debitAccountId ||
    !creditAccountId
  ) {
    redirect(
      "/dashboard/accounts?error=Complete all required journal fields."
    );
  }

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    redirect(
      "/dashboard/accounts?error=Journal amount must be greater than zero."
    );
  }

  if (debitAccountId === creditAccountId) {
    redirect(
      "/dashboard/accounts?error=Debit and credit accounts must be different."
    );
  }

  const { data: period, error: periodError } =
    await supabase
      .from("accounting_periods")
      .select(
        "id, start_date, end_date, status, is_adjustment_period"
      )
      .eq("company_id", profile.company_id)
      .eq("status", "open")
      .eq("is_adjustment_period", false)
      .lte("start_date", entryDate)
      .gte("end_date", entryDate)
      .maybeSingle();

  if (periodError) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        periodError.message
      )}`
    );
  }

  if (!period) {
    redirect(
      "/dashboard/accounts?error=The journal date does not fall inside an open accounting period."
    );
  }

  const { data: selectedAccounts, error: accountsError } =
    await supabase
      .from("accounting_accounts")
      .select(
        "id, code, name, status, allow_manual_posting"
      )
      .eq("company_id", profile.company_id)
      .in("id", [
        debitAccountId,
        creditAccountId,
      ]);

  if (accountsError) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        accountsError.message
      )}`
    );
  }

  if (
    !selectedAccounts ||
    selectedAccounts.length !== 2
  ) {
    redirect(
      "/dashboard/accounts?error=One or more selected GL accounts are invalid."
    );
  }

  const blockedAccount =
    selectedAccounts.find(
      (account) =>
        account.status !== "active" ||
        !account.allow_manual_posting
    );

  if (blockedAccount) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        `Manual journal posting is not allowed for ${blockedAccount.code} — ${blockedAccount.name}.`
      )}`
    );
  }

  const baseCurrency =
    await getCompanyCurrency(
      supabase,
      profile.company_id
    );

  const { data: journalEntry, error: entryError } =
    await supabase
      .from("journal_entries")
      .insert({
        company_id: profile.company_id,
        accounting_period_id: period.id,
        entry_date: entryDate,
        description,
        reference: reference || null,
        source_type: "manual",
        source_action: "manual_entry",
        base_currency_code: baseCurrency,
        status: "draft",
        created_by: user.id,
      })
      .select("id")
      .single();

  if (entryError || !journalEntry) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        entryError?.message ||
          "Unable to create journal draft."
      )}`
    );
  }

  const { error: linesError } =
    await supabase
      .from("journal_lines")
      .insert([
        {
          company_id: profile.company_id,
          journal_entry_id: journalEntry.id,
          line_number: 1,
          account_id: debitAccountId,
          description,
          debit: amount,
          credit: 0,
          currency_code: baseCurrency,
          exchange_rate: 1,
          created_by: user.id,
        },
        {
          company_id: profile.company_id,
          journal_entry_id: journalEntry.id,
          line_number: 2,
          account_id: creditAccountId,
          description,
          debit: 0,
          credit: amount,
          currency_code: baseCurrency,
          exchange_rate: 1,
          created_by: user.id,
        },
      ]);

  if (linesError) {
    await supabase
      .from("journal_entries")
      .delete()
      .eq("id", journalEntry.id)
      .eq("company_id", profile.company_id)
      .eq("status", "draft");

    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        linesError.message
      )}`
    );
  }

  revalidateAccountsPages();

  redirect(
    "/dashboard/accounts?success=Journal draft created successfully."
  );
}


async function postJournalEntry(formData: FormData) {
  "use server";

  const { supabase, profile } =
    await getAdminContext();

  const journalEntryId = String(
    formData.get("journal_entry_id") || ""
  ).trim();

  if (!journalEntryId) {
    redirect(
      "/dashboard/accounts?error=Journal entry ID is required."
    );
  }

  const { data: journalEntry, error: lookupError } =
    await supabase
      .from("journal_entries")
      .select(
        "id, company_id, status, description"
      )
      .eq("id", journalEntryId)
      .eq("company_id", profile.company_id)
      .maybeSingle();

  if (lookupError) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        lookupError.message
      )}`
    );
  }

  if (!journalEntry) {
    redirect(
      "/dashboard/accounts?error=Journal entry not found."
    );
  }

  if (journalEntry.status !== "draft") {
    redirect(
      "/dashboard/accounts?error=Only draft journals can be posted."
    );
  }

  const { error: postError } =
    await supabase.rpc(
      "post_journal_entry",
      {
        p_journal_entry_id:
          journalEntry.id,
      }
    );

  if (postError) {
    redirect(
      `/dashboard/accounts?error=${encodeURIComponent(
        postError.message
      )}`
    );
  }

  revalidateAccountsPages();

  redirect(
    "/dashboard/accounts?success=Journal posted successfully to the General Ledger."
  );
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
}) {
  const params = await searchParams;
  const { supabase, user, profile } = await getAdminContext();

  const [
  { data: accountRows },
  { data: categories },
  { data: transactionRows },
  { data: accountingAccountRows },
  { data: accountingPeriodRows },
  { data: journalEntryRows },
  { data: journalLineRows },
{ data: generalLedgerRows },
{ data: company },
notifications,
] = await Promise.all([
  supabase
    .from("cash_accounts")
    .select(
      "id, company_id, name, account_type, accounting_account_id, currency, opening_balance, status, notes, created_at"
    )
    .eq("company_id", profile.company_id)
    .order("status", {
      ascending: false,
    })
    .order("created_at", {
      ascending: true,
    }),

  supabase
    .from("cash_categories")
    .select("id, name, category_type, status")
    .eq("company_id", profile.company_id)
    .eq("status", "active")
    .order("name", {
      ascending: true,
    }),

  supabase
    .from("cash_ledger")
    .select(
      `
        id,
        company_id,
        account_id,
        category_id,
        source_type,
        source_id,
        direction,
        amount,
        category,
        description,
        reference,
        transaction_date,
        status,
        reconciled,
        created_by,
        created_at,
        account:cash_accounts!cash_ledger_account_id_fkey(
          id,
          name,
          account_type
        ),
        cash_category:cash_categories!cash_ledger_category_id_fkey(
          id,
          name,
          category_type
        )
      `
    )
    .eq("company_id", profile.company_id)
    .order("transaction_date", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    })
    .limit(1000),

  supabase
    .from("accounting_accounts")
    .select(
      `
        id,
        company_id,
        code,
        name,
        account_type,
        account_subtype,
        normal_balance,
        system_key,
        parent_account_id,
        description,
        currency_code,
        is_system,
        is_contra,
        allow_manual_posting,
        status,
        sort_order,
        created_at,
        updated_at
      `
    )
    .eq("company_id", profile.company_id)
    .order("sort_order", {
      ascending: true,
    })
    .order("code", {
      ascending: true,
    }),

  supabase
    .from("accounting_periods")
    .select(
      `
        id,
        company_id,
        fiscal_year_label,
        period_number,
        name,
        start_date,
        end_date,
        status,
        is_adjustment_period,
        closed_at,
        closed_by,
        locked_at,
        locked_by,
        notes,
        created_by,
        created_at,
        updated_at
      `
    )
    .eq("company_id", profile.company_id)
    .order("start_date", {
  ascending: true,
})
    .order("period_number", {
      ascending: true,
    }),

  supabase
  .from("journal_entries")
  .select(
    `
      id,
      company_id,
      accounting_period_id,
      entry_number,
      entry_date,
      description,
      reference,
      source_type,
      source_id,
      source_action,
      base_currency_code,
      status,
      reverses_entry_id,
      posted_at,
      posted_by,
      reversed_at,
      reversed_by,
      created_by,
      created_at,
      updated_at
    `
  )
  .eq("company_id", profile.company_id)
  .order("entry_date", {
  ascending: true,
})
.order("entry_number", {
  ascending: true,
  nullsFirst: false,
})
.order("created_at", {
  ascending: true,
}),

supabase
  .from("journal_lines")
  .select(
    `
      id,
      company_id,
      journal_entry_id,
      line_number,
      account_id,
      description,
      debit,
      credit,
      currency_code,
      exchange_rate,
      base_debit,
      base_credit,
      created_by,
      created_at,
      updated_at
    `
  )
  .eq("company_id", profile.company_id)
  .order("journal_entry_id", {
    ascending: true,
  })
  .order("line_number", {
    ascending: true,
  })
  .limit(5000),

  supabase
  .from("general_ledger_view")
  .select("*")
  .eq("company_id", profile.company_id)
  .order("entry_date", {
    ascending: true,
  })
  .order("entry_number", {
    ascending: true,
  })
  .order("line_number", {
    ascending: true,
  }),

  supabase
    .from("companies")
    .select("name, currency")
    .eq("id", profile.company_id)
    .single(),

  getUserNotifications(user.id),
]);

  const transactions =
    (transactionRows || []) as unknown as CashTransaction[];

  const accountBalances = new Map<string, number>();

  for (const account of accountRows || []) {
    accountBalances.set(
      account.id,
      Number(account.opening_balance || 0)
    );
  }

  for (const transaction of transactions) {
    if (
      !transaction.account_id ||
      transaction.status !== "completed"
    ) {
      continue;
    }

    const currentBalance =
      accountBalances.get(transaction.account_id) || 0;

    const amount = Number(transaction.amount || 0);

    if (!Number.isFinite(amount)) {
      continue;
    }

    if (transaction.direction === "inflow") {
      accountBalances.set(
        transaction.account_id,
        currentBalance + amount
      );
    }

    if (transaction.direction === "outflow") {
      accountBalances.set(
        transaction.account_id,
        currentBalance - amount
      );
    }
  }

  const accounts: CashAccount[] = (accountRows || []).map(
    (account) => ({
      ...account,
      balance:
        Math.round(
          (accountBalances.get(account.id) || 0) * 100
        ) / 100,
    })
  );

  return (
  <AccountsClient
  companyName={company?.name || "Company"}
  adminName={profile.full_name || user.email || "Founder"}
  currency={
    company?.currency ||
    (await getCompanyCurrency(
      supabase,
      profile.company_id
    ))
  }
  accounts={accounts}
  accountingAccounts={
  (accountingAccountRows || []) as AccountingAccount[]
}
accountingPeriods={
  (accountingPeriodRows || []) as AccountingPeriod[]
}
journalEntries={
  (journalEntryRows || []) as JournalEntry[]
}
journalLines={
  (journalLineRows || []) as JournalLine[]
}
createJournalEntry={createJournalEntry}
postJournalEntry={postJournalEntry}
generalLedger={
  generalLedgerRows || []
}
  categories={(categories || []) as CashCategory[]}
  transactions={transactions}
  error={params?.error}
  success={params?.success}
  addAccountingAccount={addAccountingAccount}
  updateAccountingAccount={updateAccountingAccount}
  archiveAccountingAccount={archiveAccountingAccount}
  addCashAccount={addCashAccount}
  updateCashAccount={updateCashAccount}
  archiveCashAccount={archiveCashAccount}
  restoreAccountingAccount={restoreAccountingAccount}
  createAccountingFiscalYear={
  createAccountingFiscalYear
}
softCloseAccountingPeriod={
  softCloseAccountingPeriod
}
reopenAccountingPeriod={
  reopenAccountingPeriod
}
lockAccountingPeriod={
  lockAccountingPeriod
}
addCashTransaction={addCashTransaction}
  transferCash={transferCash}
  notifications={notifications}
  userId={user.id}
/>
);
}