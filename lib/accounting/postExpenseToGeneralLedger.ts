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
  paymentAccountType: string;
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

function getCreditAccountSystemKey(
  paymentAccountType: string
) {
  const normalizedType = String(
    paymentAccountType || ""
  )
    .trim()
    .toLowerCase();

  /*
   * Credit-card purchases create a liability.
   *
   * Dr Expense / Asset
   * Cr Credit Cards Payable
   */
  if (normalizedType === "credit_card") {
    return "credit_card_payable";
  }

  /*
   * If something is directly financed from a
   * loan-type operational account, increase the
   * short-term loan liability.
   */
  if (normalizedType === "loan") {
    return "short_term_loans";
  }

  /*
   * Bank, cash, petty cash, payment processors
   * and other cash-like operational accounts use
   * the current generic GL cash control account.
   *
   * Later the Accounts integration will map each
   * operational cash account to its own GL account.
   */
  return "cash_and_cash_equivalents";
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
  paymentAccountType,
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

  const debitSystemKey =
    getDebitAccountSystemKey(category);

  const creditSystemKey =
    getCreditAccountSystemKey(
      paymentAccountType
    );

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
    accountsResult,
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
      .in("system_key", [
        debitSystemKey,
        creditSystemKey,
      ]),
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

  if (accountsResult.error) {
    throw new Error(
      accountsResult.error.message
    );
  }

  const baseCurrency = String(
    companyResult.data.currency || "GBP"
  ).toUpperCase();

  const operationalCurrency = String(
    paymentAccountCurrency ||
      baseCurrency
  ).toUpperCase();

  /*
   * Expense records currently contain one amount,
   * not transaction currency + exchange rate +
   * base amount. Until the multi-currency posting
   * engine is connected, refuse to silently post
   * a foreign-currency amount as base currency.
   */
  if (
    operationalCurrency !==
    baseCurrency
  ) {
    throw new Error(
      `Automatic expense posting currently requires the payment account currency (${operationalCurrency}) to match the company base currency (${baseCurrency}).`
    );
  }

  const accountMap = new Map(
    (accountsResult.data || []).map(
      (account) => [
        account.system_key,
        account,
      ]
    )
  );

  const debitAccount =
    accountMap.get(debitSystemKey);

  const creditAccount =
    accountMap.get(creditSystemKey);

  if (!debitAccount) {
    throw new Error(
      `The required accounting account "${debitSystemKey}" is not configured.`
    );
  }

  if (!creditAccount) {
    throw new Error(
      `The required accounting account "${creditSystemKey}" is not configured.`
    );
  }

  if (
    debitAccount.status !== "active"
  ) {
    throw new Error(
      `${debitAccount.code} — ${debitAccount.name} must be active before this expense can post to accounting.`
    );
  }

  if (
    creditAccount.status !== "active"
  ) {
    throw new Error(
      `${creditAccount.code} — ${creditAccount.name} must be active before this expense can post to accounting.`
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
   * Cr Cash / Credit Card / Loan
   *
   * Inventory Purchase:
   *
   * Dr Inventory
   * Cr Cash / Credit Card / Loan
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
            creditAccount.id,
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