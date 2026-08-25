import type { SupabaseClient } from "@supabase/supabase-js";

type PostSaleToGeneralLedgerInput = {
  supabase: SupabaseClient;
  companyId: string;
  userId: string;
  saleId: string;
  saleDate: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalAmount: number;
};

const SALE_ACCOUNT_KEYS = [
  "cash_and_cash_equivalents",
  "sales_revenue",
  "inventory_asset",
  "cost_of_goods_sold",
] as const;

function roundMoney(value: number) {
  return Math.round(
    (value + Number.EPSILON) * 100
  ) / 100;
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

export async function postSaleToGeneralLedger({
  supabase,
  companyId,
  userId,
  saleId,
  saleDate,
  productName,
  quantity,
  unitCost,
  totalAmount,
}: PostSaleToGeneralLedgerInput) {
  const entryDate =
    saleDate.slice(0, 10);

  const saleReference =
    `SALE-${saleId
      .slice(0, 8)
      .toUpperCase()}`;

  const costOfGoodsSold =
    roundMoney(
      Number(unitCost || 0) *
        Number(quantity || 0)
    );

  const saleValue =
    roundMoney(totalAmount);

  if (
    !Number.isFinite(saleValue) ||
    saleValue <= 0
  ) {
    throw new Error(
      "The sale amount is invalid for General Ledger posting."
    );
  }

  /*
   * Protect against the same sale being
   * posted to accounting more than once.
   */
  const {
    data: existingJournal,
    error: existingJournalError,
  } = await supabase
    .from("journal_entries")
    .select("id, status, entry_number")
    .eq("company_id", companyId)
    .eq("source_type", "sale")
    .eq("source_id", saleId)
    .maybeSingle();

  if (existingJournalError) {
    throw new Error(
      existingJournalError.message
    );
  }

  if (existingJournal) {
    if (
      existingJournal.status ===
        "posted" ||
      existingJournal.status ===
        "reversed"
    ) {
      return {
        journalEntryId:
          existingJournal.id,
        entryNumber:
          existingJournal.entry_number,
      };
    }

    throw new Error(
      "A draft accounting journal already exists for this sale."
    );
  }

  const [
    companyResult,
    periodResult,
    accountResult,
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
      .in(
        "system_key",
        [...SALE_ACCOUNT_KEYS]
      ),
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

  if (accountResult.error) {
    throw new Error(
      accountResult.error.message
    );
  }

  const accountingAccounts =
    accountResult.data || [];

  const accountBySystemKey =
    new Map(
      accountingAccounts.map(
        (account) => [
          account.system_key,
          account,
        ]
      )
    );

  const cashAccount =
    accountBySystemKey.get(
      "cash_and_cash_equivalents"
    );

  const salesRevenueAccount =
    accountBySystemKey.get(
      "sales_revenue"
    );

  const inventoryAccount =
    accountBySystemKey.get(
      "inventory_asset"
    );

  const cogsAccount =
    accountBySystemKey.get(
      "cost_of_goods_sold"
    );

  if (
    !cashAccount ||
    !salesRevenueAccount ||
    !inventoryAccount ||
    !cogsAccount
  ) {
    throw new Error(
      "The default accounting accounts required for automatic sale posting are not configured."
    );
  }

  const blockedAccount =
    [
      cashAccount,
      salesRevenueAccount,
      inventoryAccount,
      cogsAccount,
    ].find(
      (account) =>
        account.status !== "active"
    );

  if (blockedAccount) {
    throw new Error(
      `${blockedAccount.code} — ${blockedAccount.name} must be active before sales can post to accounting.`
    );
  }

  const baseCurrency =
    String(
      companyResult.data.currency ||
        "GBP"
    ).toUpperCase();

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
      description:
        `${quantity} × ${productName} sale`,
      reference: saleReference,
      source_type: "sale",
      source_id: saleId,
      source_action:
        "automatic_sale_posting",
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
        "The sale accounting journal could not be created."
    );
  }

  const journalLines = [
    /*
     * Revenue side
     *
     * Dr Cash
     * Cr Product Sales
     */
    {
      company_id: companyId,
      journal_entry_id:
        journalEntry.id,
      line_number: 1,
      account_id:
        cashAccount.id,
      description:
        `Cash received for ${quantity} × ${productName}`,
      debit: saleValue,
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
        salesRevenueAccount.id,
      description:
        `Product sales revenue for ${quantity} × ${productName}`,
      debit: 0,
      credit: saleValue,
      currency_code:
        baseCurrency,
      exchange_rate: 1,
      created_by: userId,
    },
  ];

  /*
   * If inventory actually has a cost,
   * automatically recognize COGS.
   *
   * Dr Cost of Goods Sold
   * Cr Inventory
   */
  if (costOfGoodsSold > 0) {
    journalLines.push(
      {
        company_id: companyId,
        journal_entry_id:
          journalEntry.id,
        line_number: 3,
        account_id:
          cogsAccount.id,
        description:
          `Cost of goods sold for ${quantity} × ${productName}`,
        debit: costOfGoodsSold,
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
        line_number: 4,
        account_id:
          inventoryAccount.id,
        description:
          `Inventory reduction for ${quantity} × ${productName}`,
        debit: 0,
        credit: costOfGoodsSold,
        currency_code:
          baseCurrency,
        exchange_rate: 1,
        created_by: userId,
      }
    );
  }

  const {
    error: journalLinesError,
  } = await supabase
    .from("journal_lines")
    .insert(journalLines);

  if (journalLinesError) {
    await cleanUpDraftJournal(
      supabase,
      journalEntry.id,
      companyId
    );

    throw new Error(
      journalLinesError.message
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