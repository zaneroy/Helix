import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getUserNotifications } from "@/lib/notifications/server";
import { emitEvent } from "@/lib/events/emitEvent";

import ExpensesClient from "./ExpensesClient";

export type ExpenseSubmitter = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

export type Expense = {
  id: string;
  title: string | null;
  category: string | null;
  amount: number | string | null;
  payee: string | null;
  payment_method: string | null;
  expense_date: string | null;
  notes: string | null;
  status: string | null;
  created_by: string | null;
  submitted_by: ExpenseSubmitter | null;
};

export type ImportedExpenseRow = {
  expense_date?: string;
  date?: string;
  title?: string;
  expense_name?: string;
  category?: string;
  amount?: number | string;
  payee?: string;
  vendor?: string;
  payment_method?: string;
  account?: string;
  account_id?: string;
  notes?: string;
};

type ExpenseDecision = "approved" | "rejected";

type CashAccountRow = {
  id: string;
  name: string;
  currency: string;
};

type ExpenseAccountOptionRow = {
  id: string;
  name: string;
  account_type: string;
  currency: string;
  status: string;
  opening_balance: number | string | null;
};

type AccountLedgerBalanceRow = {
  account_id: string | null;
  direction: string;
  amount: number | string | null;
  status: string | null;
};

type ExpenseLedgerRow = {
  id: string;
  account_id: string | null;
  category_id: string | null;
  amount: number | string;
  category: string | null;
  description: string | null;
  reference: string | null;
  transaction_date: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
};

function getExpenseErrorMessage(
  error: { message?: string } | null | undefined
) {
  return error?.message || "Something went wrong. Please try again.";
}

function getExpenseName(expense: {
  title?: string | null;
  category?: string | null;
}) {
  return expense.title || expense.category || "Expense";
}

function getPersonName(person: {
  full_name?: string | null;
  email?: string | null;
}) {
  return person.full_name || person.email || "Employee";
}

function displayValue(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  return normalized || "blank";
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function isExpenseDecision(value: string): value is ExpenseDecision {
  return value === "approved" || value === "rejected";
}

function normalizeExpenseDate(value: string | null | undefined) {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return new Date().toISOString();
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return `${rawValue}T12:00:00.000Z`;
  }

  const parsed = new Date(rawValue);

  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

async function getAdminProfile() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, company_id, role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || !profile.company_id) {
    redirect("/admin/login");
  }

  return { supabase, user, profile };
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

async function getExpenseCashAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  requestedAccountId?: string | null
): Promise<CashAccountRow | null> {
  if (requestedAccountId) {
    const { data: requestedAccount } = await supabase
      .from("cash_accounts")
      .select("id, name, currency")
      .eq("id", requestedAccountId)
      .eq("company_id", companyId)
      .eq("status", "active")
      .maybeSingle();

    if (requestedAccount) {
      return requestedAccount as CashAccountRow;
    }
  }

  const { data: defaultAccount } = await supabase
    .from("cash_accounts")
    .select("id, name, currency")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (defaultAccount as CashAccountRow | null) || null;
}

async function getExpenseCategoryId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  expenseCategory: string | null | undefined
) {
  const normalizedCategory = String(expenseCategory || "").trim();

  if (normalizedCategory) {
    const { data: exactCategory } = await supabase
      .from("cash_categories")
      .select("id")
      .eq("company_id", companyId)
      .eq("status", "active")
      .eq("category_type", "expense")
      .ilike("name", normalizedCategory)
      .limit(1)
      .maybeSingle();

    if (exactCategory?.id) {
      return exactCategory.id as string;
    }
  }

  const { data: fallbackCategory } = await supabase
    .from("cash_categories")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "active")
    .eq("category_type", "expense")
    .order("is_system", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (fallbackCategory?.id as string | undefined) || null;
}

async function getExpenseLedgerEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  expenseId: string
) {
  const { data, error } = await supabase
    .from("cash_ledger")
    .select(
      "id, account_id, category_id, amount, category, description, reference, transaction_date, status, metadata"
    )
    .eq("company_id", companyId)
    .eq("source_type", "expense")
    .eq("source_id", expenseId)
    .maybeSingle();

  if (error) {
    return { entry: null, error };
  }

  return {
    entry: (data as ExpenseLedgerRow | null) || null,
    error: null,
  };
}

async function createExpenseLedgerEntry({
  supabase,
  companyId,
  expense,
  account,
  createdBy,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  companyId: string;
  expense: {
    id: string;
    title: string | null;
    category: string | null;
    amount: number | string | null;
    payee: string | null;
    payment_method: string | null;
    expense_date: string | null;
    created_by: string | null;
  };
  account: CashAccountRow;
  createdBy: string;
}) {
  const existingResult = await getExpenseLedgerEntry(
    supabase,
    companyId,
    expense.id
  );

  if (existingResult.error) {
    return {
      entryId: null,
      error: existingResult.error,
      duplicate: false,
    };
  }

  if (existingResult.entry?.status === "completed") {
    return {
      entryId: existingResult.entry.id,
      error: null,
      duplicate: true,
    };
  }

  const amount = Number(expense.amount || 0);
  const expenseName = getExpenseName(expense);
  const categoryName =
    String(expense.category || "").trim() || "Expense";
  const categoryId = await getExpenseCategoryId(
    supabase,
    companyId,
    expense.category
  );
  const transactionDate = normalizeExpenseDate(expense.expense_date);
  const entryId = existingResult.entry?.id || randomUUID();
  const reference =
    existingResult.entry?.reference ||
    `EXP-${expense.id.slice(0, 8).toUpperCase()}`;

  const ledgerPayload = {
    company_id: companyId,
    account_id: account.id,
    category_id: categoryId,
    source_type: "expense",
    source_id: expense.id,
    direction: "outflow",
    amount,
    category: categoryName,
    description: expense.payee
      ? `${expenseName} · ${expense.payee}`
      : expenseName,
    reference,
    transaction_date: transactionDate,
    status: "completed",
    reconciled: false,
    reconciled_at: null,
    created_by: createdBy,
    metadata: {
      expenseId: expense.id,
      expenseTitle: expense.title,
      expenseCategory: expense.category,
      payee: expense.payee,
      paymentMethod: expense.payment_method,
      submittedBy: expense.created_by,
      postedBy: createdBy,
      postedAt: new Date().toISOString(),
      accountId: account.id,
      accountName: account.name,
    },
  };

  if (existingResult.entry) {
    const { error } = await supabase
      .from("cash_ledger")
      .update(ledgerPayload)
      .eq("id", existingResult.entry.id)
      .eq("company_id", companyId);

    return {
      entryId: existingResult.entry.id,
      error,
      duplicate: false,
    };
  }

  const { error } = await supabase.from("cash_ledger").insert({
    id: entryId,
    ...ledgerPayload,
  });

  return {
    entryId,
    error,
    duplicate: false,
  };
}

async function updateExpenseLedgerEntry({
  supabase,
  companyId,
  expense,
  actorId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  companyId: string;
  expense: {
    id: string;
    title: string | null;
    category: string | null;
    amount: number | string | null;
    payee: string | null;
    payment_method: string | null;
    expense_date: string | null;
    created_by: string | null;
  };
  actorId: string;
}) {
  const existingResult = await getExpenseLedgerEntry(
    supabase,
    companyId,
    expense.id
  );

  if (existingResult.error || !existingResult.entry) {
    return {
      error:
        existingResult.error ||
        new Error("The linked Accounts entry could not be found."),
      entry: existingResult.entry,
    };
  }

  const categoryId = await getExpenseCategoryId(
    supabase,
    companyId,
    expense.category
  );
  const expenseName = getExpenseName(expense);
  const previousMetadata =
    existingResult.entry.metadata &&
    typeof existingResult.entry.metadata === "object"
      ? existingResult.entry.metadata
      : {};

  const { error } = await supabase
    .from("cash_ledger")
    .update({
      category_id: categoryId,
      amount: Number(expense.amount || 0),
      category:
        String(expense.category || "").trim() || "Expense",
      description: expense.payee
        ? `${expenseName} · ${expense.payee}`
        : expenseName,
      transaction_date: normalizeExpenseDate(expense.expense_date),
      metadata: {
        ...previousMetadata,
        expenseTitle: expense.title,
        expenseCategory: expense.category,
        payee: expense.payee,
        paymentMethod: expense.payment_method,
        updatedBy: actorId,
        updatedAt: new Date().toISOString(),
      },
    })
    .eq("id", existingResult.entry.id)
    .eq("company_id", companyId);

  return {
    error,
    entry: existingResult.entry,
  };
}

async function reverseExpenseLedgerEntry({
  supabase,
  companyId,
  expenseId,
  actorId,
  reason,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  companyId: string;
  expenseId: string;
  actorId: string;
  reason: string;
}) {
  const existingResult = await getExpenseLedgerEntry(
    supabase,
    companyId,
    expenseId
  );

  if (existingResult.error) {
    return { error: existingResult.error, entry: null };
  }

  if (!existingResult.entry) {
    return { error: null, entry: null };
  }

  const previousMetadata =
    existingResult.entry.metadata &&
    typeof existingResult.entry.metadata === "object"
      ? existingResult.entry.metadata
      : {};

  const { error } = await supabase
    .from("cash_ledger")
    .update({
      status: "reversed",
      reconciled: false,
      reconciled_at: null,
      metadata: {
        ...previousMetadata,
        reversedBy: actorId,
        reversedAt: new Date().toISOString(),
        reversalReason: reason,
      },
    })
    .eq("id", existingResult.entry.id)
    .eq("company_id", companyId);

  return {
    error,
    entry: existingResult.entry,
  };
}

function revalidateExpensePages() {
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");
  revalidatePath("/employee/expenses");
  revalidatePath("/employee");
}

async function addExpense(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminProfile();

  const title = String(formData.get("title") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const payee = String(formData.get("payee") || "").trim();
  const paymentMethod = String(
    formData.get("payment_method") || ""
  ).trim();
  const expenseDate =
    String(formData.get("expense_date") || "") || null;
  const notes = String(formData.get("notes") || "").trim();
  const requestedAccountId = String(
    formData.get("account_id") || ""
  ).trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    redirect(
      "/dashboard/expenses?error=Please enter a valid expense amount."
    );
  }

  const account = await getExpenseCashAccount(
    supabase,
    profile.company_id,
    requestedAccountId || null
  );

  if (!account) {
    redirect(
      "/dashboard/expenses?error=Create an active financial account in Accounts before adding an approved expense."
    );
  }

  const { data: createdExpense, error } = await supabase
    .from("expenses")
    .insert({
      company_id: profile.company_id,
      created_by: user.id,
      title,
      category,
      amount,
      payee,
      payment_method: paymentMethod,
      expense_date: expenseDate,
      notes,
      status: "approved",
    })
    .select(
      "id, title, category, amount, payee, payment_method, expense_date, status, created_by"
    )
    .single();

  if (error || !createdExpense) {
    redirect(
      `/dashboard/expenses?error=${encodeURIComponent(
        getExpenseErrorMessage(error)
      )}`
    );
  }

  const ledgerResult = await createExpenseLedgerEntry({
    supabase,
    companyId: profile.company_id,
    expense: createdExpense,
    account,
    createdBy: user.id,
  });

  if (ledgerResult.error) {
    await supabase
      .from("expenses")
      .delete()
      .eq("id", createdExpense.id)
      .eq("company_id", profile.company_id);

    redirect(
      `/dashboard/expenses?error=${encodeURIComponent(
        `The expense was not saved because Accounts could not be updated: ${getExpenseErrorMessage(
          ledgerResult.error
        )}`
      )}`
    );
  }

  const currency = account.currency;
  const expenseName = getExpenseName(createdExpense);
  const formattedAmount = formatMoney(amount, currency);

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id],
    type: "expense_created",
    title: "Expense added",
    message: `${expenseName} was added for ${formattedAmount} and posted to ${account.name}.`,
    actionUrl: "/dashboard/expenses",
    metadata: {
      expenseId: createdExpense.id,
      ledgerEntryId: ledgerResult.entryId,
      accountId: account.id,
      accountName: account.name,
      title,
      category,
      amount,
      currency,
      payee,
      paymentMethod,
      expenseDate,
      status: createdExpense.status,
      createdBy: user.id,
      ledgerPosted: true,
    },
  });

  revalidateExpensePages();

  redirect(
    "/dashboard/expenses?success=Expense added and posted to Accounts successfully."
  );
}

async function importExpenses(
  rows: ImportedExpenseRow[]
): Promise<{
  imported: number;
  failed: number;
  skipped: number;
}> {
  "use server";

  const { supabase, user, profile } = await getAdminProfile();

  let imported = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const title = String(
        row.title || row.expense_name || ""
      ).trim();

      const category = String(row.category || "").trim();

      const amount = Number(row.amount || 0);

      const payee = String(
        row.payee || row.vendor || ""
      ).trim();

      const paymentMethod = String(
        row.payment_method || ""
      ).trim();

      const expenseDate =
        String(
          row.expense_date ||
            row.date ||
            ""
        ).trim() || null;

      const notes = String(row.notes || "").trim();

      const requestedAccount = String(
        row.account_id ||
          row.account ||
          ""
      ).trim();

      if (
        !title ||
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        failed++;
        continue;
      }

      let requestedAccountId: string | null = null;

      if (requestedAccount) {
        const { data: accountById } = await supabase
          .from("cash_accounts")
          .select("id")
          .eq("company_id", profile.company_id)
          .eq("status", "active")
          .eq("id", requestedAccount)
          .maybeSingle();

        if (accountById?.id) {
          requestedAccountId = accountById.id;
        } else {
          const { data: accountByName } = await supabase
            .from("cash_accounts")
            .select("id")
            .eq("company_id", profile.company_id)
            .eq("status", "active")
            .ilike("name", requestedAccount)
            .limit(1)
            .maybeSingle();

          requestedAccountId = accountByName?.id || null;
        }
      }

      const account = await getExpenseCashAccount(
        supabase,
        profile.company_id,
        requestedAccountId
      );

      if (!account) {
        failed++;
        continue;
      }

      /*
       * Basic duplicate protection:
       * same company, title, amount and date.
       */
      let duplicateQuery = supabase
        .from("expenses")
        .select("id")
        .eq("company_id", profile.company_id)
        .eq("title", title)
        .eq("amount", amount);

      if (expenseDate) {
        duplicateQuery = duplicateQuery.eq(
          "expense_date",
          expenseDate
        );
      }

      const { data: duplicate } = await duplicateQuery
        .limit(1)
        .maybeSingle();

      if (duplicate?.id) {
        skipped++;
        continue;
      }

      const { data: createdExpense, error } = await supabase
        .from("expenses")
        .insert({
          company_id: profile.company_id,
          created_by: user.id,
          title,
          category,
          amount,
          payee,
          payment_method: paymentMethod,
          expense_date: expenseDate,
          notes,
          status: "approved",
        })
        .select(
          "id, title, category, amount, payee, payment_method, expense_date, status, created_by"
        )
        .single();

      if (error || !createdExpense) {
        failed++;
        continue;
      }

      const ledgerResult =
        await createExpenseLedgerEntry({
          supabase,
          companyId: profile.company_id,
          expense: createdExpense,
          account,
          createdBy: user.id,
        });

      if (ledgerResult.error) {
        await supabase
          .from("expenses")
          .delete()
          .eq("id", createdExpense.id)
          .eq("company_id", profile.company_id);

        failed++;
        continue;
      }

      imported++;
    } catch (error) {
      console.error(
        "Expense CSV row import failed:",
        error
      );

      failed++;
    }
  }

  if (imported > 0) {
    await emitEvent({
      companyId: profile.company_id,
      actorId: user.id,
      recipients: [user.id],
      type: "expenses_imported",
      title: "Expenses imported",
      message: `${imported} expense${
        imported === 1 ? "" : "s"
      } imported from CSV.`,
      actionUrl: "/dashboard/expenses",
      metadata: {
        imported,
        failed,
        skipped,
        importedBy: user.id,
        importedAt: new Date().toISOString(),
      },
    });
  }

  revalidateExpensePages();

  return {
    imported,
    failed,
    skipped,
  };
}

async function updateExpense(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminProfile();

  const expenseId = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const payee = String(formData.get("payee") || "").trim();
  const paymentMethod = String(
    formData.get("payment_method") || ""
  ).trim();
  const expenseDate =
    String(formData.get("expense_date") || "") || null;
  const notes = String(formData.get("notes") || "").trim();

  if (!expenseId) {
    redirect("/dashboard/expenses?error=Expense not found.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    redirect(
      "/dashboard/expenses?error=Please enter a valid expense amount."
    );
  }

  const { data: previousExpense, error: lookupError } = await supabase
    .from("expenses")
    .select(
      "id, title, category, amount, payee, payment_method, expense_date, notes, status, created_by"
    )
    .eq("id", expenseId)
    .eq("company_id", profile.company_id)
    .single();

  if (lookupError || !previousExpense) {
    redirect("/dashboard/expenses?error=Expense not found.");
  }

  const updatedExpense = {
    ...previousExpense,
    title,
    category,
    amount,
    payee,
    payment_method: paymentMethod,
    expense_date: expenseDate,
    notes,
  };

  const { error } = await supabase
    .from("expenses")
    .update({
      title,
      category,
      amount,
      payee,
      payment_method: paymentMethod,
      expense_date: expenseDate,
      notes,
    })
    .eq("id", expenseId)
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      `/dashboard/expenses?error=${encodeURIComponent(
        getExpenseErrorMessage(error)
      )}`
    );
  }

  let ledgerUpdated = false;
  let ledgerEntryId: string | null = null;

  if (previousExpense.status === "approved") {
    const ledgerResult = await updateExpenseLedgerEntry({
      supabase,
      companyId: profile.company_id,
      expense: updatedExpense,
      actorId: user.id,
    });

    if (ledgerResult.error) {
      await supabase
        .from("expenses")
        .update({
          title: previousExpense.title,
          category: previousExpense.category,
          amount: previousExpense.amount,
          payee: previousExpense.payee,
          payment_method: previousExpense.payment_method,
          expense_date: previousExpense.expense_date,
          notes: previousExpense.notes,
        })
        .eq("id", expenseId)
        .eq("company_id", profile.company_id);

      redirect(
        `/dashboard/expenses?error=${encodeURIComponent(
          `The expense was not changed because its Accounts entry could not be updated: ${getExpenseErrorMessage(
            ledgerResult.error
          )}`
        )}`
      );
    }

    ledgerUpdated = true;
    ledgerEntryId = ledgerResult.entry?.id || null;
  }

  const changes: string[] = [];

  if ((previousExpense.title || "") !== title) {
    changes.push(
      `title "${displayValue(previousExpense.title)}" → "${displayValue(
        title
      )}"`
    );
  }

  if ((previousExpense.category || "") !== category) {
    changes.push(
      `category "${displayValue(
        previousExpense.category
      )}" → "${displayValue(category)}"`
    );
  }

  const previousAmount = Number(previousExpense.amount || 0);

  if (previousAmount !== amount) {
    changes.push(
      `amount ${previousAmount.toFixed(2)} → ${amount.toFixed(2)}`
    );
  }

  if ((previousExpense.payee || "") !== payee) {
    changes.push(
      `payee "${displayValue(previousExpense.payee)}" → "${displayValue(
        payee
      )}"`
    );
  }

  if ((previousExpense.payment_method || "") !== paymentMethod) {
    changes.push(
      `payment method "${displayValue(
        previousExpense.payment_method
      )}" → "${displayValue(paymentMethod)}"`
    );
  }

  if ((previousExpense.expense_date || null) !== expenseDate) {
    changes.push(
      `date "${displayValue(
        previousExpense.expense_date
      )}" → "${displayValue(expenseDate)}"`
    );
  }

  if ((previousExpense.notes || "") !== notes) {
    changes.push("notes updated");
  }

  const expenseName = title || getExpenseName(previousExpense);

  const message =
    changes.length > 0
      ? `${expenseName}: ${changes.join("; ")}.${
          ledgerUpdated ? " The Accounts entry was updated." : ""
        }`
      : `${expenseName} was saved with no visible field changes.`;

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id],
    type: "expense_updated",
    title: "Expense updated",
    message,
    actionUrl: "/dashboard/expenses",
    metadata: {
      expenseId,
      ledgerEntryId,
      ledgerUpdated,
      changedFields: changes,
      previous: {
        title: previousExpense.title,
        category: previousExpense.category,
        amount: previousAmount,
        payee: previousExpense.payee,
        paymentMethod: previousExpense.payment_method,
        expenseDate: previousExpense.expense_date,
        notes: previousExpense.notes,
        status: previousExpense.status,
      },
      updated: {
        title,
        category,
        amount,
        payee,
        paymentMethod,
        expenseDate,
        notes,
        status: previousExpense.status,
      },
    },
  });

  revalidateExpensePages();

  redirect("/dashboard/expenses?success=Expense updated successfully.");
}

async function reviewEmployeeExpense(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminProfile();

  const expenseId = String(formData.get("id") || "").trim();
  const requestedDecision = String(
    formData.get("decision") || ""
  ).trim();
  const requestedAccountId = String(
    formData.get("account_id") || ""
  ).trim();

  if (!expenseId || !isExpenseDecision(requestedDecision)) {
    redirect(
      "/dashboard/expenses?error=Invalid expense review action."
    );
  }

  const decision = requestedDecision;

  const { data: expense, error: expenseError } = await supabase
    .from("expenses")
    .select(
      "id, company_id, created_by, title, category, amount, payee, payment_method, expense_date, notes, status"
    )
    .eq("id", expenseId)
    .eq("company_id", profile.company_id)
    .single();

  if (expenseError || !expense) {
    redirect("/dashboard/expenses?error=Expense claim not found.");
  }

  if (!expense.created_by) {
    redirect(
      "/dashboard/expenses?error=This expense is not linked to an employee."
    );
  }

  const { data: employee, error: employeeError } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, company_id")
    .eq("id", expense.created_by)
    .eq("company_id", profile.company_id)
    .eq("role", "employee")
    .single();

  if (employeeError || !employee) {
    redirect(
      "/dashboard/expenses?error=The employee who submitted this expense could not be found."
    );
  }

  const previousStatus = expense.status || "submitted";

  if (previousStatus !== "submitted") {
    redirect(
      `/dashboard/expenses?error=${encodeURIComponent(
        `This expense has already been ${previousStatus}.`
      )}`
    );
  }

  let account: CashAccountRow | null = null;
  let ledgerEntryId: string | null = null;

  if (decision === "approved") {
    account = await getExpenseCashAccount(
      supabase,
      profile.company_id,
      requestedAccountId || null
    );

    if (!account) {
      redirect(
        "/dashboard/expenses?error=Create an active financial account in Accounts before approving an expense."
      );
    }

    const ledgerResult = await createExpenseLedgerEntry({
      supabase,
      companyId: profile.company_id,
      expense,
      account,
      createdBy: user.id,
    });

    if (ledgerResult.error) {
      redirect(
        `/dashboard/expenses?error=${encodeURIComponent(
          `The expense was not approved because Accounts could not be updated: ${getExpenseErrorMessage(
            ledgerResult.error
          )}`
        )}`
      );
    }

    ledgerEntryId = ledgerResult.entryId;
  }

  const { error: updateError } = await supabase
    .from("expenses")
    .update({
      status: decision,
    })
    .eq("id", expenseId)
    .eq("company_id", profile.company_id)
    .eq("status", "submitted");

  if (updateError) {
    if (decision === "approved" && ledgerEntryId) {
      await reverseExpenseLedgerEntry({
        supabase,
        companyId: profile.company_id,
        expenseId,
        actorId: user.id,
        reason: "Expense approval status update failed",
      });
    }

    redirect(
      `/dashboard/expenses?error=${encodeURIComponent(
        updateError.message
      )}`
    );
  }

  const currency =
    account?.currency ||
    (await getCompanyCurrency(supabase, profile.company_id));
  const expenseName = getExpenseName(expense);
  const employeeName = getPersonName(employee);
  const adminName = profile.full_name || user.email || "Founder";
  const amount = Number(expense.amount || 0);
  const formattedAmount = formatMoney(amount, currency);

  const eventType =
    decision === "approved"
      ? "employee_expense_approved"
      : "employee_expense_rejected";

  const eventTitle =
    decision === "approved"
      ? "Employee expense approved"
      : "Employee expense rejected";

  const companyMessage =
    `${adminName} ${decision} ${employeeName}'s expense claim ` +
    `"${expenseName}" for ${formattedAmount}.` +
    (decision === "approved" && account
      ? ` It was posted to ${account.name}.`
      : "");

  const adminMessage =
    `You ${decision} ${employeeName}'s expense claim ` +
    `"${expenseName}" for ${formattedAmount}.`;

  const employeeMessage =
    `Your expense claim "${expenseName}" for ${formattedAmount} ` +
    `was ${decision} by ${adminName}.`;

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    type: eventType,
    title: eventTitle,
    message: companyMessage,
    actionUrl: "/dashboard/expenses",
    metadata: {
      expenseId,
      ledgerEntryId,
      ledgerPosted: decision === "approved",
      cashAccountId: account?.id || null,
      cashAccountName: account?.name || null,
      employeeId: employee.id,
      employeeName,
      employeeEmail: employee.email,
      adminId: user.id,
      adminName,
      title: expense.title,
      category: expense.category,
      amount,
      formattedAmount,
      payee: expense.payee,
      paymentMethod: expense.payment_method,
      expenseDate: expense.expense_date,
      previousStatus,
      newStatus: decision,
      reviewedAt: new Date().toISOString(),
      currency,
    },
    notifications: [
      {
        recipientIds: [user.id],
        title: eventTitle,
        message: adminMessage,
        actionUrl: "/dashboard/expenses",
        metadata: {
          audience: "admin",
        },
      },
      {
        recipientIds: [employee.id],
        title:
          decision === "approved"
            ? "Expense claim approved"
            : "Expense claim rejected",
        message: employeeMessage,
        actionUrl: "/employee/expenses",
        metadata: {
          audience: "employee",
        },
      },
    ],
  });

  revalidateExpensePages();

  redirect(
    `/dashboard/expenses?success=${encodeURIComponent(
      `"${expenseName}" was ${decision} successfully.${
        decision === "approved" && account
          ? ` Accounts was updated through ${account.name}.`
          : ""
      }`
    )}`
  );
}

async function deleteExpense(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminProfile();

  const expenseId = String(formData.get("id") || "");

  if (!expenseId) {
    redirect("/dashboard/expenses?error=Expense not found.");
  }

  const { data: expense, error: lookupError } = await supabase
    .from("expenses")
    .select(
      "id, title, category, amount, payee, payment_method, expense_date, status, created_by"
    )
    .eq("id", expenseId)
    .eq("company_id", profile.company_id)
    .single();

  if (lookupError || !expense) {
    redirect("/dashboard/expenses?error=Expense not found.");
  }

  let reversedLedgerEntry: ExpenseLedgerRow | null = null;

  if (expense.status === "approved") {
    const reversalResult = await reverseExpenseLedgerEntry({
      supabase,
      companyId: profile.company_id,
      expenseId,
      actorId: user.id,
      reason: "Source expense deleted",
    });

    if (reversalResult.error) {
      redirect(
        `/dashboard/expenses?error=${encodeURIComponent(
          `The expense was not deleted because its Accounts entry could not be reversed: ${getExpenseErrorMessage(
            reversalResult.error
          )}`
        )}`
      );
    }

    reversedLedgerEntry = reversalResult.entry;
  }

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("company_id", profile.company_id);

  if (error) {
    if (reversedLedgerEntry) {
      await supabase
        .from("cash_ledger")
        .update({
          status: reversedLedgerEntry.status,
          metadata: reversedLedgerEntry.metadata || {},
        })
        .eq("id", reversedLedgerEntry.id)
        .eq("company_id", profile.company_id);
    }

    redirect(
      `/dashboard/expenses?error=${encodeURIComponent(
        getExpenseErrorMessage(error)
      )}`
    );
  }

  const currency = await getCompanyCurrency(
    supabase,
    profile.company_id
  );
  const expenseName = getExpenseName(expense);
  const deletedAmount = Number(expense.amount || 0);

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id],
    type: "expense_deleted",
    title: "Expense deleted",
    message: `${expenseName} for ${formatMoney(
      deletedAmount,
      currency
    )} was deleted.${
      reversedLedgerEntry
        ? " Its Accounts entry was reversed."
        : ""
    }`,
    actionUrl: "/dashboard/expenses",
    metadata: {
      expenseId,
      ledgerEntryId: reversedLedgerEntry?.id || null,
      ledgerReversed: Boolean(reversedLedgerEntry),
      title: expense.title,
      category: expense.category,
      amount: deletedAmount,
      currency,
      payee: expense.payee,
      paymentMethod: expense.payment_method,
      expenseDate: expense.expense_date,
      status: expense.status,
      createdBy: expense.created_by,
    },
  });

  revalidateExpensePages();

  redirect(
    "/dashboard/expenses?success=Expense deleted successfully."
  );
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
}) {
  const params = await searchParams;
  const { supabase, user, profile } = await getAdminProfile();

  const [
    { data: expenseRows },
    { data: company },
    { data: companyProfiles },
    { data: accountRows },
    { data: ledgerBalanceRows },
    notifications,
  ] = await Promise.all([
    supabase
      .from("expenses")
      .select(
        "id, title, category, amount, payee, payment_method, expense_date, notes, status, created_by"
      )
      .eq("company_id", profile.company_id)
      .order("expense_date", {
        ascending: false,
        nullsFirst: false,
      }),

    supabase
      .from("companies")
      .select("currency")
      .eq("id", profile.company_id)
      .single(),

    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("company_id", profile.company_id),

    supabase
      .from("cash_accounts")
      .select(
        "id, name, account_type, currency, status, opening_balance"
      )
      .eq("company_id", profile.company_id)
      .eq("status", "active")
      .order("created_at", { ascending: true }),

    supabase
      .from("cash_ledger")
      .select("account_id, direction, amount, status")
      .eq("company_id", profile.company_id)
      .eq("status", "completed"),

    getUserNotifications(user.id),
  ]);

  const profileMap = new Map(
    (companyProfiles || []).map((person) => [person.id, person])
  );

  const accountBalances = new Map<string, number>();

  for (const account of (accountRows || []) as ExpenseAccountOptionRow[]) {
    accountBalances.set(
      account.id,
      Number(account.opening_balance || 0)
    );
  }

  for (const transaction of
    (ledgerBalanceRows || []) as AccountLedgerBalanceRow[]) {
    if (!transaction.account_id || transaction.status !== "completed") {
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
    } else if (transaction.direction === "outflow") {
      accountBalances.set(
        transaction.account_id,
        currentBalance - amount
      );
    }
  }

  const accounts = (
    (accountRows || []) as ExpenseAccountOptionRow[]
  ).map((account) => ({
    id: account.id,
    name: account.name,
    account_type: account.account_type,
    currency: account.currency,
    status: account.status,
    balance:
      Math.round(
        (accountBalances.get(account.id) || 0) * 100
      ) / 100,
  }));

  const expenses: Expense[] = (expenseRows || []).map((expense) => {
    const submitter = expense.created_by
      ? profileMap.get(expense.created_by) || null
      : null;

    return {
      ...expense,
      submitted_by: submitter
        ? {
            id: submitter.id,
            full_name: submitter.full_name,
            email: submitter.email,
            role: submitter.role,
          }
        : null,
    };
  });

  return (
  <ExpensesClient
    expenses={expenses}
    accounts={accounts}
    error={params?.error}
    success={params?.success}
    addExpense={addExpense}
    importExpenses={importExpenses}
    updateExpense={updateExpense}
    reviewEmployeeExpense={reviewEmployeeExpense}
    deleteExpense={deleteExpense}
    adminName={profile.full_name || user.email || "Founder"}
    currency={company?.currency || "USD"}
    notifications={notifications}
    userId={user.id}
  />
);
}