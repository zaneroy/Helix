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
  paymentAccountingAccountId: string;
};

const SALE_ACCOUNT_KEYS = [
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
  paymentAccountingAccountId,
}: PostSaleToGeneralLedgerInput) {
  const entryDate =
    String(saleDate).slice(0, 10);

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
    roundMoney(
      Number(totalAmount)
    );

  if (
    !Number.isFinite(saleValue) ||
    saleValue <= 0
  ) {
    throw new Error(
      "The sale amount is invalid for General Ledger posting."
    );
  }

  if (!paymentAccountingAccountId) {
    throw new Error(
      "The selected financial account is not linked to the General Ledger."
    );
  }

  /*
   * Prevent the same operational sale from
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
      .in(
        "system_key",
        [...SALE_ACCOUNT_KEYS]
      ),

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

  if (accountResult.error) {
    throw new Error(
      accountResult.error.message
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

  const paymentAccount =
    paymentAccountResult.data;

  if (
    paymentAccount.status !== "active"
  ) {
    throw new Error(
      `${paymentAccount.code} — ${paymentAccount.name} must be active before sales can post to accounting.`
    );
  }

  /*
   * Sales receipts must go into an asset account:
   * bank, cash, petty cash, processor, etc.
   *
   * A credit-card or loan liability should not
   * be used as the destination for sale proceeds.
   */
  if (
    paymentAccount.account_type !==
    "asset"
  ) {
    throw new Error(
      `${paymentAccount.code} — ${paymentAccount.name} cannot receive sales because its General Ledger account is not an asset account.`
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
      paymentAccount,
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
    )
      .trim()
      .toUpperCase();

  const paymentAccountCurrency =
    String(
      paymentAccount.currency_code ||
        baseCurrency
    )
      .trim()
      .toUpperCase();

  /*
   * Until multi-currency accounting is connected,
   * the destination GL account must use the company
   * base currency.
   */
  if (
    paymentAccountCurrency !==
    baseCurrency
  ) {
    throw new Error(
      `Automatic sale posting currently requires the selected financial account currency (${paymentAccountCurrency}) to match the company base currency (${baseCurrency}).`
    );
  }

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
     * Sale proceeds:
     *
     * Dr Exact selected bank/cash GL account
     * Cr Product Sales
     */
    {
      company_id: companyId,
      journal_entry_id:
        journalEntry.id,
      line_number: 1,
      account_id:
        paymentAccount.id,
      description:
        `Received into ${paymentAccount.name} for ${quantity} × ${productName}`,
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
   * Inventory cost recognition:
   *
   * Dr Cost of Goods Sold
   * Cr Inventory
   *
   * This is a non-cash accounting movement.
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