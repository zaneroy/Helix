"use client";

import { useMemo, useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { Expense } from "./page";
import AdminShell from "@/components/admin/AdminShell";
import { createCurrencyFormatter } from "@/lib/currency/formatCurrency";
import type { Notification } from "@/types/notifications";

import { useRouter } from "next/navigation";

import ImportButton from "@/components/import-export/ImportButton";


import type {
  ImportHandler,
} from "@/lib/import-export/parser/importRunner";

import type {
  ImportedExpenseRow,
} from "./page";

type ExpenseStatusFilter = "all" | "operating" | "submitted" | "approved" | "rejected";

const PANEL = "rounded-2xl border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]";

export type ExpenseCashAccount = {
  id: string;
  name: string;
  account_type: string;
  currency: string;
  status: string;
  balance: number;
};

type Props = {
  expenses: Expense[];
  accounts: ExpenseCashAccount[];
  error?: string;
  success?: string;
  addExpense: (formData: FormData) => void;
  updateExpense: (formData: FormData) => void;
  reviewEmployeeExpense: (formData: FormData) => void;
  deleteExpense: (formData: FormData) => void;
  adminName: string;
  currency: string;
  notifications: Notification[];
  userId: string;
  importExpenses: (
    rows: ImportedExpenseRow[]
  ) => Promise<{
    imported: number;
    failed: number;
    skipped: number;
  }>;
};

const categories = [
  "Inventory Purchase",
  "Rent",
  "Payroll",
  "Marketing",
  "Shipping",
  "Utilities",
  "Software",
  "Travel",
  "Tax",
  "Other",
];

const paymentMethods = [
  "Cash",
  "Card",
  "Bank",
  "Stripe",
  "PayPal",
  "Other",
];

function parseExpenseDate(
  value: string | null | undefined
) {
  if (!value) {
    return null;
  }

  const raw = String(value).trim();

  /*
   * Date-only database values such as 2026-08-25
   * must be treated as a local calendar date,
   * not UTC midnight.
   */
  const dateOnlyMatch = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);

    return new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0,
      0
    );
  }

  const parsed = new Date(raw);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

export default function ExpensesClient({
  expenses,
  accounts,
  error,
  success,
  addExpense,
  importExpenses,
  updateExpense,
  deleteExpense,
  adminName,
  currency,
  notifications,
  userId,
}: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExpenseStatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(
    null
  );
  const money = createCurrencyFormatter(currency);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.status === "active"),
    [accounts]
  );

  const normalizedExpenses = useMemo(
    () =>
      expenses.map((expense) => ({
        ...expense,
        numericAmount: Number(expense.amount || 0),
        expenseDateValue:
  parseExpenseDate(
    expense.expense_date
  ),
        isEmployeeClaim: expense.submitted_by?.role === "employee",
      })),
    [expenses]
  );

  const recognizedExpenses = useMemo(
    () =>
      normalizedExpenses.filter((expense) => {
        if (!expense.isEmployeeClaim) {
          return true;
        }

        return String(expense.status || "").toLowerCase() === "approved";
      }),
    [normalizedExpenses]
  );

  const router = useRouter();

  const expensesImportHandler: ImportHandler = async (rows) => {
    const result = await importExpenses(
      rows as ImportedExpenseRow[]
    );

    router.refresh();

    return result;
  };

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return normalizedExpenses.filter((expense) => {
      const matchesStatus =
  statusFilter === "all" ||
  (statusFilter === "operating" && !expense.isEmployeeClaim) ||
  (
    statusFilter === "submitted" &&
    expense.isEmployeeClaim &&
    ["submitted", "pending"].includes(
      String(expense.status || "").toLowerCase()
    )
  ) ||
  (
    statusFilter !== "submitted" &&
    statusFilter !== "operating" &&
    expense.isEmployeeClaim &&
    expense.status === statusFilter
  );

      if (!matchesStatus) return false;
      if (!query) return true;

      return [
        expense.title,
        expense.category,
        expense.payee,
        expense.payment_method,
        expense.status,
        expense.notes,
        expense.submitted_by?.full_name,
        expense.submitted_by?.email,
      ].some((value) =>
        String(value || "").toLowerCase().includes(query)
      );
    });
  }, [normalizedExpenses, search, statusFilter]);

  const totalExpenses = recognizedExpenses.reduce(
    (total, expense) => total + expense.numericAmount,
    0
  );

  const currentMonthExpenses = useMemo(() => {
    const now = new Date();
    return recognizedExpenses
      .filter((expense) =>
        expense.expenseDateValue &&
        expense.expenseDateValue.getFullYear() === now.getFullYear() &&
        expense.expenseDateValue.getMonth() === now.getMonth()
      )
      .reduce((sum, expense) => sum + expense.numericAmount, 0);
  }, [recognizedExpenses]);

  const submittedClaims = normalizedExpenses.filter(
  (expense) =>
    expense.isEmployeeClaim &&
    ["submitted", "pending"].includes(
      String(expense.status || "").toLowerCase()
    )
).length;

  const uniqueCategories = new Set(
    recognizedExpenses.map((expense) => expense.category).filter(Boolean)
  ).size;

  const expenseTrend = useMemo(() => {
    const months = new Map<string, { date: Date; amount: number }>();
    recognizedExpenses.forEach((expense) => {
      if (!expense.expenseDateValue) return;
      const d = expense.expenseDateValue;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const current = months.get(key) || {
        date: new Date(d.getFullYear(), d.getMonth(), 1),
        amount: 0,
      };
      current.amount += expense.numericAmount;
      months.set(key, current);
    });
    return Array.from(months.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-12)
      .map((item) => ({
        label: item.date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
        value: item.amount,
      }));
  }, [recognizedExpenses]);

  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    recognizedExpenses.forEach((expense) => {
      const name = expense.category || "Other";
      map.set(name, (map.get(name) || 0) + expense.numericAmount);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [recognizedExpenses]);

  const vendorTotals = useMemo(() => {
    const map = new Map<string, number>();
    recognizedExpenses.forEach((expense) => {
      const name = expense.payee || "Unspecified payee";
      map.set(name, (map.get(name) || 0) + expense.numericAmount);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [recognizedExpenses]);

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedExpenses = filteredExpenses.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  function exportExpenses() {
    const headers = ["Title","Submitted By","Category","Amount","Payee","Method","Date","Status","Notes"];
    const rows = filteredExpenses.map((expense) => [
      expense.title || "Expense",
      expense.submitted_by?.full_name || expense.submitted_by?.email || "System",
      expense.category || "",
      expense.numericAmount.toFixed(2),
      expense.payee || "",
      expense.payment_method || "",
      expense.expense_date || "",
      expense.isEmployeeClaim ? expense.status || "submitted" : "operating",
      expense.notes || "",
    ]);
    const esc = (value: unknown) => `"${String(value ?? "").replaceAll('"','""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `helix-expenses-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminShell
      title="Expenses"
      adminName={adminName}
      adminRole="Founder"
      showPageHeader={false}
      notifications={notifications}
      userId={userId}
    >
      <main className="min-h-screen bg-[color:var(--app-bg)] text-[color:var(--text-primary)]">
        <div className="mx-auto w-full max-w-[1680px] space-y-6 pb-12">
          <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--primary)]">Expense command center</p>
              <h1 className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.04em]">Expenses</h1>
              <p className="mt-3 text-[13px] text-[color:var(--text-tertiary)]">Control company spending, suppliers and employee claims.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={exportExpenses}
                disabled={filteredExpenses.length === 0}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-5 text-sm font-semibold text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-brand)] hover:text-[color:var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-35"
              >
                Export CSV
              </button>

              <ImportButton
                module="expenses"
                importer={expensesImportHandler}
              />

              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary)] px-5 text-sm font-semibold text-[color:var(--text-on-brand)] transition hover:bg-[color:var(--primary)]"
              >
                + Add Expense
              </button>
            </div>
          </header>

          {error && <div className="rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger)]">{error}</div>}
          {success && <div className="rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-4 py-3 text-sm text-[color:var(--primary)]">{success}</div>}

          <section className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
            <ExpenseMetricCard label="Total Expenses" value={money(totalExpenses)} note={`${recognizedExpenses.length} recognized expenses`} tone="red" data={expenseTrend.map((p) => p.value)} />
            <ExpenseMetricCard label="This Month" value={money(currentMonthExpenses)} note="Current month operating spend" tone="orange" data={expenseTrend.map((p) => p.value)} />
            <ExpenseMetricCard
              label="Pending Review"
              value={String(submittedClaims)}
              note="Employee claims awaiting a decision"
              tone="yellow"
              data={normalizedExpenses.map((expense) =>
                expense.isEmployeeClaim &&
                ["submitted", "pending"].includes(
                  String(expense.status || "").toLowerCase()
                )
                  ? 1
                  : 0
              )}
            />
            <ExpenseMetricCard label="Categories Used" value={String(uniqueCategories)} note="Spending classifications in use" tone="violet" data={categoryTotals.map((c) => c.value)} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)_340px]">
            <ExpenseTrendChart data={expenseTrend} money={money} />
            <CategoryBreakdown items={categoryTotals} total={totalExpenses} money={money} />
            <RankedList title="Top Vendors" items={vendorTotals} money={money} />
          </section>

          <section className={`${PANEL} p-5`}>
            <div className="text-sm font-semibold">Quick Actions</div>
            <div className="mt-4 divide-y divide-[color:var(--divider)]">
              <QuickExpenseAction title="Add Expense" description="Record a new company cost" tone="cyan" onClick={() => setAdding(true)} />
              <QuickExpenseAction title="Pending Claims" description="Show employee claims waiting for approval" tone="yellow" onClick={() => { setStatusFilter("submitted"); setCurrentPage(1); document.getElementById("expense-register")?.scrollIntoView({ behavior: "smooth" }); }} />
              <QuickExpenseAction title="Export Expenses" description="Download the current filtered records" tone="blue" onClick={exportExpenses} />
              <QuickExpenseAction title="View Categories" description={`${uniqueCategories} categories currently in use`} tone="violet" onClick={() => document.getElementById("expense-analytics")?.scrollIntoView({ behavior: "smooth" })} />
            </div>
          </section>

          <section id="expense-register" className={`${PANEL} overflow-hidden`}>
            <div className="flex flex-col gap-4 border-b border-[color:var(--border)] p-5 lg:flex-row lg:items-center lg:justify-between">
              <div><p className="text-[16px] font-semibold">Expense Register</p><p className="mt-1 text-[11px] text-[color:var(--text-tertiary)]">Operating costs and employee claims.</p></div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="Search expenses..." className="h-10 min-w-[280px] rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-xs text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--border-brand)]" />
                <button type="button" onClick={exportExpenses} disabled={filteredExpenses.length === 0} className="h-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-xs text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)] disabled:opacity-35">Export</button>
              </div>
            </div>

            <div className="flex flex-wrap gap-6 border-b border-[color:var(--border)] px-5 py-4">
              {([['all','All'],['operating','Operating'],['submitted','Pending'],['approved','Approved'],['rejected','Rejected']] as [ExpenseStatusFilter,string][]).map(([value,label]) => <button key={value} type="button" onClick={() => { setStatusFilter(value); setCurrentPage(1); }} className={`relative pb-2 text-xs ${statusFilter === value ? 'text-[color:var(--primary)]' : 'text-[color:var(--text-tertiary)] hover:text-[color:var(--text-secondary)]'}`}>{label}{statusFilter === value && <span className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-[color:var(--primary)]" />}</button>)}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1320px] border-collapse text-left">
                <thead className="bg-[color:var(--surface-soft)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]"><tr className="border-b border-[color:var(--border)]"><th className="px-5 py-4">Title</th><th className="px-5 py-4">Submitted By</th><th className="px-5 py-4">Category</th><th className="px-5 py-4">Amount</th><th className="px-5 py-4">Payee</th><th className="px-5 py-4">Method</th><th className="px-5 py-4">Date</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Actions</th></tr></thead>
                <tbody>
                  {paginatedExpenses.length ? paginatedExpenses.map((expense) => {
                    const waitingForApproval =
                      expense.isEmployeeClaim &&
                      ["submitted", "pending"].includes(
                        String(expense.status || "").toLowerCase()
                      );

                    return (
                      <tr
                        key={expense.id}
                        className="border-b border-[color:var(--border)] text-[12px] last:border-b-0 hover:bg-[color:var(--surface-soft)]"
                      >
                        <td className="px-5 py-4">
                          <p className="font-medium text-[color:var(--text-primary)]">
                            {expense.title || "Expense"}
                          </p>
                          <p className="mt-1 max-w-[220px] truncate text-[10px] text-[color:var(--text-muted)]">
                            {expense.notes || "No notes"}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-[color:var(--text-secondary)]">
                            {expense.submitted_by?.full_name ||
                              expense.submitted_by?.email ||
                              "System"}
                          </p>
                          <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">
                            {expense.isEmployeeClaim
                              ? "Employee claim"
                              : "Founder expense"}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-lg border border-[color:var(--violet-border)] bg-[color:var(--violet-soft)] px-2.5 py-1 text-[10px] text-[color:var(--chart-5)]">
                            {expense.category || "Other"}
                          </span>
                        </td>

                        <td className="px-5 py-4 font-medium text-[color:var(--danger)]">
                          {money(expense.numericAmount)}
                        </td>

                        <td className="px-5 py-4 text-[color:var(--text-secondary)]">
                          {expense.payee || "—"}
                        </td>

                        <td className="px-5 py-4 text-[color:var(--text-secondary)]">
                          {expense.payment_method || "—"}
                        </td>

                        <td className="px-5 py-4 text-[color:var(--text-tertiary)]">
                          {formatExpenseDate(expense.expense_date)}
                        </td>

                        <td className="px-5 py-4">
                          <ExpenseStatusBadge
                            status={expense.status}
                            isEmployeeClaim={expense.isEmployeeClaim}
                          />
                        </td>

                        <td className="px-5 py-4">
                          {expense.isEmployeeClaim ? (
                            <span
                              className="text-[10px] text-[color:var(--text-muted)]"
                              title={
                                waitingForApproval
                                  ? "Review this claim from the employee profile."
                                  : undefined
                              }
                            >
                              —
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditing(expense)}
                              className="rounded-lg border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-3 py-2 text-[10px] text-[color:var(--primary)]"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-5 py-16 text-center text-sm text-[color:var(--text-tertiary)]"
                      >
                        No matching expenses found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-[color:var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] text-[color:var(--text-muted)]">Showing {filteredExpenses.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredExpenses.length)} of {filteredExpenses.length} expenses</p><div className="flex items-center gap-2"><button type="button" disabled={safePage <= 1} onClick={() => setCurrentPage((p) => Math.max(1,p-1))} className="h-8 min-w-8 rounded-lg border border-[color:var(--border)] text-xs text-[color:var(--text-tertiary)] disabled:opacity-30">‹</button>{Array.from({ length: Math.min(totalPages,5) },(_,i)=>i+1).map((page)=><button key={page} type="button" onClick={() => setCurrentPage(page)} className={`h-8 min-w-8 rounded-lg border px-2 text-xs ${safePage === page ? 'border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]' : 'border-[color:var(--border)] text-[color:var(--text-tertiary)]'}`}>{page}</button>)}<button type="button" disabled={safePage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages,p+1))} className="h-8 min-w-8 rounded-lg border border-[color:var(--border)] text-xs text-[color:var(--text-tertiary)] disabled:opacity-30">›</button></div></div>
          </section>

          <section id="expense-analytics" className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]"><RecentExpenses expenses={recognizedExpenses.slice(0,5)} money={money} /><PaymentAccounts accounts={activeAccounts} money={money} /></section>
        {adding && (
          <ExpenseDrawer
            title="Add Expense"
            action={addExpense}
            accounts={activeAccounts}
            money={money}
            onClose={() => setAdding(false)}
          />
        )}

        {editing && (
          <ExpenseDrawer
            title="Edit Expense"
            expense={editing}
            action={updateExpense}
            accounts={activeAccounts}
            money={money}
            deleteAction={deleteExpense}
            onClose={() => setEditing(null)}
            onRequestDelete={(id) => setDeleteExpenseId(id)}
          />
        )}

        <ConfirmDialog
          open={Boolean(deleteExpenseId)}
          title="Delete Expense"
          description="Are you sure you want to delete this expense? This financial record will be removed."
          confirmText="Delete Expense"
          cancelText="Cancel"
          onCancel={() => setDeleteExpenseId(null)}
          onConfirm={() => {
            if (!deleteExpenseId) return;

            const formData = new FormData();
            formData.append("id", deleteExpenseId);

            deleteExpense(formData);
            setDeleteExpenseId(null);
          }}
        />

        </div>
      </main>
    </AdminShell>
  );
}


function ExpenseMetricCard({ label, value, note, tone, data }: { label: string; value: string; note: string; tone: "red" | "orange" | "yellow" | "violet"; data: number[] }) {
  const color = { red: "var(--chart-6)", orange: "var(--chart-4)", yellow: "var(--chart-4)", violet: "var(--chart-5)" }[tone];
  const values = data.length ? data.slice(-8) : [0];
  const max = Math.max(...values,1);
  return <div className={`${PANEL} min-h-[220px] p-5`}><p className="text-xs text-[color:var(--text-secondary)]">{label}</p><p className="mt-3 text-[25px] font-semibold tracking-[-0.04em]">{value}</p><p className="mt-3 text-[11px] text-[color:var(--text-muted)]">{note}</p><svg viewBox="0 0 220 72" className="mt-5 h-[72px] w-full">{[14,36,58].map((y)=><line key={y} x1="0" x2="220" y1={y} y2={y} stroke="var(--chart-grid)" />)}{values.map((value,index)=>{const gap=5;const width=(220-gap*Math.max(values.length-1,0))/values.length;const height=(Number(value||0)/max)*52;return <rect key={index} x={index*(width+gap)} y={62-height} width={width} height={Math.max(height,1)} rx="2" fill={color} opacity="0.8" />;})}</svg></div>;
}

function ExpenseTrendChart({ data, money }: { data: {label:string;value:number}[]; money: ReturnType<typeof createCurrencyFormatter> }) {
  const width=680,height=230,left=46,right=18,top=24,bottom=34,plotWidth=width-left-right,plotHeight=height-top-bottom,max=Math.max(...data.map(d=>d.value),1);
  const points=data.map((d,i)=>({...d,x:data.length===1?left+plotWidth/2:left+(i/(data.length-1))*plotWidth,y:top+plotHeight-(d.value/max)*plotHeight}));
  const path=points.map((p,i)=>`${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ');
  const area=points.length?`${path} L ${points.at(-1)!.x} ${top+plotHeight} L ${points[0].x} ${top+plotHeight} Z`:'';
  return <div className={`${PANEL} p-5`}><div className="flex justify-between"><div><p className="text-sm font-semibold">Expense Trend</p><p className="mt-1 text-[10px] text-[color:var(--text-muted)]">Recorded spending by month</p></div><span className="text-xs text-[color:var(--danger)]">{money(data.reduce((s,d)=>s+d.value,0))}</span></div>{data.length?<><svg viewBox={`0 0 ${width} ${height}`} className="mt-5 h-[230px] w-full">{[top,top+plotHeight/4,top+plotHeight/2,top+plotHeight*3/4,top+plotHeight].map(y=><line key={y} x1={left} x2={width-right} y1={y} y2={y} stroke="var(--chart-grid)" />)}<defs><linearGradient id="expense-area-final" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-6)" stopOpacity="0.22"/><stop offset="100%" stopColor="var(--chart-6)" stopOpacity="0"/></linearGradient></defs><path d={area} fill="url(#expense-area-final)"/><path d={path} fill="none" stroke="var(--chart-6)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>{points.map(p=><circle key={p.label} cx={p.x} cy={p.y} r="3" fill="var(--surface)" stroke="var(--chart-6)" strokeWidth="2"><title>{p.label}: {money(p.value)}</title></circle>)}</svg><div className="flex justify-between text-[9px] text-[color:var(--text-muted)]">{data.map(d=><span key={d.label}>{d.label}</span>)}</div></>:<div className="mt-5 py-16 text-center text-xs text-[color:var(--text-muted)]">Record expenses to build the trend.</div>}</div>;
}

function CategoryBreakdown({ items, total, money }: { items: {name:string;value:number}[]; total:number; money:ReturnType<typeof createCurrencyFormatter> }) {
  const colors=['var(--chart-6)','var(--chart-4)','var(--chart-4)','var(--chart-5)','var(--chart-1)']; let current=0; const gradient=items.length&&total?items.map((item,i)=>{const start=current;current+=(item.value/total)*360;return `${colors[i]} ${start}deg ${current}deg`;}).join(','):'var(--progress-track) 0deg 360deg';
  return <div className={`${PANEL} p-5`}><div className="flex justify-between"><p className="text-sm font-semibold">Expense Categories</p><span className="text-[10px] text-[color:var(--primary)]">{items.length}</span></div><div className="mt-7 flex flex-col items-center gap-6"><div className="relative h-36 w-36 rounded-full" style={{background:`conic-gradient(${gradient})`}}><div className="absolute inset-5 flex items-center justify-center rounded-full bg-[color:var(--surface)]"><div className="text-center"><p className="text-[9px] uppercase text-[color:var(--text-muted)]">Total</p><p className="mt-1 text-xs text-[color:var(--text-primary)]">{money(total)}</p></div></div></div><div className="w-full space-y-3">{items.map((item,i)=><div key={item.name} className="flex gap-2"><span className="mt-1.5 h-2 w-2 rounded-full" style={{backgroundColor:colors[i]}}/><div className="flex flex-1 justify-between gap-3"><p className="truncate text-[11px] text-[color:var(--text-secondary)]">{item.name}</p><p className="text-[11px] text-[color:var(--text-secondary)]">{money(item.value)}</p></div></div>)}</div></div></div>;
}

function RankedList({ title, items, money }: { title:string; items:{name:string;value:number}[]; money:ReturnType<typeof createCurrencyFormatter> }) {
  const max=Math.max(...items.map(i=>i.value),1); return <div className={`${PANEL} p-5`}><div className="flex justify-between"><p className="text-sm font-semibold">{title}</p><span className="text-[10px] text-[color:var(--primary)]">{items.length}</span></div><div className="mt-6 space-y-5">{items.map((item,index)=><div key={item.name}><div className="flex items-start gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[color:var(--warning-soft)] text-[11px] text-[color:var(--warning)]">{index+1}</span><div className="flex-1"><div className="flex justify-between gap-3"><p className="truncate text-[12px] text-[color:var(--text-secondary)]">{item.name}</p><p className="text-[12px] text-[color:var(--warning)]">{money(item.value)}</p></div><div className="mt-3 h-1.5 rounded-full bg-[color:var(--surface-soft)]"><div className="h-full rounded-full bg-[image:linear-gradient(90deg,var(--chart-6),var(--chart-4))]" style={{width:`${Math.max((item.value/max)*100,2)}%`}}/></div></div></div></div>)}</div></div>;
}

function QuickExpenseAction({ title, description, tone, onClick }: { title:string; description:string; tone:"cyan"|"yellow"|"blue"|"violet"; onClick:()=>void }) { const c={cyan:'bg-[color:var(--primary-soft)] text-[color:var(--primary)]',yellow:'bg-[color:var(--warning-soft)] text-[color:var(--warning)]',blue:'bg-[color:var(--secondary-soft)] text-[color:var(--secondary)]',violet:'bg-[color:var(--violet-soft)] text-[color:var(--chart-5)]'}[tone]; return <button type="button" onClick={onClick} className="flex w-full items-center gap-4 py-4 text-left hover:bg-[color:var(--surface-soft)]"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${c}`}>→</span><span className="flex-1"><span className="block text-xs text-[color:var(--text-secondary)]">{title}</span><span className="mt-1 block text-[10px] text-[color:var(--text-muted)]">{description}</span></span><span className="text-[color:var(--text-secondary)]">›</span></button>; }

function RecentExpenses({ expenses, money }: { expenses:any[]; money:ReturnType<typeof createCurrencyFormatter> }) { return <div className={`${PANEL} p-5`}><div className="flex justify-between"><p className="text-sm font-semibold">Recent Expense Activity</p><span className="text-[10px] text-[color:var(--primary)]">Latest</span></div><div className="mt-5 space-y-4">{expenses.length?expenses.map(e=><div key={e.id} className="flex gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--danger-soft)] text-[color:var(--danger)]">↑</span><div className="flex-1"><div className="flex justify-between gap-3"><p className="truncate text-xs text-[color:var(--text-secondary)]">{e.title||e.category||'Expense'}</p><p className="text-xs text-[color:var(--danger)]">{money(e.numericAmount)}</p></div><p className="mt-1 text-[10px] text-[color:var(--text-muted)]">{e.payee||'Unspecified payee'} · {formatExpenseDate(e.expense_date)}</p></div></div>):<p className="py-12 text-center text-xs text-[color:var(--text-muted)]">No expense activity yet.</p>}</div></div>; }
function PaymentAccounts({ accounts, money }: { accounts:ExpenseCashAccount[]; money:ReturnType<typeof createCurrencyFormatter> }) { return <div className={`${PANEL} p-5`}><div className="flex justify-between"><p className="text-sm font-semibold">Payment Accounts</p><span className="text-[10px] text-[color:var(--primary)]">{accounts.length}</span></div><div className="mt-5 divide-y divide-[color:var(--divider)]">{accounts.map(a=><div key={a.id} className="flex items-center gap-3 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--primary-soft)] text-[color:var(--primary)]">▣</span><div className="flex-1"><p className="text-[11px] text-[color:var(--text-secondary)]">{a.name}</p><p className="mt-1 text-[9px] capitalize text-[color:var(--text-muted)]">{a.account_type.replaceAll('_',' ')}</p></div><p className="text-[11px] text-[color:var(--text-primary)]">{money(a.balance)}</p></div>)}</div></div>; }
function formatExpenseDate(
  value: string | null
) {
  if (!value) {
    return "—";
  }

  const date =
    parseExpenseDate(value);

  if (!date) {
    return value;
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

function AccountField({
  accounts,
  money,
  name,
  label,
  value,
  onChange,
  required,
}: {
  accounts: ExpenseCashAccount[];
  money: ReturnType<typeof createCurrencyFormatter>;
  name: string;
  label: string;
  value?: string;
  onChange?: (accountId: string) => void;
  required?: boolean;
}) {
  const controlled = value !== undefined;

  return (
    <label className="block text-xs text-[color:var(--text-secondary)]">
      {label}

      <select
        name={name}
        value={controlled ? value : undefined}
        defaultValue={controlled ? undefined : ""}
        onChange={
          onChange
            ? (event) => onChange(event.target.value)
            : undefined
        }
        required={required}
        className="mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
      >
        <option value="">Select financial account</option>

        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name} · {money(account.balance)}
          </option>
        ))}
      </select>

      {accounts.length > 0 && (
        <p className="mt-2 text-[11px] text-[color:var(--text-muted)]">
          This account will receive the expense outflow in Accounts.
        </p>
      )}
    </label>
  );
}

function ExpenseStatusBadge({
  status,
  isEmployeeClaim,
}: {
  status: string | null;
  isEmployeeClaim: boolean;
}) {
  if (!isEmployeeClaim) {
    return (
      <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-1 text-xs text-[color:var(--text-secondary)]">
        Operating expense
      </span>
    );
  }

  if (status === "approved") {
    return (
      <span className="rounded-full border border-[color:var(--success-border)] bg-[color:var(--success-soft)] px-3 py-1 text-xs text-[color:var(--success)]">
        Approved
      </span>
    );
  }

  if (status === "rejected") {
    return (
      <span className="rounded-full border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-3 py-1 text-xs text-[color:var(--danger)]">
        Rejected
      </span>
    );
  }

  return (
    <span className="rounded-full border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-3 py-1 text-xs text-[color:var(--warning)]">
      Waiting for approval
    </span>
  );
}

function ExpenseDrawer({
  title,
  expense,
  action,
  accounts,
  money,
  deleteAction,
  onClose,
  onRequestDelete,
}: {
  title: string;
  expense?: Expense;
  action: (formData: FormData) => void;
  accounts: ExpenseCashAccount[];
  money: ReturnType<typeof createCurrencyFormatter>;
  deleteAction?: (formData: FormData) => void;
  onClose: () => void;
  onRequestDelete?: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[color:var(--overlay-strong)]">
      <div className="h-full w-full max-w-md overflow-y-auto border-l border-[color:var(--border-brand)] bg-[color:var(--app-bg)] p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="text-lg font-semibold">
            {title}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-sm text-[color:var(--text-secondary)]"
          >
            Close
          </button>
        </div>

        {expense?.submitted_by?.role === "employee" && (
          <div className="mb-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3">
            <p className="text-xs text-[color:var(--text-tertiary)]">
              Employee claim
            </p>

            <p className="mt-1 text-sm text-[color:var(--text-primary)]">
              Submitted by{" "}
              {expense.submitted_by.full_name ||
                expense.submitted_by.email}
            </p>

            <div className="mt-2">
              <ExpenseStatusBadge
                status={expense.status}
                isEmployeeClaim
              />
            </div>
          </div>
        )}

        <form action={action} className="space-y-4">
          {expense && (
            <input
              type="hidden"
              name="id"
              defaultValue={expense.id}
            />
          )}

          {!expense && (
            <AccountField
              accounts={accounts}
              money={money}
              name="account_id"
              label="Pay from account"
              required
            />
          )}

          <Field
            name="title"
            label="Expense title"
            defaultValue={expense?.title || ""}
            required
          />

          <SelectField
            name="category"
            label="Category"
            defaultValue={expense?.category || ""}
            options={categories}
            required
          />

          <Field
            name="amount"
            label="Amount"
            type="number"
            min="0.01"
            defaultValue={expense?.amount || ""}
            required
          />

          <Field
            name="payee"
            label="Payee / Supplier"
            defaultValue={expense?.payee || ""}
          />

          <SelectField
            name="payment_method"
            label="Payment method"
            defaultValue={expense?.payment_method || ""}
            options={paymentMethods}
          />

          <Field
            name="expense_date"
            label="Expense date"
            type="date"
            defaultValue={expense?.expense_date || ""}
          />

          <label className="block text-xs text-[color:var(--text-secondary)]">
            Notes
            <textarea
              name="notes"
              defaultValue={expense?.notes || ""}
              className="mt-2 min-h-24 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
            />
          </label>

          {!expense && accounts.length === 0 && (
            <p className="rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-4 py-3 text-xs leading-5 text-[color:var(--danger)]">
              Create an active account on the Accounts page before adding an
              approved expense.
            </p>
          )}

          <button
            disabled={!expense && accounts.length === 0}
            className="w-full rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-4 py-3 text-sm font-medium text-[color:var(--primary)] transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save Expense
          </button>
        </form>

        {expense && deleteAction && (
          <button
            type="button"
            onClick={() => onRequestDelete?.(expense.id)}
            className="mt-4 w-full rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-4 py-3 text-sm font-medium text-[color:var(--danger)]"
          >
            Delete Expense
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  required,
  min,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number;
  required?: boolean;
  min?: string;
}) {
  return (
    <label className="block text-xs text-[color:var(--text-secondary)]">
      {label}

      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        min={min}
        step={type === "number" ? "0.01" : undefined}
        className="mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
      />
    </label>
  );
}

function SelectField({
  name,
  label,
  defaultValue,
  options,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: string[];
  required?: boolean;
}) {
  return (
    <label className="block text-xs text-[color:var(--text-secondary)]">
      {label}

      <select
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
      >
        <option value="">
          Select {label.toLowerCase()}
        </option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}