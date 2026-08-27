"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/currency/formatCurrency";
import type {
  AdminEmployee,
  AdminEmployeeExpense,
  AdminEmployeeNote,
  AdminEmployeeSale,
  AdminExpensePaymentAccount,
  AdminTask,
} from "../page";

type ServerAction = (formData: FormData) => void | Promise<void>;

type ExpenseReviewAction = (
  formData: FormData
) => Promise<{
  ok: boolean;
  message: string;
}>;

export type EmployeeProfileMetrics = {
  employee: AdminEmployee;
  revenue: number;
  profit: number;
  expensesTotal: number;
  salesCount: number;
  expensesCount: number;
  tasksCount: number;
  completedTasks: number;
  overdueTasks: number;
  lastActivity: string | null;
  productivityScore: number;
};

type Props = {
  open: boolean;
  currency: string;
  profile: EmployeeProfileMetrics | null;
  tasks: AdminTask[];
  sales: AdminEmployeeSale[];
  expenses: AdminEmployeeExpense[];
  expenseAccounts: AdminExpensePaymentAccount[];
  note: AdminEmployeeNote | null;
  onClose: () => void;
  onAssignTask: (employeeId: string) => void;
  saveEmployeeNote: ServerAction;
  suspendEmployee: ServerAction;
  reactivateEmployee: ServerAction;
  removeEmployeeAccess: ServerAction;
  sendEmployeePasswordReset: ServerAction;
  reviewEmployeeExpense: ExpenseReviewAction;
};

type DrawerTab =
  | "overview"
  | "tasks"
  | "sales"
  | "expenses"
  | "notes"
  | "access";

type ConfirmationAction =
  | "suspend"
  | "reactivate"
  | "remove"
  | "password-reset"
  | null;

export default function EmployeeProfileDrawer({
  open,
  currency,
  profile,
  tasks,
  sales,
  expenses,
  expenseAccounts,
  note,
  onClose,
  onAssignTask,
  saveEmployeeNote,
  suspendEmployee,
  reactivateEmployee,
  removeEmployeeAccess,
  sendEmployeePasswordReset,
  reviewEmployeeExpense,
}: Props) {
  const [tab, setTab] = useState<DrawerTab>("overview");
  const [confirmationAction, setConfirmationAction] =
    useState<ConfirmationAction>(null);

  useEffect(() => {
    if (!open) {
      setTab("overview");
      setConfirmationAction(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (confirmationAction) setConfirmationAction(null);
        else onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, confirmationAction, onClose]);

  const employeeTasks = useMemo(() => {
    if (!profile) return [];
    return tasks.filter((task) => task.assigned_to === profile.employee.id);
  }, [tasks, profile]);

  const employeeSales = useMemo(() => {
    if (!profile) return [];
    return sales
      .filter((sale) => sale.created_by === profile.employee.id)
      .sort(
        (a, b) =>
          new Date(b.sold_at || 0).getTime() -
          new Date(a.sold_at || 0).getTime()
      );
  }, [sales, profile]);

  const employeeExpenses = useMemo(() => {
    if (!profile) return [];
    return expenses
      .filter((expense) => expense.created_by === profile.employee.id)
      .sort(
        (a, b) =>
          new Date(b.expense_date || 0).getTime() -
          new Date(a.expense_date || 0).getTime()
      );
  }, [expenses, profile]);

  if (!open || !profile) return null;

  const employeeName =
    profile.employee.full_name || profile.employee.email || "Employee";
  const accessStatus = profile.employee.access_status || "active";
  const completionRate =
    profile.tasksCount > 0
      ? Math.round((profile.completedTasks / profile.tasksCount) * 100)
      : 0;
  const money = (value: number | string | null | undefined) =>
    formatCurrency(value, currency);

  return (
    <div className="fixed inset-0 z-[110]">
      <button
        type="button"
        aria-label="Close employee profile"
        onClick={onClose}
        className="absolute inset-0 bg-[color:var(--overlay-strong)] backdrop-blur-sm"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-profile-title"
        className="absolute right-0 top-0 flex h-full w-full max-w-[760px] flex-col border-l border-[color:var(--border-brand)] bg-[color:var(--surface)] shadow-[var(--shadow-card)]"
      >
        <header className="border-b border-[color:var(--border)] px-6 py-5">
          <div className="flex items-start justify-between gap-5">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar name={employeeName} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="employee-profile-title" className="truncate text-xl font-semibold tracking-[-0.025em] text-[color:var(--text-primary)]">
                    {employeeName}
                  </h2>
                  <AccessBadge status={accessStatus} />
                </div>
                <p className="mt-1 truncate text-xs text-[color:var(--text-tertiary)]">
                  {profile.employee.email || "No email address"}
                </p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[color:var(--primary)]">
                  Employee intelligence profile
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-brand)] hover:text-[color:var(--primary)]"
              aria-label="Close profile drawer"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onAssignTask(profile.employee.id)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-4 text-xs font-semibold text-[color:var(--primary)] transition hover:bg-[color:var(--primary-soft)]"
            >
              <TaskIcon />
              Assign Task
            </button>

            <button
              type="button"
              onClick={() => setConfirmationAction("password-reset")}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-xs font-medium text-[color:var(--text-secondary)] transition hover:border-[color:var(--border)] hover:text-[color:var(--text-primary)]"
            >
              <KeyIcon />
              Password Reset
            </button>

            {accessStatus === "suspended" ? (
              <button
                type="button"
                onClick={() => setConfirmationAction("reactivate")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[color:var(--success-border)] bg-[color:var(--success-soft)] px-4 text-xs font-semibold text-[color:var(--success)] transition hover:bg-[color:var(--success-soft)]"
              >
                <SuccessIcon />
                Reactivate
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmationAction("suspend")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-4 text-xs font-semibold text-[color:var(--warning)] transition hover:bg-[color:var(--warning-soft)]"
              >
                <PauseIcon />
                Suspend
              </button>
            )}

            <button
              type="button"
              onClick={() => setConfirmationAction("remove")}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-4 text-xs font-semibold text-[color:var(--danger)] transition hover:bg-[color:var(--danger-soft)]"
            >
              <RemoveIcon />
              Remove Access
            </button>
          </div>
        </header>

        <nav className="overflow-x-auto border-b border-[color:var(--border)] px-6">
          <div className="flex min-w-max gap-1">
            {[
              ["overview", "Overview"],
              ["tasks", `Tasks (${employeeTasks.length})`],
              ["sales", `Sales (${employeeSales.length})`],
              ["expenses", `Expenses (${employeeExpenses.length})`],
              ["notes", "Private Notes"],
              ["access", "Access"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value as DrawerTab)}
                className={`border-b-2 px-4 py-4 text-xs font-medium transition ${
                  tab === value
                    ? "border-[color:var(--border-brand)] text-[color:var(--primary)]"
                    : "border-transparent text-[color:var(--text-tertiary)] hover:text-[color:var(--text-secondary)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {tab === "overview" && (
            <OverviewTab profile={profile} completionRate={completionRate} money={money} />
          )}
          {tab === "tasks" && <TasksTab tasks={employeeTasks} />}
          {tab === "sales" && <SalesTab sales={employeeSales} money={money} />}
          {tab === "expenses" && (
            <ExpensesTab
              expenses={employeeExpenses}
              accounts={expenseAccounts}
              money={money}
              reviewEmployeeExpense={reviewEmployeeExpense}
            />
          )}
          {tab === "notes" && (
            <NotesTab employeeId={profile.employee.id} note={note} saveEmployeeNote={saveEmployeeNote} />
          )}
          {tab === "access" && (
            <AccessTab profile={profile} onConfirm={setConfirmationAction} />
          )}
        </div>
      </aside>

      {confirmationAction && (
        <ConfirmationModal
          action={confirmationAction}
          employee={profile.employee}
          onClose={() => setConfirmationAction(null)}
          suspendEmployee={suspendEmployee}
          reactivateEmployee={reactivateEmployee}
          removeEmployeeAccess={removeEmployeeAccess}
          sendEmployeePasswordReset={sendEmployeePasswordReset}
        />
      )}
    </div>
  );
}

function OverviewTab({
  profile,
  completionRate,
  money,
}: {
  profile: EmployeeProfileMetrics;
  completionRate: number;
  money: (value: number | string | null | undefined) => string;
}) {
  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Revenue" value={money(profile.revenue)} tone="cyan" />
        <Metric label="Profit" value={money(profile.profit)} tone={profile.profit >= 0 ? "green" : "red"} />
        <Metric label="Expenses" value={money(profile.expensesTotal)} tone="red" />
        <Metric label="Productivity" value={`${profile.productivityScore}/100`} tone={scoreTone(profile.productivityScore)} />
      </section>

      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-[10px] uppercase tracking-[0.13em] text-[color:var(--text-muted)]">Task execution</p>
            <p className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">{completionRate}%</p>
            <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
              {profile.completedTasks} of {profile.tasksCount} tasks completed
            </p>
          </div>
          <ProgressRing value={completionRate} label={`${completionRate}%`} />
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-[color:var(--surface-soft)]">
          <div className="h-full rounded-full bg-[color:var(--primary)]" style={{ width: `${Math.min(100, Math.max(0, completionRate))}%` }} />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <SmallMetric label="Assigned" value={profile.tasksCount} />
          <SmallMetric label="Completed" value={profile.completedTasks} />
          <SmallMetric label="Overdue" value={profile.overdueTasks} alert={profile.overdueTasks > 0} />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <InfoCard label="Joined" value={formatDate(profile.employee.created_at)} />
        <InfoCard label="Last Activity" value={formatDateTime(profile.lastActivity)} />
        <InfoCard label="Recorded Sales" value={String(profile.salesCount)} />
        <InfoCard label="Submitted Expenses" value={String(profile.expensesCount)} />
      </section>

      <section className="rounded-2xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
            <InsightIcon />
          </span>
          <div>
            <p className="text-sm font-semibold text-[color:var(--text-primary)]">Workforce Insight</p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-tertiary)]">{buildInsight(profile)}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function TasksTab({ tasks }: { tasks: AdminTask[] }) {
  if (tasks.length === 0) {
    return <EmptyState title="No tasks assigned" text="Assign a task to begin tracking this employee's execution." />;
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const overdue =
          Boolean(task.due_date) &&
          String(task.due_date) < new Date().toISOString().slice(0, 10) &&
          task.status !== "done";

        return (
          <article key={task.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[color:var(--text-primary)]">{task.title}</p>
                <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">Created {formatDate(task.created_at)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={task.status || "todo"} />
                <PriorityBadge priority={task.priority || "normal"} />
                {overdue && (
                  <span className="rounded-full border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[color:var(--danger)]">Overdue</span>
                )}
              </div>
            </div>
            {task.description && <p className="mt-3 text-xs leading-5 text-[color:var(--text-tertiary)]">{task.description}</p>}
            <div className="mt-4 flex items-center justify-between gap-4 border-t border-[color:var(--border)] pt-3 text-[10px] text-[color:var(--text-muted)]">
              <span>Due: {formatDate(task.due_date)}</span>
              <span>ID: {task.id.slice(0, 8)}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function SalesTab({
  sales,
  money,
}: {
  sales: AdminEmployeeSale[];
  money: (value: number | string | null | undefined) => string;
}) {
  if (sales.length === 0) {
    return <EmptyState title="No employee sales" text="Sales recorded by this employee will appear here." />;
  }

  return (
    <div className="space-y-3">
      {sales.map((sale) => (
        <article key={sale.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <SmallMetric label="Revenue" value={money(sale.total_amount)} />
            <SmallMetric label="Profit" value={money(sale.profit_amount)} />
            <SmallMetric label="Recorded" value={formatDate(sale.sold_at)} />
          </div>
        </article>
      ))}
    </div>
  );
}

function ExpensesTab({
  expenses,
  accounts,
  money,
  reviewEmployeeExpense,
}: {
  expenses: AdminEmployeeExpense[];
  accounts: AdminExpensePaymentAccount[];
  money: (value: number | string | null | undefined) => string;
  reviewEmployeeExpense: ExpenseReviewAction;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedAccounts, setSelectedAccounts] = useState<
    Record<string, string>
  >({});

  const [reviewingExpenseId, setReviewingExpenseId] = useState<
    string | null
  >(null);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  if (expenses.length === 0) {
    return (
      <EmptyState
        title="No employee expenses"
        text="Expenses submitted by this employee will appear here."
      />
    );
  }

  function reviewExpense(
    expense: AdminEmployeeExpense,
    decision: "approved" | "rejected"
  ) {
    const selectedAccountId = selectedAccounts[expense.id] || "";

    if (decision === "approved" && !selectedAccountId) {
      setFeedback({
        type: "error",
        message: "Select the payment account before approving this claim.",
      });
      return;
    }

    setFeedback(null);
    setReviewingExpenseId(expense.id);

    startTransition(async () => {
      const formData = new FormData();

      formData.set("id", expense.id);
      formData.set("decision", decision);

      if (decision === "approved") {
        formData.set("account_id", selectedAccountId);
      }

      try {
        const result = await reviewEmployeeExpense(formData);

        setFeedback({
          type: result.ok ? "success" : "error",
          message: result.message,
        });

        if (result.ok) {
          router.refresh();
        }
      } catch (error) {
        setFeedback({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "The expense could not be reviewed.",
        });
      } finally {
        setReviewingExpenseId(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs ${
            feedback.type === "success"
              ? "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
              : "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {expenses.map((expense) => {
        const status = String(expense.status || "pending").toLowerCase();

        const awaitingReview =
          status === "pending" || status === "submitted";

        const processing =
          isPending && reviewingExpenseId === expense.id;

        return (
          <article
            key={expense.id}
            className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-card)]"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                    {expense.title || expense.category || "Expense claim"}
                  </p>

                  {awaitingReview ? (
                    <span className="rounded-full border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[color:var(--warning)]">
                      Waiting for approval
                    </span>
                  ) : (
                    <StatusBadge status={expense.status || "pending"} />
                  )}
                </div>

                <p className="mt-2 text-xs text-[color:var(--text-secondary)]">
                  {expense.payee || "No payee"} · {expense.category || "Other"}
                </p>

                {expense.notes && (
                  <p className="mt-2 text-xs leading-5 text-[color:var(--text-tertiary)]">
                    {expense.notes}
                  </p>
                )}
              </div>

              <p className="shrink-0 text-lg font-semibold text-[color:var(--danger)]">
                {money(expense.amount)}
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3">
                <p className="text-[9px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
                  Expense date
                </p>
                <p className="mt-1 text-xs font-medium text-[color:var(--text-primary)]">
                  {formatExpenseDateOnly(expense.expense_date)}
                </p>
              </div>

              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3">
                <p className="text-[9px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
                  Method
                </p>
                <p className="mt-1 text-xs font-medium text-[color:var(--text-primary)]">
                  {expense.payment_method || "Not specified"}
                </p>
              </div>

              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3">
                <p className="text-[9px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
                  Claim ID
                </p>
                <p className="mt-1 text-xs font-medium text-[color:var(--text-primary)]">
                  {expense.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
            </div>

            {awaitingReview && (
              <div className="mt-5 border-t border-[color:var(--border)] pt-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-tertiary)]">
                  Review claim
                </p>

                <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                  Select the account the expense was paid from, then approve or reject the claim.
                </p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <select
                    value={selectedAccounts[expense.id] || ""}
                    onChange={(event) =>
                      setSelectedAccounts((current) => ({
                        ...current,
                        [expense.id]: event.target.value,
                      }))
                    }
                    disabled={isPending}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 text-xs text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)] disabled:opacity-50"
                  >
                    <option value="">Select payment account</option>

                    {accounts.map((account) => (
                      <option
                        key={account.id}
                        value={account.id}
                        disabled={!account.accounting_account_id}
                      >
                        {account.name} ({account.currency})
                        {!account.accounting_account_id
                          ? " — GL not linked"
                          : ""}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => reviewExpense(expense, "approved")}
                    className="h-11 rounded-xl border border-[color:var(--success-border)] bg-[color:var(--success-soft)] px-5 text-xs font-semibold text-[color:var(--success)] transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {processing ? "Processing..." : "Approve"}
                  </button>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => reviewExpense(expense, "rejected")}
                    className="h-11 rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-5 text-xs font-semibold text-[color:var(--danger)] transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {processing ? "Processing..." : "Reject"}
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function formatExpenseDateOnly(
  value: string | null | undefined
) {
  const raw = String(value || "").trim().slice(0, 10);

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return raw || "No date";
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function NotesTab({
  employeeId,
  note,
  saveEmployeeNote,
}: {
  employeeId: string;
  note: AdminEmployeeNote | null;
  saveEmployeeNote: ServerAction;
}) {
  return (
    <form action={saveEmployeeNote} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
      <input type="hidden" name="employee_id" value={employeeId} />
      <p className="text-sm font-semibold text-[color:var(--text-primary)]">Private Admin Notes</p>
      <p className="mt-2 text-xs leading-5 text-[color:var(--text-tertiary)]">
        Notes are visible only to company administrators and are recorded in the audit trail when changed.
      </p>
      <textarea
        name="notes"
        defaultValue={note?.notes || ""}
        placeholder="Record performance observations, coaching notes or management context..."
        className="mt-5 min-h-56 w-full resize-y rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 text-sm leading-6 text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--border-brand)]"
      />
      <button type="submit" className="mt-4 inline-flex h-11 items-center justify-center rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-5 text-xs font-semibold text-[color:var(--primary)] transition hover:bg-[color:var(--primary-soft)]">
        Save Private Notes
      </button>
    </form>
  );
}

function AccessTab({
  profile,
  onConfirm,
}: {
  profile: EmployeeProfileMetrics;
  onConfirm: (action: ConfirmationAction) => void;
}) {
  const status = profile.employee.access_status || "active";

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
        <p className="text-sm font-semibold text-[color:var(--text-primary)]">Workspace Access</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <InfoCard label="Role" value="Employee" />
          <InfoCard label="Access Status" value={capitalise(status)} />
          <InfoCard label="Email" value={profile.employee.email || "No email"} />
          <InfoCard label="Joined" value={formatDate(profile.employee.created_at)} />
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] p-5">
        <p className="text-sm font-semibold text-[color:var(--text-primary)]">Access Controls</p>
        <p className="mt-2 text-xs leading-5 text-[color:var(--text-tertiary)]">
          These actions affect the employee&apos;s ability to access the company workspace and are recorded in Activity.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {status === "suspended" ? (
            <AccessAction title="Reactivate Access" text="Restore this employee's workspace access." tone="green" onClick={() => onConfirm("reactivate")} />
          ) : (
            <AccessAction title="Suspend Access" text="Temporarily block this employee from the workspace." tone="amber" onClick={() => onConfirm("suspend")} />
          )}
          <AccessAction title="Send Password Reset" text="Send a secure password reset email." tone="cyan" onClick={() => onConfirm("password-reset")} />
          <AccessAction title="Remove Company Access" text="Detach this employee from the company workspace." tone="red" onClick={() => onConfirm("remove")} />
        </div>
      </section>
    </div>
  );
}

function ConfirmationModal({
  action,
  employee,
  onClose,
  suspendEmployee,
  reactivateEmployee,
  removeEmployeeAccess,
  sendEmployeePasswordReset,
}: {
  action: Exclude<ConfirmationAction, null>;
  employee: AdminEmployee;
  onClose: () => void;
  suspendEmployee: ServerAction;
  reactivateEmployee: ServerAction;
  removeEmployeeAccess: ServerAction;
  sendEmployeePasswordReset: ServerAction;
}) {
  const config = {
    suspend: {
      eyebrow: "Suspend workspace access",
      title: "Suspend this employee?",
      text: "The employee will immediately lose access to their Helix workspace until an administrator reactivates them.",
      button: "Suspend Employee",
      tone: "amber",
      action: suspendEmployee,
    },
    reactivate: {
      eyebrow: "Restore workspace access",
      title: "Reactivate this employee?",
      text: "The employee will regain access to their employee workspace immediately.",
      button: "Reactivate Employee",
      tone: "green",
      action: reactivateEmployee,
    },
    remove: {
      eyebrow: "Permanent access removal",
      title: "Remove company access?",
      text: "The employee will be detached from this company workspace. Historical business records remain preserved.",
      button: "Remove Access",
      tone: "red",
      action: removeEmployeeAccess,
    },
    "password-reset": {
      eyebrow: "Account security",
      title: "Send password reset?",
      text: "A secure password reset email will be sent to the employee's registered email address.",
      button: "Send Reset Email",
      tone: "cyan",
      action: sendEmployeePasswordReset,
    },
  }[action];

  const buttonStyle = {
    amber: "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)] hover:bg-[color:var(--warning-soft)]",
    green: "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)] hover:bg-[color:var(--success-soft)]",
    red: "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)] hover:bg-[color:var(--danger-soft)]",
    cyan: "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)] hover:bg-[color:var(--primary-soft)]",
  }[config.tone];

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-[color:var(--overlay-strong)] px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[image:var(--gradient-panel)] shadow-[var(--shadow-card)]">
        <div className="border-b border-[color:var(--border)] px-6 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">{config.eyebrow}</p>
          <h3 className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">{config.title}</h3>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm leading-6 text-[color:var(--text-secondary)]">{config.text}</p>
          <div className="mt-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3">
            <p className="text-sm font-medium text-[color:var(--text-primary)]">{employee.full_name || employee.email || "Employee"}</p>
            <p className="mt-1 text-xs text-[color:var(--text-muted)]">{employee.email || "No email address"}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-[color:var(--border)] px-6 py-4">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-xs font-medium text-[color:var(--text-secondary)] transition hover:border-[color:var(--border)] hover:text-[color:var(--text-primary)]">
            Cancel
          </button>
          <form action={config.action}>
            <input type="hidden" name="employee_id" value={employee.id} />
            <button type="submit" className={`h-10 rounded-xl border px-4 text-xs font-semibold transition ${buttonStyle}`}>
              {config.button}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "cyan" | "green" | "red" | "amber" }) {
  const colour = { cyan: "text-[color:var(--primary)]", green: "text-[color:var(--success)]", red: "text-[color:var(--danger)]", amber: "text-[color:var(--warning)]" }[tone];
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <p className="text-[9px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">{label}</p>
      <p className={`mt-2 text-base font-semibold ${colour}`}>{value}</p>
    </div>
  );
}

function SmallMetric({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-3">
      <p className="text-[8px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{label}</p>
      <p className={`mt-1.5 text-xs font-semibold ${alert ? "text-[color:var(--danger)]" : "text-[color:var(--text-secondary)]"}`}>{value}</p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <p className="text-[9px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-[color:var(--text-secondary)]">{value}</p>
    </div>
  );
}

function AccessAction({ title, text, tone, onClick }: { title: string; text: string; tone: "cyan" | "green" | "amber" | "red"; onClick: () => void }) {
  const style = {
    cyan: "border-[color:var(--border-brand)] hover:border-[color:var(--border-brand)]",
    green: "border-[color:var(--success-border)] hover:border-[color:var(--success-border)]",
    amber: "border-[color:var(--warning-border)] hover:border-[color:var(--warning-border)]",
    red: "border-[color:var(--danger-border)] hover:border-[color:var(--danger-border)]",
  }[tone];
  return (
    <button type="button" onClick={onClick} className={`rounded-xl border bg-[color:var(--surface-soft)] p-4 text-left transition ${style}`}>
      <p className="text-sm font-semibold text-[color:var(--text-primary)]">{title}</p>
      <p className="mt-2 text-xs leading-5 text-[color:var(--text-tertiary)]">{text}</p>
    </button>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-10 text-center">
      <p className="text-sm font-medium text-[color:var(--text-secondary)]">{title}</p>
      <p className="mt-2 text-xs text-[color:var(--text-muted)]">{text}</p>
    </div>
  );
}

function ProgressRing({ value, label }: { value: number; label: string }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;
  return (
    <div className="relative h-20 w-20">
      <svg className="-rotate-90" width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="7" />
        <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--chart-1)" strokeWidth="7" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-[color:var(--primary)]">{label}</span>
    </div>
  );
}

function AccessBadge({ status }: { status: string }) {
  const suspended = status === "suspended";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.09em] ${suspended ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]" : "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${suspended ? "bg-[color:var(--warning)]" : "bg-[color:var(--success)]"}`} />
      {suspended ? "Suspended" : "Active"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const style =
    normalized === "done" || normalized === "approved" || normalized === "active"
      ? "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
      : normalized === "in_progress" || normalized === "pending" || normalized === "submitted"
        ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
        : normalized === "rejected" || normalized === "suspended"
          ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
          : "border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)]";
  return <span className={`rounded-full border px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] ${style}`}>{normalized.replaceAll("_", " ")}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const style = priority === "high"
    ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
    : priority === "low"
      ? "border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)]"
      : "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]";
  return <span className={`rounded-full border px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] ${style}`}>{priority}</span>;
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-sm font-semibold text-[color:var(--primary)]">{initials || "U"}</span>;
}

function buildInsight(profile: EmployeeProfileMetrics) {
  const completionRate = profile.tasksCount > 0 ? Math.round((profile.completedTasks / profile.tasksCount) * 100) : 0;
  if (profile.overdueTasks > 0) {
    return `${profile.employee.full_name || "This employee"} has ${profile.overdueTasks} overdue ${profile.overdueTasks === 1 ? "task" : "tasks"}. Review workload and deadlines before assigning additional work.`;
  }
  if (profile.productivityScore >= 85 && completionRate >= 80) {
    return `${profile.employee.full_name || "This employee"} is performing strongly with a ${profile.productivityScore}/100 productivity score and ${completionRate}% task completion.`;
  }
  if (profile.revenue > 0 && profile.profit > 0) {
    return `${profile.employee.full_name || "This employee"} is contributing positively with recorded revenue and profit. Continue monitoring task execution alongside financial contribution.`;
  }
  return `${profile.employee.full_name || "This employee"} currently has limited operating history. More task, sales and expense activity will improve workforce intelligence accuracy.`;
}

function scoreTone(score: number): "cyan" | "green" | "red" | "amber" {
  if (score >= 85) return "green";
  if (score >= 70) return "cyan";
  if (score >= 50) return "amber";
  return "red";
}

function capitalise(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "No activity yet";
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function SvgIcon({ children }: { children: React.ReactNode }) {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}
function CloseIcon() { return <SvgIcon><path d="M6 6l12 12" /><path d="M18 6 6 18" /></SvgIcon>; }
function TaskIcon() { return <SvgIcon><rect x="4" y="3" width="16" height="18" rx="2" /><path d="m8 9 2 2 4-4" /><path d="M8 15h8" /></SvgIcon>; }
function KeyIcon() { return <SvgIcon><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9" /><path d="m15 7 2 2" /><path d="m17 5 2 2" /></SvgIcon>; }
function PauseIcon() { return <SvgIcon><circle cx="12" cy="12" r="9" /><path d="M10 9v6" /><path d="M14 9v6" /></SvgIcon>; }
function SuccessIcon() { return <SvgIcon><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></SvgIcon>; }
function RemoveIcon() { return <SvgIcon><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></SvgIcon>; }
function InsightIcon() { return <SvgIcon><path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" /><path d="m18 15 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z" /></SvgIcon>; }