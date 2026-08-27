import type { SupabaseClient } from "@supabase/supabase-js";

type PostExpenseToGeneralLedgerInput = {
  supabase: SupabaseClient;
  companyId: string;
  userId: string;
  expenseId: string;
  expenseDate: string;
  expenseName: string;
  category: string | null;
  payee: string | null;
  amount: number;
  paymentAccountingAccountId: string;
  paymentAccountName: string;
  paymentAccountCurrency: string;
};

const EXPENSE_CATEGORY_ACCOUNT_KEYS: Record<string, string> = {
  "inventory purchase": "inventory_asset",
  rent: "rent_expense",
  payroll: "wages_expense",
  marketing: "advertising_expense",
  shipping: "shipping_delivery_expense",
  utilities: "utilities_expense",
  software: "software_subscriptions_expense",
  travel: "travel_meals_expense",
  tax: "taxes_licenses_expense",
  other: "miscellaneous_expense",
};

function roundMoney(value: number) {
  return Math.round(
    (value + Number.EPSILON) * 100
  ) / 100;
}

function getDebitAccountSystemKey(
  category: string | null
) {
  const normalizedCategory = String(
    category || "Other"
  )
    .trim()
    .toLowerCase();

  return (
    EXPENSE_CATEGORY_ACCOUNT_KEYS[
      normalizedCategory
    ] || "miscellaneous_expense"
  );
}

async function cleanUpDraftJournal(
  supabase: SupabaseClient,
  journalEntryId: string,
  companyId: string
) {
  await supabase
    .from("journal_lines")
    .delete()
    .eq(
      "journal_entry_id",
      journalEntryId
    )
    .eq("company_id", companyId);

  await supabase
    .from("journal_entries")
    .delete()
    .eq("id", journalEntryId)
    .eq("company_id", companyId)
    .eq("status", "draft");
}

export async function postExpenseToGeneralLedger({
  supabase,
  companyId,
  userId,
  expenseId,
  expenseDate,
  expenseName,
  category,
  payee,
  amount,
  paymentAccountingAccountId,
  paymentAccountName,
  paymentAccountCurrency,
}: PostExpenseToGeneralLedgerInput) {
  const entryDate =
    String(expenseDate).slice(0, 10);

  const expenseAmount =
    roundMoney(Number(amount));

  if (
    !Number.isFinite(expenseAmount) ||
    expenseAmount <= 0
  ) {
    throw new Error(
      "The expense amount is invalid for General Ledger posting."
    );
  }

  if (!paymentAccountingAccountId) {
    throw new Error(
      "The selected financial account is not linked to the General Ledger."
    );
  }

  const debitSystemKey =
    getDebitAccountSystemKey(category);

  /*
   * Prevent the same operational expense from
   * being posted to accounting more than once.
   */
  const {
    data: existingJournal,
    error: existingJournalError,
  } = await supabase
    .from("journal_entries")
    .select(
      "id, status, entry_number"
    )
    .eq("company_id", companyId)
    .eq("source_type", "expense")
    .eq("source_id", expenseId)
    .maybeSingle();

  if (existingJournalError) {
    throw new Error(
      existingJournalError.message
    );
  }

  if (existingJournal) {
    if (
      existingJournal.status === "posted" ||
      existingJournal.status === "reversed"
    ) {
      return {
        journalEntryId:
          existingJournal.id,
        entryNumber:
          existingJournal.entry_number,
      };
    }

    throw new Error(
      "A draft accounting journal already exists for this expense."
    );
  }

  const [
    companyResult,
    periodResult,
    debitAccountResult,
    paymentAccountResult,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("currency")
      .eq("id", companyId)
      .single(),

    supabase
      .from("accounting_periods")
      .select(
        "id, status, start_date, end_date"
      )
      .eq("company_id", companyId)
      .eq("status", "open")
      .eq(
        "is_adjustment_period",
        false
      )
      .lte(
        "start_date",
        entryDate
      )
      .gte(
        "end_date",
        entryDate
      )
      .maybeSingle(),

    supabase
      .from("accounting_accounts")
      .select(
        "id, code, name, system_key, status"
      )
      .eq("company_id", companyId)
      .eq(
        "system_key",
        debitSystemKey
      )
      .maybeSingle(),

    supabase
      .from("accounting_accounts")
      .select(
        "id, code, name, account_type, account_subtype, currency_code, status"
      )
      .eq(
        "id",
        paymentAccountingAccountId
      )
      .eq("company_id", companyId)
      .maybeSingle(),
  ]);

  if (
    companyResult.error ||
    !companyResult.data
  ) {
    throw new Error(
      companyResult.error?.message ||
        "Company accounting currency could not be loaded."
    );
  }

  if (
    periodResult.error ||
    !periodResult.data
  ) {
    throw new Error(
      periodResult.error?.message ||
        `No open accounting period contains ${entryDate}.`
    );
  }

  if (
    debitAccountResult.error ||
    !debitAccountResult.data
  ) {
    throw new Error(
      debitAccountResult.error?.message ||
        `The required accounting account "${debitSystemKey}" is not configured.`
    );
  }

  if (
    paymentAccountResult.error ||
    !paymentAccountResult.data
  ) {
    throw new Error(
      paymentAccountResult.error?.message ||
        "The selected financial account is not linked to a valid General Ledger account."
    );
  }

  const debitAccount =
    debitAccountResult.data;

  const paymentAccount =
    paymentAccountResult.data;

  if (
    debitAccount.status !== "active"
  ) {
    throw new Error(
      `${debitAccount.code} — ${debitAccount.name} must be active before this expense can post to accounting.`
    );
  }

  if (
    paymentAccount.status !== "active"
  ) {
    throw new Error(
      `${paymentAccount.code} — ${paymentAccount.name} must be active before this expense can post to accounting.`
    );
  }

  const baseCurrency = String(
    companyResult.data.currency || "GBP"
  )
    .trim()
    .toUpperCase();

  const operationalCurrency = String(
    paymentAccountCurrency ||
      baseCurrency
  )
    .trim()
    .toUpperCase();

  /*
   * Expense records currently contain one amount,
   * rather than transaction currency + exchange
   * rate + base amount.
   *
   * Until multi-currency accounting is connected,
   * do not silently post a foreign-currency amount
   * into the company's base-currency ledger.
   */
  if (
    operationalCurrency !==
    baseCurrency
  ) {
    throw new Error(
      `Automatic expense posting currently requires the payment account currency (${operationalCurrency}) to match the company base currency (${baseCurrency}).`
    );
  }

  const linkedGlCurrency = String(
    paymentAccount.currency_code ||
      baseCurrency
  )
    .trim()
    .toUpperCase();

  if (
    linkedGlCurrency !==
    baseCurrency
  ) {
    throw new Error(
      `The linked General Ledger account currency (${linkedGlCurrency}) must match the company base currency (${baseCurrency}) for automatic expense posting.`
    );
  }

  const reference =
    `EXP-${expenseId
      .slice(0, 8)
      .toUpperCase()}`;

  const description = payee
    ? `${expenseName} · ${payee}`
    : expenseName;

  const {
    data: journalEntry,
    error: journalEntryError,
  } = await supabase
    .from("journal_entries")
    .insert({
      company_id: companyId,
      accounting_period_id:
        periodResult.data.id,
      entry_date: entryDate,
      description,
      reference,
      source_type: "expense",
      source_id: expenseId,
      source_action:
        "automatic_expense_posting",
      base_currency_code:
        baseCurrency,
      status: "draft",
      created_by: userId,
    })
    .select("id")
    .single();

  if (
    journalEntryError ||
    !journalEntry
  ) {
    throw new Error(
      journalEntryError?.message ||
        "The expense accounting journal could not be created."
    );
  }

  /*
   * Normal paid expense:
   *
   * Dr Expense
   * Cr Exact linked financial account
   *
   * Inventory Purchase:
   *
   * Dr Inventory
   * Cr Exact linked financial account
   *
   * The linked financial account may be:
   * - bank / cash asset
   * - credit-card liability
   * - loan liability
   * - payment processor asset
   */
  const { error: linesError } =
    await supabase
      .from("journal_lines")
      .insert([
        {
          company_id: companyId,
          journal_entry_id:
            journalEntry.id,
          line_number: 1,
          account_id:
            debitAccount.id,
          description:
            category ===
            "Inventory Purchase"
              ? `Inventory purchase · ${description}`
              : `${description} · ${category || "Other"}`,
          debit: expenseAmount,
          credit: 0,
          currency_code:
            baseCurrency,
          exchange_rate: 1,
          created_by: userId,
        },

        {
          company_id: companyId,
          journal_entry_id:
            journalEntry.id,
          line_number: 2,
          account_id:
            paymentAccount.id,
          description:
            `Paid from ${paymentAccountName}`,
          debit: 0,
          credit: expenseAmount,
          currency_code:
            baseCurrency,
          exchange_rate: 1,
          created_by: userId,
        },
      ]);

  if (linesError) {
    await cleanUpDraftJournal(
      supabase,
      journalEntry.id,
      companyId
    );

    throw new Error(
      linesError.message
    );
  }

  const {
    data: postingResult,
    error: postingError,
  } = await supabase.rpc(
    "post_journal_entry",
    {
      p_journal_entry_id:
        journalEntry.id,
    }
  );

  if (postingError) {
    await cleanUpDraftJournal(
      supabase,
      journalEntry.id,
      companyId
    );

    throw new Error(
      postingError.message
    );
  }

  const postedResult =
    Array.isArray(postingResult)
      ? postingResult[0]
      : postingResult;

  return {
    journalEntryId:
      journalEntry.id,
    entryNumber:
      postedResult?.entry_number ??
      null,
  };
}