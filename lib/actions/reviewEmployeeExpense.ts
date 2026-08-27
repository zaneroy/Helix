"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { emitEvent } from "@/lib/events/emitEvent";
import { postExpenseToGeneralLedger } from "@/lib/accounting/postExpenseToGeneralLedger";

export type ExpenseReviewResult = {
  ok: boolean;
  message: string;
};

type ExpenseDecision =
  | "approved"
  | "rejected";

type CashAccountRow = {
  id: string;
  name: string;
  account_type: string;
  accounting_account_id: string | null;
  currency: string;
  status: string;
};

type ExpenseRow = {
  id: string;
  company_id: string;
  created_by: string | null;
  title: string | null;
  category: string | null;
  amount: number | string | null;
  payee: string | null;
  payment_method: string | null;
  expense_date: string | null;
  notes: string | null;
  status: string | null;
};

type ExpenseLedgerRow = {
  id: string;
  reference: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
};

function getExpenseName(expense: {
  title?: string | null;
  category?: string | null;
}) {
  return (
    String(expense.title || "").trim() ||
    String(expense.category || "").trim() ||
    "Expense"
  );
}

function getPersonName(person: {
  full_name?: string | null;
  email?: string | null;
}) {
  return (
    String(person.full_name || "").trim() ||
    String(person.email || "").trim() ||
    "Employee"
  );
}

function isExpenseDecision(
  value: string
): value is ExpenseDecision {
  return (
    value === "approved" ||
    value === "rejected"
  );
}

function normalizeExpenseDate(
  value: string | null | undefined
) {
  const rawValue = String(
    value || ""
  ).trim();

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      rawValue
    )
  ) {
    return rawValue;
  }

  if (rawValue) {
    const parsed =
      new Date(rawValue);

    if (
      !Number.isNaN(
        parsed.getTime()
      )
    ) {
      return parsed
        .toISOString()
        .slice(0, 10);
    }
  }

  return new Date()
    .toISOString()
    .slice(0, 10);
}

function formatMoney(
  value: number,
  currency: string
) {
  try {
    return new Intl.NumberFormat(
      "en-GB",
      {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    ).format(value);
  } catch {
    return `${currency} ${value.toFixed(
      2
    )}`;
  }
}

async function getAdminContext() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      profile: null,
    };
  }

  const { data: profile } =
    await supabase
      .from("profiles")
      .select(
        "id, full_name, role, company_id"
      )
      .eq("id", user.id)
      .single();

  if (
    !profile ||
    profile.role !== "admin" ||
    !profile.company_id
  ) {
    return {
      supabase,
      user,
      profile: null,
    };
  }

  return {
    supabase,
    user,
    profile,
  };
}

async function getExpenseCategoryId(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  companyId: string,
  expenseCategory:
    | string
    | null
    | undefined
) {
  const normalizedCategory =
    String(
      expenseCategory || ""
    ).trim();

  if (normalizedCategory) {
    const {
      data: exactCategory,
    } = await supabase
      .from("cash_categories")
      .select("id")
      .eq(
        "company_id",
        companyId
      )
      .eq("status", "active")
      .eq(
        "category_type",
        "expense"
      )
      .ilike(
        "name",
        normalizedCategory
      )
      .limit(1)
      .maybeSingle();

    if (exactCategory?.id) {
      return exactCategory.id;
    }
  }

  const {
    data: fallbackCategory,
  } = await supabase
    .from("cash_categories")
    .select("id")
    .eq(
      "company_id",
      companyId
    )
    .eq("status", "active")
    .eq(
      "category_type",
      "expense"
    )
    .order(
      "is_system",
      {
        ascending: false,
      }
    )
    .order(
      "created_at",
      {
        ascending: true,
      }
    )
    .limit(1)
    .maybeSingle();

  return (
    fallbackCategory?.id ||
    null
  );
}

async function getExpenseLedgerEntry(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  companyId: string,
  expenseId: string
) {
  const {
    data,
    error,
  } = await supabase
    .from("cash_ledger")
    .select(
      "id, reference, status, metadata"
    )
    .eq(
      "company_id",
      companyId
    )
    .eq(
      "source_type",
      "expense"
    )
    .eq(
      "source_id",
      expenseId
    )
    .maybeSingle();

  return {
    entry:
      (data as ExpenseLedgerRow | null) ||
      null,
    error,
  };
}

async function createExpenseLedgerEntry({
  supabase,
  companyId,
  expense,
  account,
  createdBy,
}: {
  supabase: Awaited<
    ReturnType<typeof createClient>
  >;
  companyId: string;
  expense: ExpenseRow;
  account: CashAccountRow;
  createdBy: string;
}) {
  const existingResult =
    await getExpenseLedgerEntry(
      supabase,
      companyId,
      expense.id
    );

  if (existingResult.error) {
    return {
      entryId: null,
      error:
        existingResult.error,
    };
  }

  if (
    existingResult.entry
      ?.status === "completed"
  ) {
    return {
      entryId:
        existingResult.entry.id,
      error: null,
    };
  }

  const amount =
    Number(expense.amount || 0);

  const expenseName =
    getExpenseName(expense);

  const categoryName =
    String(
      expense.category || ""
    ).trim() || "Expense";

  const categoryId =
    await getExpenseCategoryId(
      supabase,
      companyId,
      expense.category
    );

  const transactionDate =
    normalizeExpenseDate(
      expense.expense_date
    );

  const entryId =
    existingResult.entry?.id ||
    randomUUID();

  const reference =
    existingResult.entry
      ?.reference ||
    `EXP-${expense.id
      .slice(0, 8)
      .toUpperCase()}`;

  const payload = {
    company_id: companyId,
    account_id: account.id,
    category_id: categoryId,
    source_type: "expense",
    source_id: expense.id,
    direction: "outflow",
    amount,
    category: categoryName,

    description:
      expense.payee
        ? `${expenseName} · ${expense.payee}`
        : expenseName,

    reference,
    transaction_date:
      transactionDate,
    status: "completed",
    reconciled: false,
    reconciled_at: null,
    created_by: createdBy,

    metadata: {
      expenseId: expense.id,
      expenseTitle:
        expense.title,
      expenseCategory:
        expense.category,
      payee:
        expense.payee,
      paymentMethod:
        expense.payment_method,
      submittedBy:
        expense.created_by,
      postedBy:
        createdBy,
      postedAt:
        new Date().toISOString(),
      accountId:
        account.id,
      accountName:
        account.name,
      accountingAccountId:
        account.accounting_account_id,
    },
  };

  if (existingResult.entry) {
    const { error } =
      await supabase
        .from("cash_ledger")
        .update(payload)
        .eq(
          "id",
          existingResult.entry.id
        )
        .eq(
          "company_id",
          companyId
        );

    return {
      entryId:
        existingResult.entry.id,
      error,
    };
  }

  const { error } =
    await supabase
      .from("cash_ledger")
      .insert({
        id: entryId,
        ...payload,
      });

  return {
    entryId,
    error,
  };
}

async function reverseExpenseLedgerEntry({
  supabase,
  companyId,
  expenseId,
  actorId,
  reason,
}: {
  supabase: Awaited<
    ReturnType<typeof createClient>
  >;
  companyId: string;
  expenseId: string;
  actorId: string;
  reason: string;
}) {
  const existingResult =
    await getExpenseLedgerEntry(
      supabase,
      companyId,
      expenseId
    );

  if (existingResult.error) {
    return existingResult.error;
  }

  if (!existingResult.entry) {
    return null;
  }

  const previousMetadata =
    existingResult.entry
      .metadata &&
    typeof existingResult.entry
      .metadata === "object"
      ? existingResult.entry
          .metadata
      : {};

  const { error } =
    await supabase
      .from("cash_ledger")
      .update({
        status: "reversed",
        reconciled: false,
        reconciled_at: null,

        metadata: {
          ...previousMetadata,
          reversedBy:
            actorId,
          reversedAt:
            new Date().toISOString(),
          reversalReason:
            reason,
        },
      })
      .eq(
        "id",
        existingResult.entry.id
      )
      .eq(
        "company_id",
        companyId
      );

  return error;
}

async function reverseGeneralLedgerJournal({
  supabase,
  journalEntryId,
  reversalDate,
  reason,
}: {
  supabase: Awaited<
    ReturnType<typeof createClient>
  >;
  journalEntryId: string;
  reversalDate: string;
  reason: string;
}) {
  const { error } =
    await supabase.rpc(
      "reverse_journal_entry",
      {
        p_journal_entry_id:
          journalEntryId,
        p_reversal_date:
          reversalDate,
        p_reason:
          reason,
      }
    );

  return error;
}

function revalidateExpensePages() {
  revalidatePath(
    "/dashboard/tasks"
  );
  revalidatePath(
    "/dashboard/expenses"
  );
  revalidatePath(
    "/dashboard/accounts"
  );
  revalidatePath(
    "/dashboard/reports"
  );
  revalidatePath(
    "/dashboard/activity"
  );
  revalidatePath(
    "/dashboard"
  );
  revalidatePath(
    "/employee/expenses"
  );
  revalidatePath(
    "/employee"
  );
}

export async function reviewEmployeeExpenseFromProfile(
  formData: FormData
): Promise<ExpenseReviewResult> {
  const {
    supabase,
    user,
    profile,
  } =
    await getAdminContext();

  if (
    !user ||
    !profile
  ) {
    return {
      ok: false,
      message:
        "You are not authorised to review employee expenses.",
    };
  }

  const expenseId =
    String(
      formData.get("id") || ""
    ).trim();

  const requestedDecision =
    String(
      formData.get(
        "decision"
      ) || ""
    ).trim();

  const requestedAccountId =
    String(
      formData.get(
        "account_id"
      ) || ""
    ).trim();

  if (
    !expenseId ||
    !isExpenseDecision(
      requestedDecision
    )
  ) {
    return {
      ok: false,
      message:
        "Invalid expense review action.",
    };
  }

  const decision =
    requestedDecision;

  const {
    data: expenseData,
    error: expenseError,
  } = await supabase
    .from("expenses")
    .select(
      "id, company_id, created_by, title, category, amount, payee, payment_method, expense_date, notes, status"
    )
    .eq(
      "id",
      expenseId
    )
    .eq(
      "company_id",
      profile.company_id
    )
    .single();

  if (
    expenseError ||
    !expenseData
  ) {
    return {
      ok: false,
      message:
        "Expense claim not found.",
    };
  }

  const expense =
    expenseData as ExpenseRow;

  if (!expense.created_by) {
    return {
      ok: false,
      message:
        "This expense is not linked to an employee.",
    };
  }

  const {
    data: employee,
    error: employeeError,
  } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, role, company_id"
    )
    .eq(
      "id",
      expense.created_by
    )
    .eq(
      "company_id",
      profile.company_id
    )
    .eq(
      "role",
      "employee"
    )
    .single();

  if (
    employeeError ||
    !employee
  ) {
    return {
      ok: false,
      message:
        "The employee who submitted this expense could not be found.",
    };
  }

  const previousStatus =
    String(
      expense.status ||
        "pending"
    ).toLowerCase();

  if (
    ![
      "pending",
      "submitted",
    ].includes(previousStatus)
  ) {
    return {
      ok: false,
      message:
        `This expense has already been ${previousStatus}.`,
    };
  }

  let account:
    | CashAccountRow
    | null = null;

  let ledgerEntryId:
    | string
    | null = null;

  let journalEntryId:
    | string
    | null = null;

  if (
    decision === "approved"
  ) {
    if (!requestedAccountId) {
      return {
        ok: false,
        message:
          "Select the financial account used to pay this expense.",
      };
    }

    const {
      data: accountData,
      error: accountError,
    } = await supabase
      .from("cash_accounts")
      .select(
        "id, name, account_type, accounting_account_id, currency, status"
      )
      .eq(
        "id",
        requestedAccountId
      )
      .eq(
        "company_id",
        profile.company_id
      )
      .eq(
        "status",
        "active"
      )
      .maybeSingle();

    if (
      accountError ||
      !accountData
    ) {
      return {
        ok: false,
        message:
          "The selected financial account could not be found.",
      };
    }

    account =
      accountData as CashAccountRow;

    if (
      !account.accounting_account_id
    ) {
      return {
        ok: false,
        message:
          "The selected financial account is not linked to the General Ledger.",
      };
    }

    const ledgerResult =
      await createExpenseLedgerEntry({
        supabase,
        companyId:
          profile.company_id,
        expense,
        account,
        createdBy:
          user.id,
      });

    if (
      ledgerResult.error
    ) {
      return {
        ok: false,
        message:
          `Accounts could not be updated: ${ledgerResult.error.message}`,
      };
    }

    ledgerEntryId =
      ledgerResult.entryId;

    try {
      const accountingPost =
        await postExpenseToGeneralLedger({
          supabase,
          companyId:
            profile.company_id,
          userId:
            user.id,
          expenseId:
            expense.id,
          expenseDate:
            normalizeExpenseDate(
              expense.expense_date
            ),
          expenseName:
            getExpenseName(
              expense
            ),
          category:
            expense.category,
          payee:
            expense.payee,
          amount:
            Number(
              expense.amount || 0
            ),

          paymentAccountingAccountId:
            account.accounting_account_id,

          paymentAccountName:
            account.name,

          paymentAccountCurrency:
            account.currency,
        });

      journalEntryId =
        accountingPost.journalEntryId;
    } catch (
      accountingError
    ) {
      const cashRollbackError =
        await reverseExpenseLedgerEntry({
          supabase,
          companyId:
            profile.company_id,
          expenseId:
            expense.id,
          actorId:
            user.id,
          reason:
            "Employee expense General Ledger posting failed",
        });

      revalidateExpensePages();

      const message =
        accountingError instanceof Error
          ? accountingError.message
          : "Unknown accounting posting error.";

      const rollbackWarning =
        cashRollbackError
          ? ` Operational cash rollback also failed: ${cashRollbackError.message}`
          : "";

      return {
        ok: false,
        message:
          `General Ledger posting failed: ${message}${rollbackWarning}`,
      };
    }
  }

  const {
    data: updatedExpense,
    error: updateError,
  } = await supabase
    .from("expenses")
    .update({
      status:
        decision,
    })
    .eq(
      "id",
      expense.id
    )
    .eq(
      "company_id",
      profile.company_id
    )
    .in(
      "status",
      [
        "pending",
        "submitted",
      ]
    )
    .select("id")
    .maybeSingle();

  if (
    updateError ||
    !updatedExpense
  ) {
    const rollbackIssues:
      string[] = [];

    if (
      decision ===
        "approved"
    ) {
      if (journalEntryId) {
        const journalRollbackError =
          await reverseGeneralLedgerJournal({
            supabase,
            journalEntryId,
            reversalDate:
              normalizeExpenseDate(
                expense.expense_date
              ),
            reason:
              "Employee expense approval status update failed",
          });

        if (journalRollbackError) {
          rollbackIssues.push(
            `General Ledger reversal failed: ${journalRollbackError.message}`
          );
        }
      }

      if (ledgerEntryId) {
        const cashRollbackError =
          await reverseExpenseLedgerEntry({
            supabase,
            companyId:
              profile.company_id,
            expenseId:
              expense.id,
            actorId:
              user.id,
            reason:
              "Employee expense approval status update failed",
          });

        if (cashRollbackError) {
          rollbackIssues.push(
            `cash-ledger reversal failed: ${cashRollbackError.message}`
          );
        }
      }
    }

    revalidateExpensePages();

    const baseMessage =
      updateError?.message ||
      "The expense status could not be updated.";

    return {
      ok: false,
      message:
        rollbackIssues.length > 0
          ? `${baseMessage} Rollback warning: ${rollbackIssues.join("; ")}`
          : baseMessage,
    };
  }

  let currency =
    account?.currency || "";

  if (!currency) {
    const {
      data: company,
    } = await supabase
      .from("companies")
      .select("currency")
      .eq(
        "id",
        profile.company_id
      )
      .single();

    currency =
      company?.currency ||
      "GBP";
  }

  const expenseName =
    getExpenseName(expense);

  const employeeName =
    getPersonName(employee);

  const adminName =
    profile.full_name ||
    user.email ||
    "Founder";

  const amount =
    Number(
      expense.amount || 0
    );

  const formattedAmount =
    formatMoney(
      amount,
      currency
    );

  const eventType =
    decision === "approved"
      ? "employee_expense_approved"
      : "employee_expense_rejected";

  const eventTitle =
    decision === "approved"
      ? "Employee expense approved"
      : "Employee expense rejected";

  const message =
    `${adminName} ${decision} ${employeeName}'s expense claim ` +
    `"${expenseName}" for ${formattedAmount}.` +
    (
      decision ===
        "approved" &&
      account
        ? ` It was posted through ${account.name}.`
        : ""
    );

  await emitEvent({
    companyId:
      profile.company_id,
    actorId:
      user.id,
    type:
      eventType,
    title:
      eventTitle,
    message,
    actionUrl:
      "/dashboard/tasks",

    metadata: {
      expenseId:
        expense.id,
      ledgerEntryId,
      journalEntryId,
      cashAccountId:
        account?.id ||
        null,
      accountingAccountId:
        account
          ?.accounting_account_id ||
        null,
      cashAccountName:
        account?.name ||
        null,
      employeeId:
        employee.id,
      employeeName,
      amount,
      formattedAmount,
      previousStatus,
      newStatus:
        decision,
      reviewedAt:
        new Date().toISOString(),
      currency,
    },

    notifications: [
      {
        recipientIds: [
          user.id,
        ],
        title:
          eventTitle,
        message,
        actionUrl:
          "/dashboard/tasks",
        metadata: {
          audience:
            "admin",
        },
      },
      {
        recipientIds: [
          employee.id,
        ],
        title:
          decision ===
          "approved"
            ? "Expense claim approved"
            : "Expense claim rejected",
        message:
          `Your expense claim "${expenseName}" for ${formattedAmount} was ${decision} by ${adminName}.`,
        actionUrl:
          "/employee/expenses",
        metadata: {
          audience:
            "employee",
        },
      },
    ],
  });

  revalidateExpensePages();

  return {
    ok: true,
    message:
      decision ===
      "approved"
        ? `${expenseName} was approved and posted through ${account?.name}.`
        : `${expenseName} was rejected.`,
  };
}