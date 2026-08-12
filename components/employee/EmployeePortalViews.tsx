"use client";

import { useMemo, useState, useTransition, type ComponentType, type FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import ProfileAppearanceCard from "@/components/theme/ProfileAppearanceCard";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Clock3,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import { recordEmployeePortalSale, submitEmployeePortalExpense, updateEmployeePortalTaskStatus, sendEmployeePortalPasswordResetEmail, updateEmployeePortalPhoneNumber} from "@/lib/actions/employee-portal";

import type {
  EmployeePortalActivity,
  EmployeePortalExpense,
  EmployeePortalInventoryItem,
  EmployeePortalReadModel,
  EmployeePortalSale,
  EmployeePortalTask,
} from "@/types/employee-portal";

type DashboardIcon = ComponentType<{ className?: string }>;

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(numberValue(value));
  } catch {
    return `${currency} ${numberValue(value).toFixed(2)}`;
  }
}

function dateLabel(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(value: string): string {
  return String(value || "pending")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isOverdue(value?: string | null): boolean {
  if (!value) return false;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return false;

  return date.getTime() < Date.now();
}



function EmployeeDashboardHero({ model }: { model: EmployeePortalReadModel }) {
  const { summary } = model;

  return (
    <section className="rounded-2xl border border-[var(--primary-border)] bg-[image:var(--gradient-hero)] p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.82fr)_minmax(520px,1fr)] xl:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">
              {summary.companyName}
            </span>
            <span className="rounded-full border border-[var(--success-border)] bg-[var(--success-soft)] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--success)]">
              Employee workspace
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
              {summary.currency} reporting
            </span>
          </div>

          <h2 className="mt-4 text-[30px] font-semibold tracking-[-0.055em] text-[var(--text-primary)] sm:text-[38px]">
            Work overview
          </h2>
          <p className="mt-2 max-w-3xl text-[12px] leading-5 text-[var(--text-tertiary)]">
            Track assigned tasks, recent sales, expenses, inventory alerts and activity from one
            permission-aware employee workspace.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <HeroMiniStat
            icon={ClipboardList}
            label="Open tasks"
            value={`${summary.openTaskCount}`}
          />
          <HeroMiniStat
            icon={ShoppingCart}
            label="Sales value"
            value={money(summary.recentSalesValue, summary.currency)}
          />
          <HeroMiniStat
            icon={AlertTriangle}
            label="Low stock"
            value={`${summary.lowStockCount}`}
          />
        </div>
      </div>
    </section>
  );
}

function EmployeeMetricGrid({ model }: { model: EmployeePortalReadModel }) {
  const { summary } = model;

  const metrics = [
    {
      icon: ClipboardList,
      label: "Open tasks",
      value: `${summary.openTaskCount}`,
      caption: "Assigned tasks requiring action",
    },
    {
      icon: Clock3,
      label: "Overdue tasks",
      value: `${summary.overdueTaskCount}`,
      caption: "Past due assigned work",
    },
    {
      icon: CheckCircle2,
      label: "Completed tasks",
      value: `${summary.completedTaskCount}`,
      caption: "Completed work records",
    },
    {
      icon: ShoppingCart,
      label: "Recent sales",
      value: `${summary.recentSalesCount}`,
      caption: "Sales connected to this employee",
    },
    {
      icon: TrendingUp,
      label: "Sales value",
      value: money(summary.recentSalesValue, summary.currency),
      caption: "Total sales value",
    },
    {
      icon: ReceiptText,
      label: "Pending expenses",
      value: `${summary.pendingExpenseCount}`,
      caption: money(summary.pendingExpenseValue, summary.currency),
    },
    {
      icon: Boxes,
      label: "Inventory items",
      value: `${summary.inventoryItemCount}`,
      caption: "Products visible to employee",
    },
    {
      icon: AlertTriangle,
      label: "Low-stock alerts",
      value: `${summary.lowStockCount}`,
      caption: "Items at or below threshold",
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.label} {...metric} />
      ))}
    </div>
  );
}

function EmployeeTaskCommandPanel({ tasks }: { tasks: EmployeePortalTask[] }) {
  const openTasks = tasks
    .filter((task) => !["done", "completed", "cancelled", "archived"].includes(task.status.toLowerCase()))
    .slice(0, 6);

  return (
    <section className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Task command
          </p>
          <h3 className="mt-2 text-[19px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
            Assigned work
          </h3>
          <p className="mt-2 text-[11px] leading-5 text-[var(--text-tertiary)]">
            Priority work assigned to this employee.
          </p>
        </div>
        <span className="rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-2 text-[9px] font-medium text-[var(--primary)]">
          {openTasks.length} active
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {openTasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}

        {!openTasks.length && (
          <EmptyState text="No active employee tasks are assigned yet." />
        )}
      </div>
    </section>
  );
}

function EmployeeTodayPanel({ model }: { model: EmployeePortalReadModel }) {
  const latestSale = model.sales[0] || null;
  const latestExpense = model.expenses[0] || null;
  const latestNotice = model.notifications[0] || null;

  const items = [
    {
      icon: ShoppingCart,
      label: "Latest sale",
      value: latestSale ? money(latestSale.amount, model.summary.currency) : "—",
      caption: latestSale?.productName || latestSale?.customerName || "No sale recorded",
    },
    {
      icon: ReceiptText,
      label: "Latest expense",
      value: latestExpense ? money(latestExpense.amount, model.summary.currency) : "—",
      caption: latestExpense ? statusLabel(latestExpense.status) : "No expense submitted",
    },
    {
      icon: BadgeCheck,
      label: "Latest notice",
      value: latestNotice ? dateLabel(latestNotice.createdAt) : "—",
      caption: latestNotice?.title || "No notifications yet",
    },
  ];

  return (
    <section className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-4 shadow-[var(--shadow-card)]">
      <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
        Today
      </p>
      <h3 className="mt-2 text-[19px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
        Operational snapshot
      </h3>
      <p className="mt-2 text-[11px] leading-5 text-[var(--text-tertiary)]">
        Quick employee-facing status from live records.
      </p>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <SnapshotRow key={item.label} {...item} />
        ))}
      </div>
    </section>
  );
}

function EmployeeInventoryAlertsPanel({
  inventory,
}: {
  inventory: EmployeePortalInventoryItem[];
}) {
  const alerts = inventory
    .filter((item) => item.stock <= item.lowStockThreshold)
    .slice(0, 6);

  return (
    <section className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Inventory alerts
          </p>
          <h3 className="mt-2 text-[19px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
            Low-stock items
          </h3>
          <p className="mt-2 text-[11px] leading-5 text-[var(--text-tertiary)]">
            Products at or below their stock threshold.
          </p>
        </div>
        <Boxes className="h-5 w-5 text-[var(--primary)]" />
      </div>

      <div className="mt-4 space-y-3">
        {alerts.map((item) => (
          <InventoryAlertRow key={item.id} item={item} />
        ))}

        {!alerts.length && (
          <EmptyState text="No low-stock inventory alerts right now." />
        )}
      </div>
    </section>
  );
}

function EmployeeActivityPanel({ model }: { model: EmployeePortalReadModel }) {
  const fallback = model.notifications.slice(0, 6).map((notice) => ({
    id: notice.id,
    title: notice.title,
    description: notice.message,
    type: notice.type,
    createdAt: notice.createdAt,
  }));
  const items = (model.activity.length ? model.activity : fallback).slice(0, 6);

  return (
    <section className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Activity
          </p>
          <h3 className="mt-2 text-[19px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
            Employee timeline
          </h3>
          <p className="mt-2 text-[11px] leading-5 text-[var(--text-tertiary)]">
            Recent work, notifications and operational updates.
          </p>
        </div>
        <Activity className="h-5 w-5 text-[var(--primary)]" />
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <ActivityRow key={item.id} item={item} />
        ))}

        {!items.length && (
          <EmptyState text="No employee activity has been recorded yet." />
        )}
      </div>
    </section>
  );
}

function HeroMiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: DashboardIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-[78px] items-center justify-between gap-4 rounded-xl border border-[var(--primary-border)] bg-[var(--surface-soft)] px-4 py-3">
      <div className="min-w-0">
        <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">{label}</p>
        <p className="mt-2 truncate text-[17px] font-semibold tracking-[-0.035em] text-[var(--text-primary)]">{value}</p>
      </div>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]">
        <Icon className="h-[18px] w-[18px]" />
      </span>
    </div>
  );
}

function MetricCard({
  caption,
  icon: Icon,
  label,
  value,
}: {
  caption: string;
  icon: DashboardIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-3.5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">{label}</p>
          <p className="mt-2.5 truncate text-[22px] font-semibold tracking-[-0.045em] text-[var(--text-primary)]">{value}</p>
          <p className="mt-2 min-h-[28px] text-[10px] leading-4 text-[var(--text-tertiary)]">{caption}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]">
          <Icon className="h-[17px] w-[17px]" />
        </span>
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: EmployeePortalTask }) {
  const overdue = isOverdue(task.dueAt);

  return (
    <div className="grid grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]">
        <ClipboardList className="h-[16px] w-[16px]" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[12px] font-semibold text-[var(--text-primary)]">{task.title}</p>
        <p className="mt-1 truncate text-[10px] text-[var(--text-tertiary)]">
          {task.description || statusLabel(task.status)}
        </p>
      </div>
      <span
        className={[
          "rounded-full border px-2.5 py-1 text-[9px] font-semibold",
          overdue
            ? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]"
            : "border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]",
        ].join(" ")}
      >
        {overdue ? "Overdue" : dateLabel(task.dueAt)}
      </span>
    </div>
  );
}

function SnapshotRow({
  caption,
  icon: Icon,
  label,
  value,
}: {
  caption: string;
  icon: DashboardIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[38px_minmax(0,1fr)] gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]">
        <Icon className="h-[16px] w-[16px]" />
      </span>
      <div className="min-w-0">
        <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{label}</p>
        <p className="mt-1 truncate text-[13px] font-semibold text-[var(--text-primary)]">{value}</p>
        <p className="mt-1 truncate text-[10px] text-[var(--text-tertiary)]">{caption}</p>
      </div>
    </div>
  );
}

function InventoryAlertRow({ item }: { item: EmployeePortalInventoryItem }) {
  return (
    <div className="grid grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]">
        <AlertTriangle className="h-[16px] w-[16px]" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[12px] font-semibold text-[var(--text-primary)]">{item.name}</p>
        <p className="mt-1 truncate text-[10px] text-[var(--text-tertiary)]">{item.sku || "No SKU"}</p>
      </div>
      <span className="rounded-full border border-[var(--warning-border)] bg-[var(--warning-soft)] px-2.5 py-1 text-[9px] font-semibold text-[var(--warning)]">
        {item.stock} left
      </span>
    </div>
  );
}

function ActivityRow({ item }: { item: EmployeePortalActivity }) {
  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]">
        <Activity className="h-[15px] w-[15px]" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-[var(--text-primary)]">{item.title}</p>
        <p className="mt-1 line-clamp-1 text-[9px] leading-4 text-[var(--text-tertiary)]">{item.description}</p>
      </div>
      <span className="shrink-0 pt-0.5 text-right text-[9px] text-[var(--text-tertiary)]">
        {dateLabel(item.createdAt)}
      </span>
    </div>
  );
}

function EmptyState({ text: label }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-4 py-8 text-center text-[10px] text-[var(--text-tertiary)]">
      {label}
    </div>
  );
}













export function EmployeeDashboardView({ model }: { model: EmployeePortalReadModel }) {
  const safeModel = model as unknown as Record<string, unknown>;
  const summary = (safeModel.summary || {}) as Record<string, unknown>;
  const profile = (safeModel.profile || {}) as Record<string, unknown>;

  const tasks = Array.isArray(safeModel.tasks) ? (safeModel.tasks as Record<string, unknown>[]) : [];
  const sales = Array.isArray(safeModel.sales) ? (safeModel.sales as Record<string, unknown>[]) : [];
  const expenses = Array.isArray(safeModel.expenses) ? (safeModel.expenses as Record<string, unknown>[]) : [];
  const inventory = Array.isArray(safeModel.inventory) ? (safeModel.inventory as Record<string, unknown>[]) : [];
  const notifications = Array.isArray(safeModel.notifications)
    ? (safeModel.notifications as Record<string, unknown>[])
    : [];
  const activity = Array.isArray(safeModel.activity)
    ? (safeModel.activity as Record<string, unknown>[])
    : Array.isArray(safeModel.activities)
      ? (safeModel.activities as Record<string, unknown>[])
      : [];

  const textValue = (...values: unknown[]) => {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
    }

    return "";
  };

  const numberValue = (...values: unknown[]) => {
    for (const value of values) {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
    }

    return 0;
  };

  const dateValue = (...values: unknown[]) => {
    const raw = textValue(...values);
    if (!raw) return "No date";

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;

    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const currencyCode = textValue(summary.currency, safeModel.currency).toUpperCase();
  const currency = /^[A-Z]{3}$/.test(currencyCode) ? currencyCode : "GBP";

  const moneyValue = (value: unknown) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(numberValue(value));

  const normalStatus = (value: unknown) =>
    textValue(value)
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .trim();

  const taskStatus = (task: Record<string, unknown>) =>
    normalStatus(task.status || task.task_status || task.progress_status || task.state);

  const isDoneTask = (task: Record<string, unknown>) =>
    ["done", "completed", "complete", "finished", "closed", "resolved"].includes(taskStatus(task)) ||
    Boolean(task.completed_at) ||
    Boolean(task.completedAt);

  const isInProgressTask = (task: Record<string, unknown>) =>
    ["in progress", "working", "started", "active", "doing"].includes(taskStatus(task));

  const taskTotal = tasks.length;
  const doneTasks = tasks.filter(isDoneTask).length;
  const inProgressTasks = tasks.filter(isInProgressTask).length;
  const todoTasks = Math.max(0, taskTotal - doneTasks - inProgressTasks);
  const taskCompletion = taskTotal ? Math.round((doneTasks / taskTotal) * 100) : 0;

  const salesCount = sales.length;
  const salesRevenue =
    numberValue(summary.recentSalesValue, summary.salesValue, summary.totalSalesValue) ||
    sales.reduce((total, sale) => {
      const quantity = numberValue(sale.quantity) || 1;
      return (
        total +
        numberValue(
          sale.revenue,
          sale.total,
          sale.total_amount,
          sale.sale_total,
          sale.amount,
          quantity * numberValue(sale.sale_price, sale.salePrice, sale.price),
        )
      );
    }, 0);

  const salesProfit =
    numberValue(summary.recentSalesProfit, summary.salesProfit, summary.totalSalesProfit) ||
    sales.reduce((total, sale) => total + numberValue(sale.profit, sale.profit_amount, sale.gross_profit), 0);

  const expenseTotal =
    numberValue(summary.expenseTotal, summary.totalExpenses, summary.recentExpenseValue) ||
    expenses.reduce((total, expense) => total + numberValue(expense.amount, expense.total), 0);

  const pendingExpenses = expenses.filter((expense) => {
    const status = normalStatus(expense.status);
    return !["approved", "paid", "rejected", "declined", "cancelled"].includes(status);
  }).length;

  const lowStockItems = inventory.filter((item) => {
    const stock = numberValue(item.stock, item.quantity_on_hand, item.on_hand, item.available);
    const threshold =
      numberValue(item.lowStockThreshold, item.low_stock_threshold, item.reorder_level, item.minimum_stock) || 2;

    return stock <= threshold;
  });

  const unreadNotifications =
    numberValue(summary.unreadNotificationCount, summary.notificationsUnread) ||
    notifications.filter((notification) => !textValue(notification.read_at, notification.readAt)).length;

  const employeeName =
    textValue(summary.employeeName, safeModel.employeeName, profile.fullName, profile.full_name, profile.name) ||
    "Employee";

  const department = textValue(profile.department, summary.department);
  const jobTitle = textValue(profile.job_title, profile.jobTitle, summary.job_title, summary.jobTitle);

  const recentTasks = tasks.slice(0, 5);
  const recentSales = sales.slice(0, 5);
  const recentExpenses = expenses.slice(0, 4);
  const recentNotifications = notifications.slice(0, 4);
  const recentActivity = activity.slice(0, 5);

  const taskTitle = (task: Record<string, unknown>) => textValue(task.title, task.name) || "Task";
  const productName = (item: Record<string, unknown>) =>
    textValue(item.name, item.product_name, item.productName, item.title) || "Product";
  const saleProductName = (sale: Record<string, unknown>) =>
    textValue(
      sale.product_name,
      sale.productName,
      sale.product,
      (sale.product as Record<string, unknown> | undefined)?.name,
      sale.title,
    ) || "Sale";
  const expenseTitle = (expense: Record<string, unknown>) =>
    textValue(expense.title, expense.name, expense.category, expense.payee, expense.supplier) || "Expense";

  const topSale = sales.reduce<Record<string, unknown> | null>((best, sale) => {
    const saleTotal = numberValue(sale.revenue, sale.total, sale.total_amount, sale.amount);
    const bestTotal = best ? numberValue(best.revenue, best.total, best.total_amount, best.amount) : -1;
    return saleTotal > bestTotal ? sale : best;
  }, null);

  const priorityTask = recentTasks.find((task) => !isDoneTask(task)) || recentTasks[0] || null;
  const dashboardHealth =
    lowStockItems.length > 0
      ? "Stock attention needed"
      : pendingExpenses > 0
        ? "Claims awaiting review"
        : taskCompletion >= 80
          ? "Strong progress"
          : "Work in motion";

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[1.6rem] border border-[var(--primary-border)] bg-[image:var(--gradient-hero)] p-5 shadow-[var(--shadow-lg)]">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent" />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_420px] xl:items-stretch">
          <div className="flex min-h-[260px] flex-col justify-between rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-soft)] p-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                  Employee command center
                </span>
                {department ? (
                  <span className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
                    {department}
                  </span>
                ) : null}
                {jobTitle ? (
                  <span className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
                    {jobTitle}
                  </span>
                ) : null}
              </div>

              <h1 className="mt-7 max-w-3xl text-5xl font-semibold tracking-[-0.07em] text-[var(--text-primary)]">
                Welcome back, {employeeName.split(" ")[0] || employeeName}.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--text-tertiary)]">
                Your work, sales, expense claims, alerts and activity are now shown in one focused
                employee workspace.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-4">
              <EmployeeDashboardAction href="/employee/tasks" label="Tasks" value={`${doneTasks}/${taskTotal}`} />
              <EmployeeDashboardAction href="/employee/sales" label="Record sale" value={moneyValue(salesRevenue)} />
              <EmployeeDashboardAction href="/employee/expenses" label="Expenses" value={`${pendingExpenses} pending`} />
              <EmployeeDashboardAction href="/employee/notifications" label="Alerts" value={`${unreadNotifications} unread`} />
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-[var(--primary-border)] bg-[image:var(--gradient-panel)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                  Shift status
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                  {dashboardHealth}
                </h2>
              </div>
              <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-xs text-[var(--primary)]">
                Live
              </span>
            </div>

            <div className="mt-6 grid grid-cols-[150px_minmax(0,1fr)] items-center gap-5">
              <div
                className="grid aspect-square place-items-center rounded-full border border-[var(--primary-border)]"
                style={{
                  background: `conic-gradient(var(--chart-1) ${taskCompletion}%, var(--progress-track) 0)`,
                }}
              >
                <div className="grid h-[112px] w-[112px] place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)]">
                  <div className="text-center">
                    <p className="text-3xl font-semibold tracking-[-0.06em] text-[var(--text-primary)]">
                      {taskCompletion}%
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                      complete
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <EmployeeDashboardStackMetric label="Tasks done" value={`${doneTasks}`} detail={`${todoTasks} to do`} />
                <EmployeeDashboardStackMetric label="Sales recorded" value={`${salesCount}`} detail={moneyValue(salesProfit) + " profit"} />
                <EmployeeDashboardStackMetric label="Stock alerts" value={`${lowStockItems.length}`} detail="Needs attention" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <EmployeeDashboardStat title="Task completion" value={`${taskCompletion}%`} caption={`${doneTasks} done / ${taskTotal} assigned`} />
        <EmployeeDashboardStat title="Sales value" value={moneyValue(salesRevenue)} caption={`${salesCount} employee sales`} />
        <EmployeeDashboardStat title="Expense claims" value={moneyValue(expenseTotal)} caption={`${pendingExpenses} waiting for admin`} />
        <EmployeeDashboardStat title="Low stock" value={`${lowStockItems.length}`} caption={`${unreadNotifications} unread notifications`} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
        <div className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)]">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                Priority queue
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
                What needs attention
              </h2>
            </div>
            <a
              href="/employee/tasks"
              className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-xs font-medium text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
            >
              Open tasks
            </a>
          </div>

          <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                Next task
              </p>
              {priorityTask ? (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold tracking-[-0.035em] text-[var(--text-primary)]">
                    {taskTitle(priorityTask)}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
                    Priority {textValue(priorityTask.priority) || "normal"} / Due{" "}
                    {dateValue(priorityTask.due_date, priorityTask.dueDate)}
                  </p>
                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]">
                    <div
                      className="h-full rounded-full bg-[var(--primary-soft)]"
                      style={{ width: `${Math.min(100, Math.max(0, taskCompletion))}%` }}
                    />
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-[var(--text-tertiary)]">No task assigned yet.</p>
              )}
            </div>

            <div className="divide-y divide-white/[0.055] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)]">
              {recentTasks.length ? (
                recentTasks.map((task, index) => (
                  <EmployeeDashboardRow
                    key={`${taskTitle(task)}-${index}`}
                    title={taskTitle(task)}
                    meta={`Priority ${textValue(task.priority) || "normal"} / ${dateValue(task.due_date, task.dueDate)}`}
                    value={isDoneTask(task) ? "Done" : isInProgressTask(task) ? "Working" : "To do"}
                  />
                ))
              ) : (
                <EmployeeDashboardEmpty text="No tasks assigned." />
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)]">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                Notifications
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
                Employee alerts
              </h2>
            </div>
            <a
              href="/employee/notifications"
              className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-xs font-medium text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
            >
              View all
            </a>
          </div>

          <div className="divide-y divide-white/[0.055]">
            {recentNotifications.length ? (
              recentNotifications.map((notification, index) => {
                const title = textValue(notification.title, notification.subject) || "Notification";
                const body = textValue(notification.body, notification.message, notification.description);

                return (
                  <div key={`${title}-${index}`} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{title}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-tertiary)]">
                          {body || "Employee notification update."}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-[var(--text-tertiary)]">
                        {dateValue(notification.created_at, notification.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmployeeDashboardEmpty text="No employee notifications yet." />
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)]">
          <EmployeeDashboardPanelHeader eyebrow="Sales desk" title="Recent sales" href="/employee/sales" action="Record sale" />
          <div className="divide-y divide-white/[0.055]">
            {recentSales.length ? (
              recentSales.map((sale, index) => {
                const quantity = numberValue(sale.quantity) || 1;
                const value = numberValue(
                  sale.revenue,
                  sale.total,
                  sale.total_amount,
                  sale.amount,
                  quantity * numberValue(sale.sale_price, sale.salePrice, sale.price),
                );

                return (
                  <EmployeeDashboardRow
                    key={`${saleProductName(sale)}-${index}`}
                    title={saleProductName(sale)}
                    meta={`SKU ${textValue(sale.sku, (sale.product as Record<string, unknown> | undefined)?.sku) || "none"} / Qty ${quantity}`}
                    value={moneyValue(value)}
                  />
                );
              })
            ) : (
              <EmployeeDashboardEmpty text="No sales recorded yet." />
            )}
          </div>
          {topSale ? (
            <div className="border-t border-[var(--border)] px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Highest sale
              </p>
              <p className="mt-2 text-sm font-semibold text-[var(--primary)]">
                {saleProductName(topSale)} /{" "}
                {moneyValue(numberValue(topSale.revenue, topSale.total, topSale.total_amount, topSale.amount))}
              </p>
            </div>
          ) : null}
        </div>

        <div className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)]">
          <EmployeeDashboardPanelHeader eyebrow="Expenses" title="My claims" href="/employee/expenses" action="Submit claim" />
          <div className="divide-y divide-white/[0.055]">
            {recentExpenses.length ? (
              recentExpenses.map((expense, index) => (
                <EmployeeDashboardRow
                  key={`${expenseTitle(expense)}-${index}`}
                  title={expenseTitle(expense)}
                  meta={`${textValue(expense.status) || "pending"} / ${dateValue(expense.date, expense.created_at, expense.createdAt)}`}
                  value={moneyValue(numberValue(expense.amount, expense.total))}
                />
              ))
            ) : (
              <EmployeeDashboardEmpty text="No expense claims submitted." />
            )}
          </div>
        </div>

        <div className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)]">
          <EmployeeDashboardPanelHeader eyebrow="Stock watch" title="Low-stock items" href="/employee/inventory" action="Open inventory" />
          <div className="divide-y divide-white/[0.055]">
            {lowStockItems.slice(0, 6).length ? (
              lowStockItems.slice(0, 6).map((item, index) => (
                <EmployeeDashboardRow
                  key={`${productName(item)}-${index}`}
                  title={productName(item)}
                  meta={`SKU ${textValue(item.sku) || "none"}`}
                  value={`${numberValue(item.stock, item.quantity_on_hand, item.on_hand, item.available)} pcs`}
                />
              ))
            ) : (
              <EmployeeDashboardEmpty text="No low-stock items right now." />
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              Timeline
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
              Recent employee activity
            </h2>
          </div>
          <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-xs text-[var(--primary)]">
            {recentActivity.length} latest
          </span>
        </div>

        <div className="divide-y divide-white/[0.055]">
          {recentActivity.length ? (
            recentActivity.map((item, index) => {
              const title = textValue(item.title, item.action, item.event_type, item.type) || "Activity";
              const body = textValue(item.description, item.message, item.body);

              return (
                <div key={`${title}-${index}`} className="grid gap-3 px-5 py-4 md:grid-cols-[160px_minmax(0,1fr)]">
                  <p className="text-[11px] text-[var(--text-tertiary)]">
                    {dateValue(item.created_at, item.createdAt, item.date)}
                  </p>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
                      {body || "Employee workspace activity."}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <EmployeeDashboardEmpty text="No recent employee activity." />
          )}
        </div>
      </section>
    </div>
  );
}

function EmployeeDashboardAction({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: string;
}) {
  return (
    <a
      href={href}
      className="group rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3 transition hover:border-[var(--primary-border)] hover:bg-[var(--primary-soft)]"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)] group-hover:text-[var(--primary)]">
        {label}
      </p>
      <p className="mt-2 truncate text-sm font-semibold text-[var(--text-primary)]">{value}</p>
    </a>
  );
}

function EmployeeDashboardStackMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
          {label}
        </p>
        <p className="text-lg font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{value}</p>
      </div>
      <p className="mt-1 text-xs text-[var(--text-tertiary)]">{detail}</p>
    </div>
  );
}

function EmployeeDashboardStat({
  title,
  value,
  caption,
}: {
  title: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.25rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] px-5 py-5">
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/30 to-transparent" />
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
        {title}
      </p>
      <p className="mt-4 text-3xl font-semibold tracking-[-0.06em] text-[var(--text-primary)]">{value}</p>
      <p className="mt-2 text-xs text-[var(--primary)]">{caption}</p>
    </div>
  );
}

function EmployeeDashboardPanelHeader({
  eyebrow,
  title,
  href,
  action,
}: {
  eyebrow: string;
  title: string;
  href: string;
  action: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{title}</h2>
      </div>
      <a
        href={href}
        className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-xs font-medium text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
      >
        {action}
      </a>
    </div>
  );
}

function EmployeeDashboardRow({
  title,
  meta,
  value,
}: {
  title: string;
  meta: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="mt-1 truncate text-xs text-[var(--text-tertiary)]">{meta}</p>
      </div>
      <span className="shrink-0 rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--primary)]">
        {value}
      </span>
    </div>
  );
}

function EmployeeDashboardEmpty({ text }: { text: string }) {
  return <p className="px-5 py-6 text-sm text-[var(--text-tertiary)]">{text}</p>;
}
























export function EmployeeSalesView({ model }: { model: EmployeePortalReadModel }) {
  const { summary } = model;
  const availableProducts = model.inventory.filter((item) => item.stock > 0);
  const recentSales = model.sales.slice(0, 8);
  const lowStock = model.inventory.filter((item) => item.stock <= item.lowStockThreshold);
  const averageSale =
    summary.recentSalesCount > 0 ? summary.recentSalesValue / summary.recentSalesCount : 0;
  const totalProfit = model.sales.reduce((sum, sale) => sum + sale.profit, 0);
  const sellableStock = availableProducts.reduce((sum, product) => sum + product.stock, 0);

  return (
    <section className="space-y-5">
      <section className="relative overflow-hidden rounded-[1.6rem] border border-[var(--primary-border)] bg-[image:var(--gradient-hero)] p-5 shadow-[var(--shadow-lg)]">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent" />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(500px,0.95fr)] xl:items-stretch">
          <div className="flex min-h-[250px] flex-col justify-between rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-soft)] p-5">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                  Employee sales desk
                </span>
                <span className="rounded-full border border-[var(--success-border)] bg-[var(--success-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--success)]">
                  Inventory linked
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                  {summary.currency}
                </span>
              </div>

              <h2 className="mt-7 text-5xl font-semibold tracking-[-0.07em] text-[var(--text-primary)]">
                Record sales with live stock and profit visibility.
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-tertiary)]">
                Product, SKU, stock, cost, selling price, quantity, profit and employee notes stay
                connected to inventory and the cash ledger.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-4">
              <EmployeeSalesHeroMetric label="Sales" value={`${summary.recentSalesCount}`} helper="Recorded by you" />
              <EmployeeSalesHeroMetric label="Revenue" value={money(summary.recentSalesValue, summary.currency)} helper="Employee sales value" />
              <EmployeeSalesHeroMetric label="Profit" value={money(totalProfit, summary.currency)} helper="Gross profit" />
              <EmployeeSalesHeroMetric label="Products" value={`${availableProducts.length}`} helper={`${sellableStock} pcs sellable`} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <EmployeeSalesFocusCard
              icon={ShoppingCart}
              label="Average sale"
              value={money(averageSale, summary.currency)}
              helper="Average employee transaction"
            />
            <EmployeeSalesFocusCard
              icon={Boxes}
              label="Low stock"
              value={`${lowStock.length}`}
              helper="Products near reorder level"
            />
            <EmployeeSalesFocusCard
              icon={WalletCards}
              label="Cash impact"
              value={money(summary.recentSalesValue, summary.currency)}
              helper="Recorded as employee sale inflow"
            />
            <EmployeeSalesFocusCard
              icon={BarChart3}
              label="Margin check"
              value={summary.recentSalesValue > 0 ? `${Math.round((totalProfit / summary.recentSalesValue) * 100)}%` : "0%"}
              helper="Recent gross margin"
            />
          </div>
        </div>
      </section>

      <EmployeeSaleFormPanel products={availableProducts} currency={summary.currency} />

      <EmployeeSalesAnalyticsPanel
        sales={model.sales}
        inventory={model.inventory}
        currency={summary.currency}
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <EmployeeRecentSalesPanel sales={recentSales} currency={summary.currency} />
        <EmployeeSalesActivityPanel model={model} />
      </div>
    </section>
  );
}

function EmployeeSalesAnalyticsPanel({
  sales,
  inventory,
  currency,
}: {
  sales: EmployeePortalSale[];
  inventory: EmployeePortalInventoryItem[];
  currency: string;
}) {
  const salesByDate = buildEmployeeSalesTrend(sales);
  const productBreakdown = buildEmployeeProductBreakdown(sales);
  const stockBreakdown = buildEmployeeStockBreakdown(inventory);
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const totalProfit = sales.reduce((sum, sale) => sum + sale.profit, 0);
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
      <div className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              Sales trend
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
              Revenue line graph
            </h3>
            <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
              Built from this employee's recorded sale transactions.
            </p>
          </div>
          <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-xs text-[var(--primary)]">
            {money(totalRevenue, currency)}
          </span>
        </div>

        <div className="p-5">
          <EmployeeSalesLineGraph data={salesByDate} currency={currency} />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <EmployeeSalesChartStat label="Revenue" value={money(totalRevenue, currency)} />
            <EmployeeSalesChartStat label="Profit" value={money(totalProfit, currency)} />
            <EmployeeSalesChartStat label="Margin" value={`${margin.toFixed(1)}%`} />
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-1">
        <EmployeeSalesPieCard
          title="Revenue by product"
          eyebrow="Product mix"
          data={productBreakdown}
          empty="No product revenue yet."
        />
        <EmployeeSalesPieCard
          title="Stock position"
          eyebrow="Inventory mix"
          data={stockBreakdown}
          empty="No inventory data yet."
        />
      </div>
    </section>
  );
}

function buildEmployeeSalesTrend(sales: EmployeePortalSale[]) {
  const buckets = new Map<string, { label: string; value: number }>();

  for (const sale of sales) {
    const rawCreatedAt = sale.createdAt || "";
    const date = new Date(rawCreatedAt);
    const key = Number.isNaN(date.getTime()) ? "Unknown" : date.toISOString().slice(0, 10);
    const label = Number.isNaN(date.getTime())
      ? "Unknown"
      : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

    const current = buckets.get(key) || { label, value: 0 };
    current.value += sale.amount;
    buckets.set(key, current);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value)
    .slice(-8);
}

function buildEmployeeProductBreakdown(sales: EmployeePortalSale[]) {
  const buckets = new Map<string, number>();

  for (const sale of sales) {
    const key = sale.productName || sale.customerName || "Sale";
    buckets.set(key, (buckets.get(key) || 0) + sale.amount);
  }

  return Array.from(buckets.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

function buildEmployeeStockBreakdown(inventory: EmployeePortalInventoryItem[]) {
  const inStock = inventory.filter((item) => item.stock > item.lowStockThreshold).length;
  const lowStock = inventory.filter((item) => item.stock > 0 && item.stock <= item.lowStockThreshold).length;
  const outOfStock = inventory.filter((item) => item.stock <= 0).length;

  return [
    { label: "In stock", value: inStock },
    { label: "Low stock", value: lowStock },
    { label: "Out of stock", value: outOfStock },
  ].filter((item) => item.value > 0);
}

function EmployeeSalesLineGraph({
  data,
  currency,
}: {
  data: { label: string; value: number }[];
  currency: string;
}) {
  const width = 720;
  const height = 220;
  const paddingX = 34;
  const paddingY = 26;
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const points = data.length
    ? data
        .map((item, index) => {
          const x = paddingX + (data.length === 1 ? chartWidth / 2 : (index / (data.length - 1)) * chartWidth);
          const y = paddingY + chartHeight - (item.value / maxValue) * chartHeight;

          return `${x},${y}`;
        })
        .join(" ")
    : "";

  return (
    <div className="rounded-[1.15rem] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
      {data.length ? (
        <>
          <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full overflow-visible">
            <defs>
              <linearGradient id="employee-sales-line-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="color-mix(in srgb, var(--chart-1) 20%, transparent)" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>

            {[0, 1, 2, 3].map((line) => {
              const y = paddingY + (line / 3) * chartHeight;

              return (
                <line
                  key={line}
                  x1={paddingX}
                  x2={width - paddingX}
                  y1={y}
                  y2={y}
                  stroke="var(--chart-grid)"
                  strokeWidth="1"
                />
              );
            })}

            {points ? (
              <polyline
                points={`${paddingX},${height - paddingY} ${points} ${width - paddingX},${height - paddingY}`}
                fill="url(#employee-sales-line-fill)"
                stroke="none"
              />
            ) : null}

            <polyline
              points={points}
              fill="none"
              stroke="var(--chart-1)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {data.map((item, index) => {
              const x = paddingX + (data.length === 1 ? chartWidth / 2 : (index / (data.length - 1)) * chartWidth);
              const y = paddingY + chartHeight - (item.value / maxValue) * chartHeight;

              return (
                <g key={`${item.label}-${index}`}>
                  <circle cx={x} cy={y} r="5" fill="var(--chart-1)" />
                  <text x={x} y={height - 6} textAnchor="middle" className="fill-white/30 text-[10px]">
                    {item.label}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-tertiary)]">
            <span>Lowest point</span>
            <span>Peak {money(maxValue, currency)}</span>
          </div>
        </>
      ) : (
        <EmptyState text="No sales data available for the line graph yet." />
      )}
    </div>
  );
}

function EmployeeSalesPieCard({
  eyebrow,
  title,
  data,
  empty,
}: {
  eyebrow: string;
  title: string;
  data: { label: string; value: number }[];
  empty: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const palette = [
    "var(--chart-1)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--chart-6)",
  ];

  let cursor = 0;
  const gradientParts = data.map((item, index) => {
    const start = cursor;
    const share = total > 0 ? (item.value / total) * 100 : 0;
    cursor += share;

    return `${palette[index % palette.length]} ${start}% ${cursor}%`;
  });

  const gradient = gradientParts.length
    ? `conic-gradient(${gradientParts.join(", ")})`
    : "conic-gradient(var(--progress-track) 0% 100%)";

  return (
    <div className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-5 shadow-[var(--shadow-card)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
        {eyebrow}
      </p>
      <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
        {title}
      </h3>

      {data.length ? (
        <div className="mt-5 grid grid-cols-[132px_minmax(0,1fr)] items-center gap-5">
          <div className="relative h-[132px] w-[132px] rounded-full border border-[var(--border)]" style={{ background: gradient }}>
            <div className="absolute inset-[24px] grid place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)]">
              <div className="text-center">
                <p className="text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                  {total}
                </p>
                <p className="text-[9px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                  total
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {data.map((item, index) => {
              const share = total > 0 ? Math.round((item.value / total) * 100) : 0;

              return (
                <div key={`${item.label}-${index}`} className="flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="truncate text-[var(--text-secondary)]">{item.label}</p>
                    <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">{share}% share</p>
                  </div>
                  <span className="shrink-0 font-semibold text-[var(--primary)]">{item.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState text={empty} />
        </div>
      )}
    </div>
  );
}

function EmployeeSalesChartStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function EmployeeSaleFormPanel({
  products,
  currency,
}: {
  products: EmployeePortalInventoryItem[];
  currency: string;
}) {
  const router = useRouter();
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || "");
  const [productSearch, setProductSearch] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<
    | { type: "success"; text: string }
    | { type: "error"; text: string }
    | null
  >(null);
  const [isPending, startTransition] = useTransition();

  const selectedProduct = products.find((product) => product.id === selectedProductId) || null;
  const selectedSku = selectedProduct?.sku || "No SKU";
  const unitCost = selectedProduct?.unitCost || 0;
  const suggestedSellingPrice = selectedProduct?.sellingPrice || 0;
  const quantitySold = selectedProduct?.quantitySold || 0;
  const quantityNumber = Math.max(Math.floor(numberValue(quantity)), 0);
  const unitPriceNumber = numberValue(unitPrice);
  const total = quantityNumber * unitPriceNumber;
  const grossProfit = total - unitCost * quantityNumber;
  const margin = total > 0 ? (grossProfit / total) * 100 : 0;
  const stockAfterSale =
    selectedProduct && quantityNumber > 0
      ? Math.max(selectedProduct.stock - quantityNumber, 0)
      : null;
  const saleIsTooLarge = Boolean(selectedProduct && quantityNumber > selectedProduct.stock);
  const selectedProductNotes = String((selectedProduct as { notes?: string | null } | null)?.notes || "").trim();

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();

    if (!query) return products.slice(0, 14);

    return products
      .filter((product) => {
        const notes = String((product as { notes?: string | null }).notes || "").toLowerCase();
        const haystack = `${product.name} ${product.sku || ""} ${notes}`.toLowerCase();

        return haystack.includes(query);
      })
      .slice(0, 14);
  }, [productSearch, products]);

  function selectProduct(product: EmployeePortalInventoryItem) {
    setSelectedProductId(product.id);
    setMessage(null);

    if (product.sellingPrice > 0) {
      setUnitPrice(String(product.sellingPrice));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (saleIsTooLarge) {
      setMessage({ type: "error", text: "Quantity sold cannot be higher than current stock." });
      return;
    }

    startTransition(() => {
      void (async () => {
        const result = await recordEmployeePortalSale({
          productId: selectedProductId,
          quantity: quantityNumber,
          unitPrice: unitPriceNumber,
          notes,
        });

        if (!result.ok) {
          setMessage({ type: "error", text: result.error });
          return;
        }

        setMessage({ type: "success", text: "Sale recorded successfully." });
        setQuantity("1");
        setUnitPrice("");
        setNotes("");
        router.refresh();
      })();
    });
  }

  return (
    <section className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            New sale entry
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
            Product sale workspace
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-tertiary)]">
            Choose a product on the left, verify stock and economics on the right, then submit the
            sale with a note for admin/founder review.
          </p>
        </div>
        <ShoppingCart className="h-6 w-6 text-[var(--primary)]" />
      </div>

      <form onSubmit={handleSubmit} className="p-5">
        <div className="grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
          <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                  Product picker
                </p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {products.length} products available for employee sales
                </p>
              </div>
              {selectedProduct ? (
                <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-xs text-[var(--primary)]">
                  {selectedProduct.stock} pcs left
                </span>
              ) : null}
            </div>

            <input
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder="Search product, SKU or notes..."
              className="mt-4 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary-border)]"
            />

            <div className="mt-4 max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {filteredProducts.map((product) => {
                const active = product.id === selectedProductId;
                const productNotes = String((product as { notes?: string | null }).notes || "").trim();

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => selectProduct(product)}
                    className={[
                      "w-full rounded-2xl border px-3.5 py-3.5 text-left transition",
                      active
                        ? "border-[var(--primary-border)] bg-[var(--primary-soft)] shadow-[var(--shadow-xs)]"
                        : "border-[var(--border)] bg-[var(--surface-subtle)] hover:border-[var(--primary-border)] hover:bg-[var(--primary-soft)]",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                          {product.name}
                        </p>
                        <p className="mt-1 truncate text-[11px] text-[var(--text-tertiary)]">
                          SKU {product.sku || "-"} / Sold {product.quantitySold} pcs
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
                        {product.stock} left
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                      <span className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1.5 text-[var(--text-tertiary)]">
                        Cost {money(product.unitCost, currency)}
                      </span>
                      <span className="rounded-lg border border-[var(--primary-border)] bg-[var(--primary-soft)] px-2 py-1.5 text-[var(--primary)]">
                        Selling price {product.sellingPrice > 0 ? money(product.sellingPrice, currency) : "Not set"}
                      </span>
                    </div>

                    {productNotes ? (
                      <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-[var(--text-muted)]">
                        {productNotes}
                      </p>
                    ) : null}
                  </button>
                );
              })}

              {!filteredProducts.length && <EmptyState text="No matching products found." />}
            </div>
          </div>

          <div className="space-y-4">
            {selectedProduct ? (
              <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                      Selected product
                    </p>
                    <h4 className="mt-2 truncate text-2xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
                      {selectedProduct.name}
                    </h4>
                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                      SKU {selectedSku} / Current stock {selectedProduct.stock} pcs
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-xs text-[var(--primary)]">
                    {stockAfterSale === null ? "Ready" : `${stockAfterSale} pcs after sale`}
                  </span>
                </div>

                {selectedProductNotes ? (
                  <p className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-3 text-xs leading-5 text-[var(--text-tertiary)]">
                    {selectedProductNotes}
                  </p>
                ) : null}

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SalePreview label="SKU" value={selectedSku} />
                  <SalePreview label="Current stock" value={`${selectedProduct.stock} pcs`} />
                  <SalePreview label="Already sold" value={`${quantitySold} pcs`} />
                  <SalePreview label="Cost per unit" value={money(unitCost, currency)} />
                </div>
              </div>
            ) : (
              <EmptyState text="Select a product before entering sale details." />
            )}

            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    Quantity sold
                  </span>
                  <input
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    type="number"
                    min="1"
                    max={selectedProduct?.stock || undefined}
                    className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--primary-border)]"
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                    Selling price per unit
                  </span>
                  <input
                    value={unitPrice}
                    onChange={(event) => setUnitPrice(event.target.value)}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={suggestedSellingPrice > 0 ? String(suggestedSellingPrice) : "0.00"}
                    className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--primary-border)]"
                  />
                  {suggestedSellingPrice > 0 ? (
                    <p className="mt-2 text-[10px] text-[var(--text-tertiary)]">
                      Suggested selling price: {money(suggestedSellingPrice, currency)}
                    </p>
                  ) : null}
                </label>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SalePreview
                  label="Stock after"
                  value={stockAfterSale === null ? "Select product" : `${stockAfterSale} pcs`}
                />
                <SalePreview label="Sale total" value={money(total, currency)} />
                <SalePreview label="Gross profit" value={money(grossProfit, currency)} />
                <SalePreview label="Margin" value={`${margin.toFixed(1)}%`} />
              </div>
            </div>

            <label className="block rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                Employee note for admin/founder
              </span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                placeholder="Example: customer paid cash, discount approved, item collected in store, receipt number..."
                className="mt-3 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary-border)]"
              />
              <p className="mt-2 text-[10px] text-[var(--text-tertiary)]">
                Written by the employee and visible to admin/founder in the Sales Transactions table.
              </p>
            </label>

            {selectedProduct && stockAfterSale !== null && stockAfterSale <= selectedProduct.lowStockThreshold ? (
              <div className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-3 text-xs text-[var(--warning)]">
                Low-stock warning: this sale leaves {stockAfterSale} pcs on hand.
              </div>
            ) : null}

            {saleIsTooLarge ? (
              <div className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-3 py-3 text-xs text-[var(--danger)]">
                Quantity sold is higher than current stock.
              </div>
            ) : null}

            {message ? (
              <div
                className={[
                  "rounded-xl border px-3 py-3 text-xs",
                  message.type === "success"
                    ? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]"
                    : "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]",
                ].join(" ")}
              >
                {message.text}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isPending || saleIsTooLarge || !selectedProductId || quantityNumber <= 0 || unitPriceNumber <= 0}
              className="h-13 w-full rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isPending ? "Recording sale..." : "Record Sale"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function EmployeeRecentSalesPanel({
  sales,
  currency,
}: {
  sales: EmployeePortalSale[];
  currency: string;
}) {
  return (
    <section className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            My recent sales
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
            Sales transactions
          </h3>
          <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
            Product, SKU, price, cost, profit and employee notes for sales you recorded.
          </p>
        </div>
        <ReceiptText className="h-5 w-5 text-[var(--primary)]" />
      </div>

      <div className="divide-y divide-white/[0.055]">
        {sales.map((sale) => (
          <SaleRow key={sale.id} sale={sale} currency={currency} />
        ))}

        {!sales.length && (
          <div className="p-5">
            <EmptyState text="No sales recorded by this employee yet." />
          </div>
        )}
      </div>
    </section>
  );
}

function EmployeeSalesInventoryPanel({
  inventory,
  currency,
}: {
  inventory: EmployeePortalInventoryItem[];
  currency: string;
}) {
  return (
    <section className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Product stock
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
            Inventory available for sales
          </h3>
          <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
            Employee can only record sales against visible products.
          </p>
        </div>
        <Boxes className="h-5 w-5 text-[var(--primary)]" />
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-2">
        {inventory.map((item) => (
          <EmployeeSalesStockCard key={item.id} item={item} currency={currency} />
        ))}

        {!inventory.length && <EmptyState text="No products are available for employee sales." />}
      </div>
    </section>
  );
}

function EmployeeSalesActivityPanel({ model }: { model: EmployeePortalReadModel }) {
  const employeeSalesActivity = model.activity
    .filter((item) => {
      const value = `${item.type} ${item.title} ${item.description}`.toLowerCase();

      return (
        value.includes("sale") ||
        value.includes("product") ||
        value.includes("stock") ||
        value.includes("inventory")
      );
    })
    .slice(0, 8);

  return (
    <section className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Sales activity
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
            Employee sales updates
          </h3>
          <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
            Sale, product and stock activity visible to this employee.
          </p>
        </div>
        <Activity className="h-5 w-5 text-[var(--primary)]" />
      </div>

      <div className="divide-y divide-white/[0.055]">
        {employeeSalesActivity.map((item) => (
          <div key={item.id} className="px-5 py-4">
            <ActivityRow item={item} />
          </div>
        ))}

        {!employeeSalesActivity.length && (
          <div className="p-5">
            <EmptyState text="No employee sales activity yet." />
          </div>
        )}
      </div>
    </section>
  );
}

function SalePreview({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-2 truncate text-sm font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function SaleRow({
  sale,
  currency,
}: {
  sale: EmployeePortalSale;
  currency: string;
}) {
  const margin = sale.amount > 0 ? (sale.profit / sale.amount) * 100 : 0;

  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {sale.productName || sale.customerName || "Sale"}
          </p>
          <p className="mt-1 truncate text-xs text-[var(--text-tertiary)]">
            SKU {sale.sku || "-"} / Qty {sale.quantity} / {dateLabel(sale.createdAt)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-[var(--primary)]">
            {money(sale.amount, currency)}
          </p>
          <p className="mt-1 text-xs text-[var(--success)]">
            {money(sale.profit, currency)} profit
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-2">
          <p className="text-[var(--text-muted)]">Sale price</p>
          <p className="mt-1 text-[var(--text-secondary)]">{money(sale.unitPrice, currency)}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-2">
          <p className="text-[var(--text-muted)]">Cost</p>
          <p className="mt-1 text-[var(--text-secondary)]">{money(sale.unitCost, currency)}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-2">
          <p className="text-[var(--text-muted)]">Margin</p>
          <p className="mt-1 text-[var(--text-secondary)]">{margin.toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-2">
          <p className="text-[var(--text-muted)]">Recorded</p>
          <p className="mt-1 text-[var(--text-secondary)]">{dateLabel(sale.createdAt)}</p>
        </div>
      </div>

      {sale.notes ? (
        <p className="mt-3 line-clamp-2 rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-2 text-xs leading-5 text-[var(--primary)]">
          Employee note: {sale.notes}
        </p>
      ) : null}
    </div>
  );
}

function EmployeeSalesHeroMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
        {label}
      </p>
      <p className="mt-2 truncate text-lg font-semibold tracking-[-0.035em] text-[var(--text-primary)]">
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-[var(--primary)]">{helper}</p>
    </div>
  );
}

function EmployeeSalesFocusCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof ShoppingCart;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--primary-border)] bg-[image:var(--gradient-panel)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
            {label}
          </p>
          <p className="mt-4 text-2xl font-semibold tracking-[-0.055em] text-[var(--text-primary)]">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-[var(--primary)]" />
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--text-tertiary)]">{helper}</p>
    </div>
  );
}

function EmployeeSalesStockCard({
  item,
  currency,
}: {
  item: EmployeePortalInventoryItem;
  currency: string;
}) {
  const status =
    item.stock <= 0 ? "Out" : item.stock <= item.lowStockThreshold ? "Low" : "In stock";
  const statusClass =
    status === "Out"
      ? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]"
      : status === "Low"
        ? "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]"
        : "border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]";

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{item.name}</p>
          <p className="mt-1 truncate text-xs text-[var(--text-tertiary)]">
            SKU {item.sku || "-"}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusClass}`}>
          {status}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-2">
          <p className="text-[var(--text-muted)]">On hand</p>
          <p className="mt-1 font-semibold text-[var(--text-secondary)]">{item.stock} pcs</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-2">
          <p className="text-[var(--text-muted)]">Sold</p>
          <p className="mt-1 font-semibold text-[var(--text-secondary)]">{item.quantitySold} pcs</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-2">
          <p className="text-[var(--text-muted)]">Cost</p>
          <p className="mt-1 font-semibold text-[var(--text-secondary)]">{money(item.unitCost, currency)}</p>
        </div>
        <div className="rounded-lg border border-[var(--primary-border)] bg-[var(--primary-soft)] px-2.5 py-2">
          <p className="text-[var(--primary)]">Sell price</p>
          <p className="mt-1 font-semibold text-[var(--primary)]">{money(item.sellingPrice, currency)}</p>
        </div>
      </div>
    </div>
  );
}




export function EmployeeInventoryView({ model }: { model: EmployeePortalReadModel }) {
  const { summary } = model;
  const [query, setQuery] = useState("");

  const inventory = model.inventory;
  const inStock = inventory.filter((item) => item.stock > item.lowStockThreshold);
  const lowStock = inventory.filter((item) => item.stock > 0 && item.stock <= item.lowStockThreshold);
  const outOfStock = inventory.filter((item) => item.stock <= 0);
  const sellableItems = inventory.filter((item) => item.stock > 0);
  const totalInventoryValue = inventory.reduce((sum, item) => sum + item.stock * item.unitCost, 0);
  const potentialSalesValue = inventory.reduce((sum, item) => sum + item.stock * item.sellingPrice, 0);
  const potentialGrossProfit = potentialSalesValue - totalInventoryValue;
  const totalUnits = inventory.reduce((sum, item) => sum + item.stock, 0);
  const soldUnits = inventory.reduce((sum, item) => sum + item.quantitySold, 0);
  const boughtUnits = inventory.reduce((sum, item) => sum + item.quantityBought, 0);

  const visibleInventory = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) return inventory;

    return inventory.filter((item) => {
      const haystack = `${item.name} ${item.sku || ""} ${inventoryItemNotes(item)}`.toLowerCase();

      return haystack.includes(term);
    });
  }, [inventory, query]);

  const topValueItems = [...inventory]
    .sort((a, b) => b.stock * b.unitCost - a.stock * a.unitCost)
    .slice(0, 7);

  const stockMix = [
    { label: "Healthy", value: inStock.length },
    { label: "Low", value: lowStock.length },
    { label: "Out", value: outOfStock.length },
  ].filter((item) => item.value > 0);

  return (
    <section className="space-y-5">
      <section className="relative overflow-hidden rounded-[1.6rem] border border-[var(--primary-border)] bg-[image:var(--gradient-hero)] p-5 shadow-[var(--shadow-lg)]">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent" />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(500px,0.92fr)] xl:items-stretch">
          <div className="flex min-h-[250px] flex-col justify-between rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-soft)] p-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                  Employee inventory
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                  Read-only
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                  {summary.currency}
                </span>
              </div>

              <h2 className="mt-7 text-5xl font-semibold tracking-[-0.07em] text-[var(--text-primary)]">
                Inventory visibility for employee sales.
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-tertiary)]">
                Stock, SKU, cost, selling price, bought, sold and on-hand levels are shown without
                exposing admin-only finance, ownership or investor data.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-4">
              <EmployeeInventoryHeroMetric label="Products" value={`${summary.inventoryItemCount}`} helper="Visible items" />
              <EmployeeInventoryHeroMetric label="On hand" value={`${totalUnits}`} helper="Units available" />
              <EmployeeInventoryHeroMetric label="Cost value" value={money(totalInventoryValue, summary.currency)} helper="Inventory cost basis" />
              <EmployeeInventoryHeroMetric label="Potential sale" value={money(potentialSalesValue, summary.currency)} helper="At selling price" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <EmployeeInventoryFocusCard label="In stock" value={`${sellableItems.length}`} helper={`${inStock.length} healthy products`} tone="cyan" />
            <EmployeeInventoryFocusCard label="Low stock" value={`${lowStock.length}`} helper="Needs replenishment attention" tone="cyan" />
            <EmployeeInventoryFocusCard label="Out of stock" value={`${outOfStock.length}`} helper="Unavailable for sale" tone="red" />
            <EmployeeInventoryFocusCard label="Potential profit" value={money(potentialGrossProfit, summary.currency)} helper={`${soldUnits} sold / ${boughtUnits} bought`} tone="green" />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <div className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                Inventory value
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                Value by product
              </h3>
              <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
                Dynamic chart based on current product stock and unit cost.
              </p>
            </div>
            <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-xs text-[var(--primary)]">
              {money(totalInventoryValue, summary.currency)}
            </span>
          </div>

          <div className="p-5">
            <EmployeeInventoryValueChart items={topValueItems} currency={summary.currency} />
          </div>
        </div>

        <div className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-5 shadow-[var(--shadow-card)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Stock mix
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
            Inventory status pie chart
          </h3>
          <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
            Healthy, low-stock and out-of-stock products from real inventory rows.
          </p>

          <EmployeeInventoryPieChart data={stockMix} total={inventory.length} />
        </div>
      </section>

      <section className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              Inventory register
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
              Products available to employee
            </h3>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">
              Searchable read-only table for SKU, stock, product economics and sale availability.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search SKU, item or notes..."
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary-border)] xl:w-[420px]"
            />
            <div className="grid grid-cols-3 gap-2 sm:w-[280px]">
              <MiniInventoryPill label="Low" value={`${lowStock.length}`} />
              <MiniInventoryPill label="Out" value={`${outOfStock.length}`} tone="red" />
              <MiniInventoryPill label="Rows" value={`${visibleInventory.length}`} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                <th className="w-[90px] px-5 py-3">SKU</th>
                <th className="px-5 py-3">Product</th>
                <th className="w-[130px] px-5 py-3 text-right">Unit cost</th>
                <th className="w-[140px] px-5 py-3 text-right">Selling price</th>
                <th className="w-[90px] px-5 py-3 text-right">Bought</th>
                <th className="w-[90px] px-5 py-3 text-right">Sold</th>
                <th className="w-[90px] px-5 py-3 text-right">On hand</th>
                <th className="w-[140px] px-5 py-3 text-right">Cost value</th>
                <th className="w-[140px] px-5 py-3 text-right">Sale value</th>
                <th className="w-[130px] px-5 py-3">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.055]">
              {visibleInventory.map((item) => (
                <EmployeeInventoryRegisterRow
                  key={item.id}
                  item={item}
                  currency={summary.currency}
                />
              ))}
            </tbody>
          </table>

          {!visibleInventory.length ? (
            <div className="p-5">
              <EmptyState text="No inventory items matched your search." />
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}

function EmployeeInventoryRegisterRow({
  item,
  currency,
}: {
  item: EmployeePortalInventoryItem;
  currency: string;
}) {
  const itemNotes = inventoryItemNotes(item);
  const status =
    item.stock <= 0
      ? "Out of stock"
      : item.stock <= item.lowStockThreshold
        ? "Low stock"
        : "In stock";

  const statusClass =
    status === "Out of stock"
      ? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]"
      : status === "Low stock"
        ? "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]"
        : "border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]";

  return (
    <tr className="text-sm transition hover:bg-[var(--surface-subtle)]">
      <td className="px-5 py-3.5 text-[var(--text-tertiary)]">{item.sku || "-"}</td>

      <td className="px-5 py-3.5">
        <div className="min-w-0">
          <p className="truncate font-medium text-[var(--text-primary)]">{item.name}</p>
          <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
            {itemNotes || "No product notes"}
          </p>
        </div>
      </td>

      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)]">
        {money(item.unitCost, currency)}
      </td>

      <td className="px-5 py-3.5 text-right font-medium text-[var(--primary)]">
        {money(item.sellingPrice, currency)}
      </td>

      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)]">{item.quantityBought}</td>
      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)]">{item.quantitySold}</td>
      <td className="px-5 py-3.5 text-right font-semibold text-[var(--text-primary)]">{item.stock}</td>

      <td className="px-5 py-3.5 text-right font-medium text-[var(--text-secondary)]">
        {money(item.stock * item.unitCost, currency)}
      </td>

      <td className="px-5 py-3.5 text-right font-medium text-[var(--primary)]">
        {money(item.stock * item.sellingPrice, currency)}
      </td>

      <td className="px-5 py-3.5">
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusClass}`}>
          {status}
        </span>
      </td>
    </tr>
  );
}

function EmployeeInventoryHeroMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
        {label}
      </p>
      <p className="mt-2 truncate text-lg font-semibold tracking-[-0.035em] text-[var(--text-primary)]">
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-[var(--primary)]">{helper}</p>
    </div>
  );
}

function EmployeeInventoryFocusCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: "cyan" | "amber" | "red" | "green";
}) {
  const valueClass = {
    cyan: "text-[var(--primary)]",
    amber: "text-[var(--warning)]",
    red: "text-[var(--danger)]",
    green: "text-[var(--success)]",
  }[tone];

  return (
    <div className="rounded-[1.25rem] border border-[var(--primary-border)] bg-[image:var(--gradient-panel)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
        {label}
      </p>
      <p className={`mt-4 text-2xl font-semibold tracking-[-0.055em] ${valueClass}`}>
        {value}
      </p>
      <p className="mt-3 text-xs leading-5 text-[var(--text-tertiary)]">{helper}</p>
    </div>
  );
}

function EmployeeInventoryValueChart({
  items,
  currency,
}: {
  items: EmployeePortalInventoryItem[];
  currency: string;
}) {
  const maxValue = Math.max(...items.map((item) => item.stock * item.unitCost), 1);

  if (!items.length) return <EmptyState text="No inventory value data yet." />;

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const value = item.stock * item.unitCost;
        const width = Math.max(4, Math.round((value / maxValue) * 100));

        return (
          <div key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{item.name}</p>
                <p className="mt-1 truncate text-xs text-[var(--text-tertiary)]">
                  SKU {item.sku || "-"} / {item.stock} pcs
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-[var(--primary)]">
                {money(value, currency)}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]">
              <div
                className="h-full rounded-full bg-[var(--primary-soft)]"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmployeeInventoryPieChart({
  data,
  total,
}: {
  data: { label: string; value: number }[];
  total: number;
}) {
  const palette = [
    "var(--chart-1)",
    "var(--chart-1)",
    "var(--chart-2)",
  ];

  let cursor = 0;
  const gradientParts = data.map((item, index) => {
    const start = cursor;
    const share = total > 0 ? (item.value / total) * 100 : 0;
    cursor += share;

    return `${palette[index % palette.length]} ${start}% ${cursor}%`;
  });

  const gradient = gradientParts.length
    ? `conic-gradient(${gradientParts.join(", ")})`
    : "conic-gradient(var(--progress-track) 0% 100%)";

  return (
    <div className="mt-5 grid grid-cols-[136px_minmax(0,1fr)] items-center gap-5">
      <div className="relative h-[136px] w-[136px] rounded-full border border-[var(--border)]" style={{ background: gradient }}>
        <div className="absolute inset-[24px] grid place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)]">
          <div className="text-center">
            <p className="text-2xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">{total}</p>
            <p className="text-[9px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">items</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {data.length ? (
          data.map((item, index) => {
            const share = total > 0 ? Math.round((item.value / total) * 100) : 0;

            return (
              <div key={`${item.label}-${index}`} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text-secondary)]">{item.label}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">{share}% of products</p>
                </div>
                <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1 text-xs text-[var(--primary)]">
                  {item.value}
                </span>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-[var(--text-tertiary)]">No inventory status data yet.</p>
        )}
      </div>
    </div>
  );
}

function inventoryItemNotes(item: EmployeePortalInventoryItem): string {
  return String((item as { notes?: string | null }).notes || "").trim();
}













function CompactInventoryStat({
  label,
  value,
  helper,
  tone = "white",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "white" | "cyan" | "amber" | "red";
}) {
  const toneClass = {
    white: "text-[var(--text-primary)]",
    cyan: "text-[var(--primary)]",
    amber: "text-[var(--warning)]",
    red: "text-[var(--danger)]",
  }[tone];

  return (
    <div className="rounded-xl border border-[var(--primary-border)] bg-[var(--surface-soft)] px-4 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-[var(--text-muted)]">
        {label}
      </p>
      <p className={`mt-2 text-lg font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-[11px] text-[var(--primary)]">{helper}</p>
    </div>
  );
}



function MiniInventoryPill({
  label,
  value,
  tone = "cyan",
}: {
  label: string;
  value: string;
  tone?: "cyan" | "amber" | "red";
}) {
  const toneClass = {
    cyan: "border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]",
    amber: "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]",
    red: "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]",
  }[tone];

  return (
    <div className={`rounded-xl border px-3 py-2 text-center ${toneClass}`}>
      <p className="text-[8px] font-semibold uppercase tracking-[0.16em] opacity-65">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}



function employeeExpensePayee(expense: EmployeePortalExpense): string {
  return String((expense as { payee?: string | null }).payee || "").trim();
}

function employeeExpenseNotes(expense: EmployeePortalExpense): string {
  return String((expense as { notes?: string | null }).notes || "").trim();
}

function employeeExpenseReceiptUrl(expense: EmployeePortalExpense): string {
  return String((expense as { receiptUrl?: string | null }).receiptUrl || "").trim();
}



















export function EmployeeExpensesView({ model }: { model: EmployeePortalReadModel }) {
  const { summary } = model;
  const expenses = model.expenses;
  const pending = expenses.filter((expense) => expenseStatusGroup(expense.status) === "pending");
  const approved = expenses.filter((expense) => expenseStatusGroup(expense.status) === "approved");
  const rejected = expenses.filter((expense) => expenseStatusGroup(expense.status) === "rejected");
  const totalValue = expenses.reduce((sum, expense) => sum + numberValue(expense.amount), 0);
  const approvedValue = approved.reduce((sum, expense) => sum + numberValue(expense.amount), 0);
  const pendingValue = pending.reduce((sum, expense) => sum + numberValue(expense.amount), 0);
  const latestExpense = expenses[0] || null;
  const averageClaim = expenses.length ? totalValue / expenses.length : 0;

  return (
    <section className="space-y-5">
      <section className="relative overflow-hidden rounded-[1.6rem] border border-[var(--primary-border)] bg-[image:var(--gradient-hero)] p-5 shadow-[var(--shadow-lg)]">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent" />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(500px,0.92fr)] xl:items-stretch">
          <div className="flex min-h-[250px] flex-col justify-between rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-soft)] p-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                  Employee expenses
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                  Admin review
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                  {summary.currency}
                </span>
              </div>

              <h2 className="mt-7 text-5xl font-semibold tracking-[-0.07em] text-[var(--text-primary)]">
                Submit and track employee expense claims.
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-tertiary)]">
                Employees can submit title, category, payee, amount, date and notes for admin/founder
                review without seeing company cash, ownership or investor data.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-4">
              <EmployeeExpenseHeroMetric label="Submitted" value={`${expenses.length}`} helper="Employee claims" />
              <EmployeeExpenseHeroMetric label="Pending" value={`${pending.length}`} helper="Waiting for admin" />
              <EmployeeExpenseHeroMetric label="Approved" value={`${approved.length}`} helper="Accepted claims" />
              <EmployeeExpenseHeroMetric label="Total" value={money(totalValue, summary.currency)} helper="Submitted value" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <EmployeeExpenseFocusCard label="Pending value" value={money(pendingValue, summary.currency)} helper={`${pending.length} claims waiting`} tone="cyan" />
            <EmployeeExpenseFocusCard label="Approved value" value={money(approvedValue, summary.currency)} helper={`${approved.length} approved claims`} tone="green" />
            <EmployeeExpenseFocusCard label="Rejected" value={`${rejected.length}`} helper="Declined or cancelled claims" tone="red" />
            <EmployeeExpenseFocusCard label="Average claim" value={money(averageClaim, summary.currency)} helper={latestExpense ? `Latest ${dateLabel(latestExpense.submittedAt)}` : "No latest claim"} tone="indigo" />
          </div>
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
        <EmployeeExpenseFormPanel currency={summary.currency} />

        <EmployeeExpensesAnalyticsPanel
          expenses={expenses}
          currency={summary.currency}
        />
      </div>

      <section className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              Claims register
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
              My submitted expenses
            </h3>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">
              Date, category, payee, amount, status, receipt and employee note for admin/founder review.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:w-[300px]">
            <EmployeeExpenseMiniPill label="Rows" value={`${expenses.length}`} />
            <EmployeeExpenseMiniPill label="Pending" value={`${pending.length}`} />
            <EmployeeExpenseMiniPill label="Approved" value={`${approved.length}`} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                <th className="px-5 py-3">Expense</th>
                <th className="w-[140px] px-5 py-3">Category</th>
                <th className="w-[150px] px-5 py-3">Payee</th>
                <th className="w-[130px] px-5 py-3 text-right">Amount</th>
                <th className="w-[130px] px-5 py-3">Status</th>
                <th className="w-[130px] px-5 py-3">Date</th>
                <th className="w-[120px] px-5 py-3">Receipt</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.055]">
              {expenses.slice(0, 12).map((expense) => (
                <EmployeeExpenseRow
                  key={expense.id}
                  expense={expense}
                  currency={summary.currency}
                />
              ))}
            </tbody>
          </table>

          {!expenses.length ? (
            <div className="p-5">
              <EmptyState text="No expenses submitted yet." />
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              Review timeline
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
              Expense activity
            </h3>
          </div>
          <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-xs text-[var(--primary)]">
            {expenses.length} records
          </span>
        </div>

        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
          {expenses.slice(0, 6).map((expense) => (
            <EmployeeExpenseActivityCard
              key={expense.id}
              expense={expense}
              currency={summary.currency}
            />
          ))}

          {!expenses.length ? <EmptyState text="Expense updates will appear here after submission." /> : null}
        </div>
      </section>
    </section>
  );
}

function EmployeeExpenseFormPanel({ currency }: { currency: string }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Travel");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [payee, setPayee] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const numericAmount = numberValue(amount);
  const canSubmit = title.trim().length > 0 && numericAmount > 0 && !isPending;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    startTransition(() => {
      void (async () => {
        const result = await submitEmployeePortalExpense({
          title,
          category,
          amount: numericAmount,
          expenseDate: expenseDate || undefined,
          payee,
          notes,
        });

        if (!result.ok) {
          setMessage({ type: "error", text: result.error });
          return;
        }

        setTitle("");
        setAmount("");
        setPayee("");
        setNotes("");
        setMessage({ type: "success", text: "Expense submitted for admin review." });
      })();
    });
  }

  return (
    <section className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            New expense
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
            Expense entry
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-tertiary)]">
            Saved as an employee-submitted claim for admin/founder review.
          </p>
        </div>
        <ReceiptText className="h-7 w-7 text-[var(--primary)]" />
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <label className="block">
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
            Expense title
          </span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Fuel, packaging, delivery, supplier purchase..."
            className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary-border)]"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
              Category
            </span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--primary-border)]"
            >
              <option>Travel</option>
              <option>Fuel</option>
              <option>Inventory</option>
              <option>Packaging</option>
              <option>Delivery</option>
              <option>Meals</option>
              <option>Office</option>
              <option>Software</option>
              <option>Other</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
              Amount
            </span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary-border)]"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
              Expense date
            </span>
            <input
              type="date"
              value={expenseDate}
              onChange={(event) => setExpenseDate(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary-border)]"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
              Payee / supplier
            </span>
            <input
              value={payee}
              onChange={(event) => setPayee(event.target.value)}
              placeholder="Supplier, shop, courier or vendor..."
              className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary-border)]"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
            Employee note
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            placeholder="Explain what this expense was for, receipt reference, customer/order link, or admin instructions..."
            className="mt-2 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary-border)]"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <ExpensePreviewBox label="Amount" value={money(numericAmount, currency)} />
          <ExpensePreviewBox label="Category" value={category} />
          <ExpensePreviewBox label="Date" value={expenseDate || "Today"} />
        </div>

        {message ? (
          <div
            className={[
              "rounded-xl border px-4 py-3 text-sm",
              message.type === "success"
                ? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]"
                : "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]",
            ].join(" ")}
          >
            {message.text}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="h-12 w-full rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isPending ? "Submitting..." : "Submit Expense"}
        </button>
      </form>
    </section>
  );
}

function EmployeeExpensesAnalyticsPanel({
  expenses,
  currency,
}: {
  expenses: EmployeePortalExpense[];
  currency: string;
}) {
  const trend = buildEmployeeExpenseTrend(expenses);
  const statusMix = buildEmployeeExpenseStatusMix(expenses);
  const categoryMix = buildEmployeeExpenseCategoryMix(expenses);
  const totalValue = expenses.reduce((sum, expense) => sum + numberValue(expense.amount), 0);

  return (
    <section className="space-y-5">
      <div className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              Expense trend
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
              Claim value line graph
            </h3>
            <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
              Dynamic graph based on this employee's submitted expenses.
            </p>
          </div>
          <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-xs text-[var(--primary)]">
            {money(totalValue, currency)}
          </span>
        </div>

        <div className="p-5">
          <EmployeeExpenseLineGraph data={trend} currency={currency} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <EmployeeExpensePieCard
          eyebrow="Status mix"
          title="Expense status"
          data={statusMix}
          total={expenses.length}
          empty="No expense status data yet."
        />
        <EmployeeExpensePieCard
          eyebrow="Category mix"
          title="Expense categories"
          data={categoryMix}
          total={categoryMix.reduce((sum, item) => sum + item.value, 0)}
          empty="No category data yet."
        />
      </div>
    </section>
  );
}

function buildEmployeeExpenseTrend(expenses: EmployeePortalExpense[]) {
  const buckets = new Map<string, { label: string; value: number }>();

  for (const expense of expenses) {
    const rawDate = expense.submittedAt || "";
    const date = new Date(rawDate);
    const key = Number.isNaN(date.getTime()) ? "Unknown" : date.toISOString().slice(0, 10);
    const label = Number.isNaN(date.getTime())
      ? "Unknown"
      : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

    const current = buckets.get(key) || { label, value: 0 };
    current.value += numberValue(expense.amount);
    buckets.set(key, current);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value)
    .slice(-8);
}

function buildEmployeeExpenseStatusMix(expenses: EmployeePortalExpense[]) {
  const buckets = new Map<string, number>();

  for (const expense of expenses) {
    const label = statusLabel(expense.status);
    buckets.set(label, (buckets.get(label) || 0) + 1);
  }

  return Array.from(buckets.entries()).map(([label, value]) => ({ label, value }));
}

function buildEmployeeExpenseCategoryMix(expenses: EmployeePortalExpense[]) {
  const buckets = new Map<string, number>();

  for (const expense of expenses) {
    const label = expense.category || "Other";
    buckets.set(label, (buckets.get(label) || 0) + numberValue(expense.amount));
  }

  return Array.from(buckets.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

function EmployeeExpenseLineGraph({
  data,
  currency,
}: {
  data: { label: string; value: number }[];
  currency: string;
}) {
  const width = 720;
  const height = 220;
  const paddingX = 34;
  const paddingY = 26;
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const points = data.length
    ? data
        .map((item, index) => {
          const x = paddingX + (data.length === 1 ? chartWidth / 2 : (index / (data.length - 1)) * chartWidth);
          const y = paddingY + chartHeight - (item.value / maxValue) * chartHeight;

          return `${x},${y}`;
        })
        .join(" ")
    : "";

  return (
    <div className="rounded-[1.15rem] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
      {data.length ? (
        <>
          <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full overflow-visible">
            <defs>
              <linearGradient id="employee-expense-line-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="color-mix(in srgb, var(--chart-1) 20%, transparent)" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>

            {[0, 1, 2, 3].map((line) => {
              const y = paddingY + (line / 3) * chartHeight;

              return (
                <line
                  key={line}
                  x1={paddingX}
                  x2={width - paddingX}
                  y1={y}
                  y2={y}
                  stroke="var(--chart-grid)"
                  strokeWidth="1"
                />
              );
            })}

            {points ? (
              <polyline
                points={`${paddingX},${height - paddingY} ${points} ${width - paddingX},${height - paddingY}`}
                fill="url(#employee-expense-line-fill)"
                stroke="none"
              />
            ) : null}

            <polyline
              points={points}
              fill="none"
              stroke="var(--chart-1)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {data.map((item, index) => {
              const x = paddingX + (data.length === 1 ? chartWidth / 2 : (index / (data.length - 1)) * chartWidth);
              const y = paddingY + chartHeight - (item.value / maxValue) * chartHeight;

              return (
                <g key={`${item.label}-${index}`}>
                  <circle cx={x} cy={y} r="5" fill="var(--chart-1)" />
                  <text x={x} y={height - 6} textAnchor="middle" className="fill-white/30 text-[10px]">
                    {item.label}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-tertiary)]">
            <span>Recent claims</span>
            <span>Peak {money(maxValue, currency)}</span>
          </div>
        </>
      ) : (
        <EmptyState text="No expense data available for the line graph yet." />
      )}
    </div>
  );
}

function EmployeeExpensePieCard({
  eyebrow,
  title,
  data,
  total,
  empty,
}: {
  eyebrow: string;
  title: string;
  data: { label: string; value: number }[];
  total: number;
  empty: string;
}) {
  const palette = [
    "var(--chart-1)",
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-5)",
    "var(--chart-2)",
  ];

  let cursor = 0;
  const gradientParts = data.map((item, index) => {
    const start = cursor;
    const share = total > 0 ? (item.value / total) * 100 : 0;
    cursor += share;

    return `${palette[index % palette.length]} ${start}% ${cursor}%`;
  });

  const gradient = gradientParts.length
    ? `conic-gradient(${gradientParts.join(", ")})`
    : "conic-gradient(var(--progress-track) 0% 100%)";

  return (
    <div className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-5 shadow-[var(--shadow-card)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
        {eyebrow}
      </p>
      <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
        {title}
      </h3>

      {data.length ? (
        <div className="mt-5 grid grid-cols-[132px_minmax(0,1fr)] items-center gap-5">
          <div className="relative h-[132px] w-[132px] rounded-full border border-[var(--border)]" style={{ background: gradient }}>
            <div className="absolute inset-[24px] grid place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)]">
              <div className="text-center">
                <p className="text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                  {total}
                </p>
                <p className="text-[9px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                  total
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {data.map((item, index) => {
              const share = total > 0 ? Math.round((item.value / total) * 100) : 0;

              return (
                <div key={`${item.label}-${index}`} className="flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="truncate text-[var(--text-secondary)]">{item.label}</p>
                    <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">{share}% share</p>
                  </div>
                  <span className="shrink-0 font-semibold text-[var(--primary)]">{item.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState text={empty} />
        </div>
      )}
    </div>
  );
}

function EmployeeExpenseRow({
  expense,
  currency,
}: {
  expense: EmployeePortalExpense;
  currency: string;
}) {
  const payee = employeeExpensePayee(expense);
  const notes = employeeExpenseNotes(expense);
  const receiptUrl = employeeExpenseReceiptUrl(expense);
  const status = statusLabel(expense.status);
  const statusClass = expenseStatusClass(expense.status);

  return (
    <tr className="text-sm transition hover:bg-[var(--surface-subtle)]">
      <td className="px-5 py-3.5">
        <div className="min-w-0">
          <p className="truncate font-medium text-[var(--text-primary)]">{expense.title}</p>
          <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
            {notes || (receiptUrl ? "Receipt attached" : "No employee note")}
          </p>
        </div>
      </td>
      <td className="px-5 py-3.5 text-[var(--text-secondary)]">{expense.category || "-"}</td>
      <td className="px-5 py-3.5 text-[var(--text-secondary)]">{payee || "-"}</td>
      <td className="px-5 py-3.5 text-right font-medium text-[var(--primary)]">
        {money(expense.amount, currency)}
      </td>
      <td className="px-5 py-3.5">
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusClass}`}>
          {status}
        </span>
      </td>
      <td className="px-5 py-3.5 text-[var(--text-tertiary)]">{dateLabel(expense.submittedAt)}</td>
      <td className="px-5 py-3.5">
        {receiptUrl ? (
          <a
            href={receiptUrl}
            className="inline-flex rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-2.5 py-1 text-[10px] font-medium text-[var(--primary)]"
          >
            View
          </a>
        ) : (
          <span className="text-[var(--text-muted)]">None</span>
        )}
      </td>
    </tr>
  );
}

function EmployeeExpenseActivityCard({
  expense,
  currency,
}: {
  expense: EmployeePortalExpense;
  currency: string;
}) {
  const notes = employeeExpenseNotes(expense);
  const payee = employeeExpensePayee(expense);
  const receiptUrl = employeeExpenseReceiptUrl(expense);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{expense.title}</p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            {expense.category || "General"} / {dateLabel(expense.submittedAt)}
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-[var(--primary)]">
          {money(expense.amount, currency)}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <ExpenseTinyBox label="Status" value={statusLabel(expense.status)} />
        <ExpenseTinyBox label="Payee" value={payee || "-"} />
      </div>

      <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Employee note
        </p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-tertiary)]">
          {notes || "No note"}
        </p>
      </div>

      {receiptUrl ? (
        <a
          href={receiptUrl}
          className="mt-3 inline-flex rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-[10px] font-medium text-[var(--primary)]"
        >
          View receipt
        </a>
      ) : null}
    </div>
  );
}

function EmployeeExpenseHeroMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
        {label}
      </p>
      <p className="mt-2 truncate text-lg font-semibold tracking-[-0.035em] text-[var(--text-primary)]">
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-[var(--primary)]">{helper}</p>
    </div>
  );
}

function EmployeeExpenseFocusCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: "cyan" | "green" | "red" | "indigo";
}) {
  const valueClass = {
    cyan: "text-[var(--primary)]",
    green: "text-[var(--success)]",
    red: "text-[var(--danger)]",
    indigo: "text-indigo-100/78",
  }[tone];

  return (
    <div className="rounded-[1.25rem] border border-[var(--primary-border)] bg-[image:var(--gradient-panel)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
        {label}
      </p>
      <p className={`mt-4 text-2xl font-semibold tracking-[-0.055em] ${valueClass}`}>
        {value}
      </p>
      <p className="mt-3 text-xs leading-5 text-[var(--text-tertiary)]">{helper}</p>
    </div>
  );
}

function EmployeeExpenseMiniPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--primary-border)] bg-[var(--surface-soft)] px-3 py-2 text-center">
      <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-[var(--primary)]">{value}</p>
    </div>
  );
}

function ExpensePreviewBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function ExpenseTinyBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-[var(--text-secondary)]">{value}</p>
    </div>
  );
}

function expenseStatusGroup(value: string): "pending" | "approved" | "rejected" {
  const status = String(value || "").toLowerCase();

  if (["approved", "paid", "completed"].includes(status)) return "approved";
  if (["rejected", "cancelled", "declined"].includes(status)) return "rejected";

  return "pending";
}

function expenseStatusClass(value: string): string {
  const group = expenseStatusGroup(value);

  if (group === "approved") {
    return "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]";
  }

  if (group === "rejected") {
    return "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]";
  }

  return "border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]";
}

















function EmployeeTaskMiniCard({ task }: { task: EmployeePortalTask }) {
  const status = normalizeEmployeeTaskStatus(String(task.status || ""));
  const priority = employeeTaskPriority(task);
  const dueDate = employeeTaskDueDate(task);
  const overdue = employeeTaskIsOverdue(task);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{task.title}</p>
          <p className="mt-1 line-clamp-1 text-xs text-[var(--text-tertiary)]">
            {employeeTaskDescription(task)}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] ${taskStatusClass(status, overdue)}`}>
          {overdue ? "Overdue" : employeeTaskStatusLabel(status)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-tertiary)]">
        <span className={`rounded-full border px-2.5 py-1 text-[10px] ${taskPriorityClass(priority)}`}>
          {priority}
        </span>
        <span>{dueDate ? `Due ${dateLabel(dueDate)}` : "No due date"}</span>
      </div>
    </div>
  );
}

function CompactTaskStat({
  label,
  value,
  helper,
  tone = "white",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "white" | "cyan" | "green" | "red";
}) {
  const toneClass = {
    white: "text-[var(--text-primary)]",
    cyan: "text-[var(--primary)]",
    green: "text-[var(--success)]",
    red: "text-[var(--danger)]",
  }[tone];

  return (
    <div className="rounded-xl border border-[var(--primary-border)] bg-[var(--surface-soft)] px-4 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-[var(--text-muted)]">
        {label}
      </p>
      <p className={`mt-2 text-lg font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-[11px] text-[var(--primary)]">{helper}</p>
    </div>
  );
}

function TaskFilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-10 rounded-xl border px-3 text-xs font-medium transition",
        active
          ? "border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]"
          : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}



function TaskProgressBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function taskStatusClass(status: string, overdue = false): string {
  if (overdue) {
    return "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]";
  }

  if (status === "completed") {
    return "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]";
  }

  if (status === "in_progress") {
    return "border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]";
  }

  return "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]";
}

function taskPriorityClass(priority: string): string {
  const value = String(priority || "").toLowerCase();

  if (["urgent", "high"].includes(value)) {
    return "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]";
  }

  if (["medium", "normal"].includes(value)) {
    return "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]";
  }

  return "border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]";
}







































function employeeTaskDueDate(task: EmployeePortalTask): string | null {
  const raw =
    String((task as { dueDate?: string | null }).dueDate || "").trim() ||
    String((task as { due_date?: string | null }).due_date || "").trim() ||
    String((task as { deadline?: string | null }).deadline || "").trim() ||
    String((task as { due_at?: string | null }).due_at || "").trim() ||
    String((task as { target_date?: string | null }).target_date || "").trim() ||
    String((task as { date?: string | null }).date || "").trim();

  return raw || null;
}

function employeeTaskCreatedDate(task: EmployeePortalTask): string | null {
  const raw =
    String((task as { createdAt?: string | null }).createdAt || "").trim() ||
    String((task as { created_at?: string | null }).created_at || "").trim();

  return raw || null;
}

function employeeTaskPriority(task: EmployeePortalTask): string {
  return (
    String((task as { priority?: string | null }).priority || "").trim() ||
    String((task as { level?: string | null }).level || "").trim() ||
    "Normal"
  );
}

function employeeTaskDescription(task: EmployeePortalTask): string {
  return (
    String((task as { description?: string | null }).description || "").trim() ||
    String((task as { notes?: string | null }).notes || "").trim() ||
    String((task as { details?: string | null }).details || "").trim() ||
    "No task notes"
  );
}

function normalizeEmployeeTaskStatus(status: string): "todo" | "in_progress" | "completed" {
  const value = String(status || "").toLowerCase().replace(/[_-]+/g, " ").trim();

  if (["done", "complete", "completed", "closed", "finished", "resolved"].includes(value)) return "completed";
  if (["in progress", "progress", "active", "started", "working", "doing"].includes(value)) return "in_progress";

  return "todo";
}

function employeeTaskIsOverdue(task: EmployeePortalTask): boolean {
  const status = normalizeEmployeeTaskStatus(String(task.status || ""));
  const dueDate = employeeTaskDueDate(task);

  if (!dueDate || status === "completed") return false;

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return due < today;
}

function employeeTaskStatusLabel(status: string): string {
  const normalized = normalizeEmployeeTaskStatus(status);

  if (normalized === "completed") return "Completed";
  if (normalized === "in_progress") return "In progress";

  return "To do";
}

function employeeTaskStatusClass(status: "todo" | "in_progress" | "completed", overdue = false): string {
  if (overdue) return "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]";
  if (status === "completed") return "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]";
  if (status === "in_progress") return "border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]";

  return "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]";
}

function employeeTaskPriorityClass(priority: string): string {
  const value = priority.toLowerCase();

  if (["urgent", "critical", "high"].includes(value)) return "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]";
  if (["medium", "normal"].includes(value)) return "border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]";

  return "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]";
}

export function EmployeeTasksView({ model }: { model: EmployeePortalReadModel }) {
  const tasks = model.tasks;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "todo" | "in_progress" | "completed" | "overdue">("all");

  const todo = tasks.filter((task) => normalizeEmployeeTaskStatus(String(task.status || "")) === "todo");
  const inProgress = tasks.filter((task) => normalizeEmployeeTaskStatus(String(task.status || "")) === "in_progress");
  const completed = tasks.filter((task) => normalizeEmployeeTaskStatus(String(task.status || "")) === "completed");
  const overdue = tasks.filter(employeeTaskIsOverdue);
  const openTasks = todo.length + inProgress.length;
  const completionRate = tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0;

  const visibleTasks = useMemo(() => {
    const term = query.trim().toLowerCase();

    return tasks.filter((task) => {
      const status = normalizeEmployeeTaskStatus(String(task.status || ""));
      const isOverdue = employeeTaskIsOverdue(task);

      const matchesFilter =
        filter === "all" ||
        filter === status ||
        (filter === "overdue" && isOverdue);

      const haystack = [
        task.title,
        employeeTaskDescription(task),
        employeeTaskPriority(task),
        employeeTaskDueDate(task) || "",
        employeeTaskStatusLabel(String(task.status || "")),
      ]
        .join(" ")
        .toLowerCase();

      return matchesFilter && (!term || haystack.includes(term));
    });
  }, [tasks, query, filter]);

  const nextFocus =
    tasks.find((task) => normalizeEmployeeTaskStatus(String(task.status || "")) !== "completed") ||
    tasks[0] ||
    null;

  const statusData = [
    { label: "To do", value: todo.length },
    { label: "In progress", value: inProgress.length },
    { label: "Completed", value: completed.length },
  ].filter((item) => item.value > 0);

  const sortedDueTasks = [...tasks].sort((a, b) => {
    const aDate = employeeTaskDueDate(a);
    const bDate = employeeTaskDueDate(b);

    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;

    return new Date(aDate).getTime() - new Date(bDate).getTime();
  });

  return (
    <section className="space-y-5">
      <section className="relative overflow-hidden rounded-[1.6rem] border border-[var(--primary-border)] bg-[image:var(--gradient-hero)] p-5 shadow-[var(--shadow-lg)]">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent" />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(430px,0.92fr)] xl:items-stretch">
          <div className="flex min-h-[245px] flex-col justify-between rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-soft)] p-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                  Employee tasks
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                  Assigned only
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                  Admin synced
                </span>
              </div>

              <h2 className="mt-7 max-w-4xl text-5xl font-semibold tracking-[-0.07em] text-[var(--text-primary)]">
                Task command center.
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-tertiary)]">
                Update your assigned task progress here. Every status change stays connected to the
                admin/founder task view through the same task record.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-4">
              <EmployeeTaskHeroMetric label="Assigned" value={`${tasks.length}`} helper="Total tasks" />
              <EmployeeTaskHeroMetric label="Open" value={`${openTasks}`} helper="Remaining work" />
              <EmployeeTaskHeroMetric label="Late" value={`${overdue.length}`} helper="Past due" />
              <EmployeeTaskHeroMetric label="Done" value={`${completed.length}`} helper={`${completionRate}% complete`} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[170px_minmax(0,1fr)]">
            <div className="grid place-items-center rounded-[1.25rem] border border-[var(--primary-border)] bg-[image:var(--gradient-panel)] p-5">
              <div
                className="grid aspect-square w-[142px] place-items-center rounded-full border border-[var(--primary-border)]"
                style={{
                  background: `conic-gradient(var(--chart-1) ${completionRate}%, var(--progress-track) 0)`,
                }}
              >
                <div className="grid h-[104px] w-[104px] place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)]">
                  <div className="text-center">
                    <p className="text-3xl font-semibold tracking-[-0.06em] text-[var(--text-primary)]">
                      {completionRate}%
                    </p>
                    <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                      done
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-[var(--primary-border)] bg-[image:var(--gradient-panel)] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                    Current focus
                  </p>
                  <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                    {nextFocus ? nextFocus.title : "No assigned task"}
                  </h3>
                </div>
                <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-xs text-[var(--primary)]">
                  Live
                </span>
              </div>

              <p className="mt-4 line-clamp-3 text-xs leading-5 text-[var(--text-tertiary)]">
                {nextFocus ? employeeTaskDescription(nextFocus) : "Assigned tasks will appear here."}
              </p>

              <div className="mt-5 grid gap-2">
                <EmployeeTaskStackMetric label="Status" value={nextFocus ? employeeTaskStatusLabel(String(nextFocus.status || "")) : "—"} />
                <EmployeeTaskStackMetric label="Due" value={nextFocus && employeeTaskDueDate(nextFocus) ? dateLabel(employeeTaskDueDate(nextFocus)) : "No due date"} />
                <EmployeeTaskStackMetric label="Priority" value={nextFocus ? employeeTaskPriority(nextFocus) : "—"} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.92fr)]">
        <div className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                Work pipeline
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                Assigned task flow
              </h3>
              <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
                Compact board view from real assigned task rows.
              </p>
            </div>
            <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-xs text-[var(--primary)]">
              {tasks.length} tasks
            </span>
          </div>

          <div className="grid gap-3 p-5 lg:grid-cols-3">
            <EmployeeTaskLane title="To do" tasks={todo} />
            <EmployeeTaskLane title="In progress" tasks={inProgress} />
            <EmployeeTaskLane title="Completed" tasks={completed} />
          </div>
        </div>

        <EmployeeTaskPieCard
          eyebrow="Status mix"
          title="Task status"
          data={statusData}
          total={tasks.length}
          empty="No task status data yet."
        />
      </section>

      <section className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              Task register
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
              My assigned work
            </h3>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">
              Use the buttons on each row. The update writes to the same task used by admin/founder.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 xl:w-auto">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search task, priority, due date or notes..."
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary-border)] xl:w-[460px]"
            />

            <div className="grid grid-cols-5 gap-2">
              <EmployeeTaskFilterPill active={filter === "all"} onClick={() => setFilter("all")} label="All" value={`${tasks.length}`} />
              <EmployeeTaskFilterPill active={filter === "todo"} onClick={() => setFilter("todo")} label="To do" value={`${todo.length}`} />
              <EmployeeTaskFilterPill active={filter === "in_progress"} onClick={() => setFilter("in_progress")} label="Active" value={`${inProgress.length}`} />
              <EmployeeTaskFilterPill active={filter === "completed"} onClick={() => setFilter("completed")} label="Done" value={`${completed.length}`} />
              <EmployeeTaskFilterPill active={filter === "overdue"} onClick={() => setFilter("overdue")} label="Late" value={`${overdue.length}`} />
            </div>
          </div>
        </div>

        <div className="divide-y divide-white/[0.055]">
          {visibleTasks.map((task) => (
            <EmployeeTaskRegisterRow key={task.id} task={task} />
          ))}

          {!visibleTasks.length ? (
            <div className="p-5">
              <EmptyState text="No assigned tasks matched this view." />
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              Due timeline
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
              Upcoming task dates
            </h3>
          </div>
          <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-xs text-[var(--primary)]">
            {sortedDueTasks.length} rows
          </span>
        </div>

        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
          {sortedDueTasks.map((task) => (
            <EmployeeTaskTimelineCard key={task.id} task={task} />
          ))}

          {!sortedDueTasks.length ? <EmptyState text="No task due dates yet." /> : null}
        </div>
      </section>
    </section>
  );
}

function EmployeeTaskLane({ title, tasks }: { title: string; tasks: EmployeePortalTask[] }) {
  return (
    <div className="rounded-[1.15rem] border border-[var(--border)] bg-[var(--surface-soft)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          {title}
        </p>
        <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-2.5 py-1 text-[10px] text-[var(--primary)]">
          {tasks.length}
        </span>
      </div>

      <div className="space-y-2 p-3">
        {tasks.slice(0, 4).map((task) => (
          <div key={task.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{task.title}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-tertiary)]">
              {employeeTaskDescription(task)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[10px] ${employeeTaskPriorityClass(employeeTaskPriority(task))}`}>
                {employeeTaskPriority(task)}
              </span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1 text-[10px] text-[var(--text-tertiary)]">
                {employeeTaskDueDate(task) ? dateLabel(employeeTaskDueDate(task)) : "No due date"}
              </span>
            </div>
          </div>
        ))}

        {!tasks.length ? (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-6 text-center text-xs text-[var(--text-muted)]">
            No tasks here.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function EmployeeTaskPieCard({
  eyebrow,
  title,
  data,
  total,
  empty,
}: {
  eyebrow: string;
  title: string;
  data: { label: string; value: number }[];
  total: number;
  empty: string;
}) {
  const palette = [
    "var(--chart-1)",
    "var(--chart-1)",
    "var(--chart-2)",
  ];

  let cursor = 0;
  const gradientParts = data.map((item, index) => {
    const start = cursor;
    const share = total > 0 ? (item.value / total) * 100 : 0;
    cursor += share;

    return `${palette[index % palette.length]} ${start}% ${cursor}%`;
  });

  const gradient = gradientParts.length
    ? `conic-gradient(${gradientParts.join(", ")})`
    : "conic-gradient(var(--progress-track) 0% 100%)";

  return (
    <div className="rounded-[1.45rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-5 shadow-[var(--shadow-card)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
        {eyebrow}
      </p>
      <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
        {title}
      </h3>
      <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
        Dynamic breakdown from assigned task rows.
      </p>

      {data.length ? (
        <div className="mt-5 grid grid-cols-[136px_minmax(0,1fr)] items-center gap-5">
          <div className="relative h-[136px] w-[136px] rounded-full border border-[var(--border)]" style={{ background: gradient }}>
            <div className="absolute inset-[24px] grid place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)]">
              <div className="text-center">
                <p className="text-2xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">{total}</p>
                <p className="text-[9px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">tasks</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {data.map((item, index) => {
              const share = total > 0 ? Math.round((item.value / total) * 100) : 0;

              return (
                <div key={`${item.label}-${index}`} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text-secondary)]">{item.label}</p>
                    <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">{share}% of tasks</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1 text-xs text-[var(--primary)]">
                    {item.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState text={empty} />
        </div>
      )}
    </div>
  );
}

function EmployeeTaskRegisterRow({ task }: { task: EmployeePortalTask }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const status = normalizeEmployeeTaskStatus(String(task.status || ""));
  const overdue = employeeTaskIsOverdue(task);
  const dueDate = employeeTaskDueDate(task);
  const createdDate = employeeTaskCreatedDate(task);

  function updateStatus(nextStatus: "todo" | "in_progress" | "completed") {
    startTransition(() => {
      void (async () => {
        const result = await updateEmployeePortalTaskStatus({
          taskId: task.id,
          status: nextStatus,
        });

        if (result.ok) {
          router.refresh();
        }
      })();
    });
  }

  return (
    <div className="grid gap-4 px-5 py-4 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="truncate text-sm font-semibold text-[var(--text-primary)]">{task.title}</h4>
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium ${employeeTaskStatusClass(status, overdue)}`}>
            {overdue ? "Overdue" : employeeTaskStatusLabel(status)}
          </span>
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium ${employeeTaskPriorityClass(employeeTaskPriority(task))}`}>
            {employeeTaskPriority(task)}
          </span>
        </div>

        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-tertiary)]">
          {employeeTaskDescription(task)}
        </p>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--text-tertiary)]">
          <span>Due {dueDate ? dateLabel(dueDate) : "not set"}</span>
          <span>/</span>
          <span>Created {createdDate ? dateLabel(createdDate) : "unknown"}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <TaskActionButton active={status === "todo"} disabled={isPending} onClick={() => updateStatus("todo")}>
          To do
        </TaskActionButton>
        <TaskActionButton active={status === "in_progress"} disabled={isPending} onClick={() => updateStatus("in_progress")}>
          Active
        </TaskActionButton>
        <TaskActionButton active={status === "completed"} disabled={isPending} onClick={() => updateStatus("completed")}>
          Done
        </TaskActionButton>
      </div>
    </div>
  );
}

function EmployeeTaskTimelineCard({ task }: { task: EmployeePortalTask }) {
  const status = normalizeEmployeeTaskStatus(String(task.status || ""));
  const dueDate = employeeTaskDueDate(task);
  const overdue = employeeTaskIsOverdue(task);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{task.title}</p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            {dueDate ? dateLabel(dueDate) : "No due date"}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${employeeTaskStatusClass(status, overdue)}`}>
          {overdue ? "Overdue" : employeeTaskStatusLabel(status)}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-xs leading-5 text-[var(--text-tertiary)]">
        {employeeTaskDescription(task)}
      </p>
    </div>
  );
}

function EmployeeTaskHeroMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
        {label}
      </p>
      <p className="mt-2 truncate text-lg font-semibold tracking-[-0.035em] text-[var(--text-primary)]">
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-[var(--primary)]">{helper}</p>
    </div>
  );
}

function EmployeeTaskStackMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-semibold text-[var(--text-secondary)]">{value}</p>
    </div>
  );
}

function EmployeeTaskFilterPill({
  active,
  onClick,
  label,
  value,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  value: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl border px-3 py-2 text-center transition",
        active
          ? "border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]"
          : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-tertiary)] hover:border-[var(--primary-border)] hover:text-[var(--primary)]",
      ].join(" ")}
    >
      <p className="text-[8px] font-semibold uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </button>
  );
}

function TaskActionButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || active}
      className={[
        "h-10 rounded-xl border px-3 text-[11px] font-semibold transition",
        active
          ? "border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]"
          : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-tertiary)] hover:border-[var(--primary-border)] hover:text-[var(--primary)]",
        disabled ? "cursor-wait opacity-55" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function EmployeeProfileView({ model }: { model: EmployeePortalReadModel }) {
  const readModel = model as unknown as Record<string, unknown>;

  function asObject(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  function textValue(...values: unknown[]): string {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
    }
    return "";
  }

  function numberValue(...values: unknown[]): number {
    for (const value of values) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  }

  function dateValue(...values: unknown[]): string {
    const raw = textValue(...values);
    if (!raw) return "—";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  const profile = asObject(readModel.profile);
  const employee = asObject(readModel.employee);
  const employeeProfile = asObject(readModel.employeeProfile);
  const account = asObject(readModel.account);
  const viewer = asObject(readModel.viewer);
  const user = asObject(readModel.user);
  const summary = asObject(readModel.summary);
  const userMetadata = asObject(user.user_metadata);

  const tasks = Array.isArray(readModel.tasks) ? (readModel.tasks as Record<string, unknown>[]) : [];
  const sales = Array.isArray(readModel.sales) ? (readModel.sales as Record<string, unknown>[]) : [];
  const expenses = Array.isArray(readModel.expenses) ? (readModel.expenses as Record<string, unknown>[]) : [];
  const inventory = Array.isArray(readModel.inventory) ? (readModel.inventory as Record<string, unknown>[]) : [];
  const notifications = Array.isArray(readModel.notifications) ? (readModel.notifications as Record<string, unknown>[]) : [];

  const currency = textValue(summary.currency, profile.currency, employee.currency) || "GBP";
  const formatMoney = (value: unknown) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(numberValue(value));

  const fullName =
    textValue(
      summary.employeeName,
      summary.employee_name,
      profile.fullName,
      profile.full_name,
      profile.name,
      profile.displayName,
      profile.display_name,
      employee.fullName,
      employee.full_name,
      employee.name,
      employee.displayName,
      employee.display_name,
      employeeProfile.fullName,
      employeeProfile.full_name,
      employeeProfile.name,
      viewer.fullName,
      viewer.full_name,
      viewer.name,
      account.fullName,
      account.full_name,
      account.name,
      userMetadata.full_name,
      userMetadata.name,
      user.email,
    ) || "Employee";

  const email =
    textValue(
      summary.employeeEmail,
      summary.employee_email,
      summary.email,
      profile.email,
      profile.user_email,
      employee.email,
      employee.user_email,
      employeeProfile.email,
      account.email,
      viewer.email,
      user.email,
      readModel.email,
    ) || "—";

  const employeeId =
    textValue(
      summary.employeeId,
      summary.employee_id,
      profile.employeeId,
      profile.employee_id,
      profile.staffId,
      profile.staff_id,
      employee.employeeId,
      employee.employee_id,
      employee.staffId,
      employee.staff_id,
      employeeProfile.employeeId,
      employeeProfile.employee_id,
      account.employeeId,
      account.employee_id,
      viewer.employeeId,
      viewer.employee_id,
      readModel.employeeId,
      readModel.employee_id,
      profile.id,
      employee.id,
      user.id,
    ) || "—";

  const role = textValue(profile.role, employee.role, employeeProfile.role, account.role, viewer.role, summary.role) || "employee";
  const company = textValue(summary.companyName, summary.company_name, profile.companyName, profile.company_name, profile.company, employee.companyName, employee.company_name, employee.company) || "Workspace";
  const status = textValue(summary.employeeStatus, summary.employee_status, profile.status, profile.account_status, employee.status, employee.account_status, account.status) || "Active";
  const workspace = textValue(profile.workspace, profile.portalName, profile.portal_name, employee.workspace, employee.portalName, employee.portal_name, summary.workspace, summary.portalName, summary.portal_name) || `${company} Employee Portal`;
  const joinedAt = dateValue(profile.joinedAt, profile.joined_at, profile.createdAt, profile.created_at, employee.joinedAt, employee.joined_at, employee.createdAt, employee.created_at, user.created_at);
  const phone = textValue(profile.phone, profile.phone_number, employee.phone, employee.phone_number, employeeProfile.phone, account.phone, viewer.phone) || "—";
  const department = textValue(profile.department, employee.department, employeeProfile.department, account.department, summary.department) || "—";
  const jobTitle = textValue(profile.jobTitle, profile.job_title, employee.jobTitle, employee.job_title, employeeProfile.jobTitle, employeeProfile.job_title, account.jobTitle, account.job_title, summary.jobTitle, summary.job_title) || "—";
  const lastSignIn = dateValue(user.last_sign_in_at, user.lastSignInAt, profile.last_sign_in_at, account.last_sign_in_at);

  const openTasks = tasks.filter((task) => !["completed", "complete", "done", "closed", "finished"].includes(textValue(task.status).toLowerCase()));
  const completedTasks = tasks.length - openTasks.length;
  const pendingExpenses = expenses.filter((expense) => !["approved", "paid", "completed", "complete", "rejected", "declined"].includes(textValue(expense.status).toLowerCase()));
  const lowStock = inventory.filter((item) => {
    const stock = numberValue(item.stock, item.quantity_on_hand, item.onHand, item.on_hand);
    const threshold = numberValue(item.lowStockThreshold, item.low_stock_threshold, item.low_stock_limit, 2);
    return stock <= threshold;
  });

  const salesValue =
    numberValue(summary.recentSalesValue, summary.salesValue, summary.totalSalesValue) ||
    sales.reduce((total, sale) => total + numberValue(sale.totalAmount, sale.total_amount, sale.revenue, sale.amount, sale.sale_price), 0);

  const latestUpdates = notifications
    .filter((item) => {
      const haystack = `${textValue(item.type)} ${textValue(item.title)} ${textValue(item.message)} ${textValue(item.actionUrl, item.action_url)}`.toLowerCase();
      if (["investor", "capital", "equity", "share", "certificate", "agreement", "valuation"].some((blocked) => haystack.includes(blocked))) return false;
      return ["employee", "task", "expense", "sale", "inventory", "stock"].some((allowed) => haystack.includes(allowed));
    })
    .slice(0, 5);

  const initials = fullName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <section className="space-y-5">
      <section className="rounded-[1.35rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">Employee profile</span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{company}</span>
              <span className="rounded-full border border-[var(--success-border)] bg-[var(--success-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--success)]">{status}</span>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-xl font-semibold text-[var(--primary)] shadow-[var(--glow-brand)]">{initials || "E"}</div>
              <div className="min-w-0">
                <h2 className="truncate text-3xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">{fullName}</h2>
                <p className="mt-1 text-sm text-[var(--text-tertiary)]">{email}</p>
                <p className="mt-1 text-xs text-[var(--primary)]">Employee ID: {employeeId}</p>
              </div>
            </div>

            <p className="mt-5 max-w-3xl text-sm leading-6 text-[var(--text-tertiary)]">Employee-facing account page with identity, contact details, workspace access, security actions and employee-only activity.</p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 xl:max-w-[720px] xl:grid-cols-4">
            <EmployeeProfileMetric label="Role" value={role} helper="Limited access" />
            <EmployeeProfileMetric label="Open tasks" value={`${openTasks.length}`} helper="Assigned work" />
            <EmployeeProfileMetric label="My sales" value={`${sales.length}`} helper={formatMoney(salesValue)} />
            <EmployeeProfileMetric label="Alerts" value={`${lowStock.length}`} helper="Low stock" />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <section className="rounded-[1.35rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--primary)]">Employee details</p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">Account information</h3>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">Name, ID, email and workspace details visible to this employee.</p>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <EmployeeProfileDetail label="Employee name" value={fullName} />
            <EmployeeProfileDetail label="Employee email" value={email} />
            <EmployeeProfileDetail label="Employee ID" value={employeeId} />
            <EmployeeProfileDetail label="Role" value={role} />
            <EmployeeProfileDetail label="Company" value={company} />
            <EmployeeProfileDetail label="Workspace" value={workspace} />
            <EmployeeProfileDetail label="Department" value={department} />
            <EmployeeProfileDetail label="Job title" value={jobTitle} />
            <EmployeePhoneNumberCard initialPhone={phone === "—" ? "" : phone} />
            <EmployeeProfileDetail label="Joined" value={joinedAt} />
            <EmployeeProfileDetail label="Last sign in" value={lastSignIn} />
            <EmployeeProfileDetail label="Account status" value={status} />
          </div>
        </section>

        <section className="space-y-5">
          <section className="rounded-[1.35rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--primary)]">Security</p>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">Password reset</h3>
              <p className="mt-1 text-sm text-[var(--text-tertiary)]">Send a secure reset link to the employee email on this account.</p>
            </div>
            <div className="p-5"><EmployeePasswordResetCard email={email} /></div>
          </section>

          <section className="rounded-[1.35rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--primary)]">Portal options</p>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">Employee access</h3>
            </div>
            <div className="space-y-3 p-5">
              <EmployeeProfileOption title="Sales" description="Record product sales and add admin-visible sale notes." />
              <EmployeeProfileOption title="Inventory" description="View product stock, SKU, cost and sale availability." />
              <EmployeeProfileOption title="Expenses" description="Submit business expenses for admin/founder review." />
              <EmployeeProfileOption title="Tasks" description="View assigned work and update task progress." />
              <EmployeeProfileOption title="Notifications" description="Receive employee-only task, sale, expense and inventory updates." />
            </div>
          </section>
        </section>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <section className="rounded-[1.35rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--primary)]">Work summary</p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">Activity snapshot</h3>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <EmployeeProfileDetail label="Tasks done" value={`${completedTasks}`} />
            <EmployeeProfileDetail label="Open tasks" value={`${openTasks.length}`} />
            <EmployeeProfileDetail label="Sales recorded" value={`${sales.length}`} />
            <EmployeeProfileDetail label="Sales value" value={formatMoney(salesValue)} />
            <EmployeeProfileDetail label="Expense claims" value={`${expenses.length}`} />
            <EmployeeProfileDetail label="Pending claims" value={`${pendingExpenses.length}`} />
            <EmployeeProfileDetail label="Products visible" value={`${inventory.length}`} />
            <EmployeeProfileDetail label="Low-stock alerts" value={`${lowStock.length}`} />
          </div>
        </section>

        <section className="rounded-[1.35rem] border border-[var(--primary-border)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--primary)]">Employee timeline</p>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">Recent employee updates</h3>
            </div>
            <span className="rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-2 text-xs text-[var(--primary)]">{latestUpdates.length} latest</span>
          </div>
          <div className="divide-y divide-white/[0.055]">
            {latestUpdates.length ? (
              latestUpdates.map((update) => (
                <div key={textValue(update.id, update.createdAt, update.created_at)} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{textValue(update.title) || "Employee update"}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-tertiary)]">{textValue(update.message) || "No update details."}</p>
                    </div>
                    <span className="shrink-0 text-xs text-[var(--text-tertiary)]">{dateValue(update.createdAt, update.created_at)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-5"><EmptyState text="No employee updates yet." /></div>
            )}
          </div>
        </section>
      </section>
    <ProfileAppearanceCard portal="Employee" />
    </section>
  );
}

function EmployeeProfileMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-xl border border-[var(--primary-border)] bg-[var(--surface-soft)] px-4 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 truncate text-lg font-semibold capitalize text-[var(--text-primary)]">{value}</p>
      <p className="mt-1 truncate text-[11px] text-[var(--primary)]">{helper}</p>
    </div>
  );
}

function EmployeeProfileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
      <p className="text-[10px] font-medium text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-[var(--text-primary)]">{value || "—"}</p>
    </div>
  );
}

function EmployeeProfileOption({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">{description}</p>
      </div>
      <span className="shrink-0 rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-2.5 py-1 text-[10px] font-medium text-[var(--primary)]">Enabled</span>
    </div>
  );
}

function EmployeePasswordResetCard({ email }: { email: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isPending, startTransition] = useTransition();

  function sendReset() {
    setMessage(null);
    setIsError(false);

    startTransition(() => {
      void (async () => {
        const result = await sendEmployeePortalPasswordResetEmail();

        if (!result.ok) {
          setIsError(true);
          setMessage(result.error);
          return;
        }

        setIsError(false);
        setMessage(`Password reset email sent to ${result.data.email}.`);
      })();
    });
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
      <p className="text-sm font-semibold text-[var(--text-primary)]">Reset password</p>
      <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">The reset link will be sent to:</p>
      <p className="mt-2 break-words rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--primary)]">{email || "No email found"}</p>
      <button
        type="button"
        onClick={sendReset}
        disabled={isPending || !email || email === "—"}
        className="mt-4 h-11 rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-4 text-sm font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-45"
      >
        {isPending ? "Sending..." : "Send Password Reset Email"}
      </button>
      {message && (
        <p className={["mt-3 rounded-lg border px-3 py-2 text-xs", isError ? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]" : "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]"].join(" ")}>{message}</p>
      )}
    </div>
  );
}

function EmployeePhoneNumberCard({ initialPhone }: { initialPhone: string }) {
  const [phone, setPhone] = useState(initialPhone);
  const [savedPhone, setSavedPhone] = useState(initialPhone);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isPending, startTransition] = useTransition();

  function savePhone() {
    setMessage(null);
    setIsError(false);

    startTransition(() => {
      void (async () => {
        const result = await updateEmployeePortalPhoneNumber({ phone });

        if (!result.ok) {
          setIsError(true);
          setMessage(result.error);
          return;
        }

        setSavedPhone(result.data.phone);
        setIsError(false);
        setMessage(result.data.phone ? "Phone number saved." : "Phone number removed.");
      })();
    });
  }

  const hasChanged = phone.trim() !== savedPhone.trim();

  return (
    <div className="rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-4 py-3 sm:col-span-2">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium text-[var(--text-tertiary)]">Phone number</p>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            placeholder="Add phone number"
            className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--primary-border)]"
          />
          <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
            Saved to the employee profile and visible to admin/founder.
          </p>
        </div>

        <button
          type="button"
          onClick={savePhone}
          disabled={isPending || !hasChanged}
          className="h-11 shrink-0 rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-4 text-sm font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isPending ? "Saving..." : "Save Phone"}
        </button>
      </div>

      {message && (
        <p
          className={[
            "mt-3 rounded-lg border px-3 py-2 text-xs",
            isError
              ? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]"
              : "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]",
          ].join(" ")}
        >
          {message}
        </p>
      )}
    </div>
  );
}
