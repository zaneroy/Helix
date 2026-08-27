"use client";

import { useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import type { Notification } from "@/types/notifications";
import type {
  AdminEmployee,
  AdminEmployeeExpense,
  AdminEmployeeNote,
  AdminEmployeeSale,
  AdminExpensePaymentAccount,
  AdminTask,
} from "./page";
import WorkforceOverview, {
  type WorkforceOverviewMetrics,
} from "./components/WorkforceOverview";
import TopPerformers, {
  type TopPerformer,
} from "./components/TopPerformers";
import EmployeeGrid, {
  type EmployeeGridItem,
} from "./components/EmployeeGrid";
import EmployeeProfileDrawer, {
  type EmployeeProfileMetrics,
} from "./components/EmployeeProfileDrawer";
import WorkforceInsights, {
  type WorkforceInsightEmployee,
} from "./components/WorkforceInsights";
import TaskBoard from "./components/TaskBoard";
import AssignTaskForm from "./components/AssignTaskForm";

type ServerAction = (formData: FormData) => void | Promise<void>;

type ExpenseReviewAction = (
  formData: FormData
) => Promise<{
  ok: boolean;
  message: string;
}>;

type Props = {
  adminName: string;
  currency: string;
  employees: AdminEmployee[];
  tasks: AdminTask[];
  sales: AdminEmployeeSale[];
  expenses: AdminEmployeeExpense[];
  expenseAccounts: AdminExpensePaymentAccount[];
  employeeNotes: AdminEmployeeNote[];
  error?: string;
  success?: string;
  reviewEmployeeExpense: ExpenseReviewAction;
  createTask: ServerAction;
  updateTask: ServerAction;
  deleteTask: ServerAction;
  saveEmployeeNote: ServerAction;
  suspendEmployee: ServerAction;
  reactivateEmployee: ServerAction;
  removeEmployeeAccess: ServerAction;
  sendEmployeePasswordReset: ServerAction;
  notifications: Notification[];
  userId: string;
};

type EmployeeStat = {
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

export default function AdminTasksClient({
  adminName,
  currency,
  employees = [],
  tasks = [],
  sales = [],
  expenses = [],
  expenseAccounts = [],
  employeeNotes = [],
  error,
  success,
  reviewEmployeeExpense,
  createTask,
  updateTask,
  deleteTask,
  saveEmployeeNote,
  suspendEmployee,
  reactivateEmployee,
  removeEmployeeAccess,
  sendEmployeePasswordReset,
  notifications,
  userId,
}: Props) {
  const [selectedEmployeeId, setSelectedEmployeeId] =
    useState<string>("all");
  const [profileEmployeeId, setProfileEmployeeId] =
    useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const employeeStats = useMemo<EmployeeStat[]>(() => {
    const totalRevenueAcrossEmployees = sales.reduce(
      (sum, sale) => sum + Number(sale.total_amount || 0),
      0
    );

    const totalProfitAcrossEmployees = sales.reduce(
      (sum, sale) => sum + Number(sale.profit_amount || 0),
      0
    );

    return employees.map((employee) => {
      const employeeSales = sales.filter(
        (sale) => sale.created_by === employee.id
      );

      const employeeExpenses = expenses.filter(
        (expense) => expense.created_by === employee.id
      );

      const employeeTasks = tasks.filter(
        (task) => task.assigned_to === employee.id
      );

      const revenue = employeeSales.reduce(
        (sum, sale) => sum + Number(sale.total_amount || 0),
        0
      );

      const profit = employeeSales.reduce(
        (sum, sale) => sum + Number(sale.profit_amount || 0),
        0
      );

      const recognizedEmployeeExpenses = employeeExpenses.filter(
        (expense) =>
          String(expense.status || "").toLowerCase() === "approved"
      );

      const expensesTotal = recognizedEmployeeExpenses.reduce(
        (sum, expense) => sum + Number(expense.amount || 0),
        0
      );

      const completedTasks = employeeTasks.filter(
        (task) => task.status === "done"
      ).length;

      const overdueTasks = employeeTasks.filter(
        (task) =>
          Boolean(task.due_date) &&
          String(task.due_date) < today &&
          task.status !== "done"
      ).length;

      const completionRate =
        employeeTasks.length > 0
          ? (completedTasks / employeeTasks.length) * 100
          : 0;

      const revenueContribution =
        totalRevenueAcrossEmployees > 0
          ? (revenue / totalRevenueAcrossEmployees) * 100
          : 0;

      const profitContribution =
        totalProfitAcrossEmployees > 0
          ? Math.max(
              0,
              (profit / totalProfitAcrossEmployees) * 100
            )
          : 0;

      const overduePenalty =
        employeeTasks.length > 0
          ? Math.min(
              35,
              (overdueTasks / employeeTasks.length) * 100
            )
          : 0;

      const activityDates = [
        ...employeeSales
          .map((sale) => sale.sold_at)
          .filter((value): value is string => Boolean(value)),
        ...employeeTasks
          .map((task) => task.created_at)
          .filter((value): value is string => Boolean(value)),
        ...employeeExpenses
          .map((expense) => expense.expense_date)
          .filter((value): value is string => Boolean(value)),
      ].sort();

      const lastActivity =
        activityDates.length > 0
          ? activityDates[activityDates.length - 1]
          : null;

      const activityScore = lastActivity
        ? calculateActivityScore(lastActivity)
        : 0;

      const accessPenalty =
        employee.access_status === "suspended" ? 25 : 0;

      const productivityScore = clamp(
        Math.round(
          completionRate * 0.42 +
            Math.min(100, revenueContribution * 2) * 0.18 +
            Math.min(100, profitContribution * 2) * 0.22 +
            activityScore * 0.18 -
            overduePenalty -
            accessPenalty
        ),
        0,
        100
      );

      return {
        employee,
        revenue,
        profit,
        expensesTotal,
        salesCount: employeeSales.length,
        expensesCount: employeeExpenses.length,
        tasksCount: employeeTasks.length,
        completedTasks,
        overdueTasks,
        lastActivity,
        productivityScore,
      };
    });
  }, [employees, sales, expenses, tasks, today]);

  const totals = useMemo(() => {
    const totalRevenue = employeeStats.reduce(
      (sum, stat) => sum + stat.revenue,
      0
    );

    const totalProfit = employeeStats.reduce(
      (sum, stat) => sum + stat.profit,
      0
    );

    const totalExpenses = employeeStats.reduce(
      (sum, stat) => sum + stat.expensesTotal,
      0
    );

    const completedTasks = tasks.filter(
      (task) => task.status === "done"
    ).length;

    const overdueTasks = tasks.filter(
      (task) =>
        Boolean(task.due_date) &&
        String(task.due_date) < today &&
        task.status !== "done"
    ).length;

    const activeEmployees = employees.filter(
      (employee) =>
        (employee.access_status || "active") === "active"
    ).length;

    const suspendedEmployees = employees.filter(
      (employee) =>
        employee.access_status === "suspended"
    ).length;

    const completionRate =
      tasks.length > 0
        ? Math.round((completedTasks / tasks.length) * 100)
        : 0;

    const activeRate =
      employees.length > 0
        ? (activeEmployees / employees.length) * 100
        : 0;

    const overduePenalty =
      tasks.length > 0
        ? Math.min(35, (overdueTasks / tasks.length) * 100)
        : 0;

    const averageProductivity =
      employeeStats.length > 0
        ? employeeStats.reduce(
            (sum, stat) => sum + stat.productivityScore,
            0
          ) / employeeStats.length
        : 0;

    const workforceHealth = clamp(
      Math.round(
        completionRate * 0.4 +
          activeRate * 0.25 +
          averageProductivity * 0.35 -
          overduePenalty
      ),
      0,
      100
    );

    return {
      totalRevenue,
      totalProfit,
      totalExpenses,
      completedTasks,
      overdueTasks,
      activeEmployees,
      suspendedEmployees,
      completionRate,
      workforceHealth,
    };
  }, [employeeStats, employees, tasks, today]);

  const workforceOverviewMetrics: WorkforceOverviewMetrics = {
    totalEmployees: employees.length,
    activeEmployees: totals.activeEmployees,
    suspendedEmployees: totals.suspendedEmployees,
    totalRevenue: totals.totalRevenue,
    totalProfit: totals.totalProfit,
    totalExpenses: totals.totalExpenses,
    totalTasks: tasks.length,
    completedTasks: totals.completedTasks,
    overdueTasks: totals.overdueTasks,
    completionRate: totals.completionRate,
    workforceHealth: totals.workforceHealth,
  };

  const performerData: TopPerformer[] = employeeStats.map(
    (stat) => ({
      employeeId: stat.employee.id,
      name:
        stat.employee.full_name ||
        stat.employee.email ||
        "Unnamed Employee",
      email: stat.employee.email,
      accessStatus: stat.employee.access_status || "active",
      revenue: stat.revenue,
      profit: stat.profit,
      completedTasks: stat.completedTasks,
      tasksCount: stat.tasksCount,
      overdueTasks: stat.overdueTasks,
      lastActivity: stat.lastActivity,
      productivityScore: stat.productivityScore,
    })
  );

  const employeeGridData: EmployeeGridItem[] =
    employeeStats.map((stat) => ({
      employeeId: stat.employee.id,
      name:
        stat.employee.full_name ||
        stat.employee.email ||
        "Unnamed Employee",
      email: stat.employee.email,
      accessStatus: stat.employee.access_status || "active",
      createdAt: stat.employee.created_at,
      revenue: stat.revenue,
      profit: stat.profit,
      expensesTotal: stat.expensesTotal,
      salesCount: stat.salesCount,
      expensesCount: stat.expensesCount,
      tasksCount: stat.tasksCount,
      completedTasks: stat.completedTasks,
      overdueTasks: stat.overdueTasks,
      lastActivity: stat.lastActivity,
      productivityScore: stat.productivityScore,
    }));

  const insightData: WorkforceInsightEmployee[] =
    performerData.map((performer) => ({
      employeeId: performer.employeeId,
      name: performer.name,
      revenue: performer.revenue,
      profit: performer.profit,
      expensesTotal:
        employeeStats.find(
          (stat) => stat.employee.id === performer.employeeId
        )?.expensesTotal || 0,
      tasksCount: performer.tasksCount,
      completedTasks: performer.completedTasks,
      overdueTasks: performer.overdueTasks,
      productivityScore: performer.productivityScore,
      accessStatus: performer.accessStatus,
      lastActivity: performer.lastActivity,
    }));

  const selectedProfileStat =
    employeeStats.find(
      (stat) => stat.employee.id === profileEmployeeId
    ) || null;

  const selectedProfile: EmployeeProfileMetrics | null =
    selectedProfileStat
      ? {
          employee: selectedProfileStat.employee,
          revenue: selectedProfileStat.revenue,
          profit: selectedProfileStat.profit,
          expensesTotal: selectedProfileStat.expensesTotal,
          salesCount: selectedProfileStat.salesCount,
          expensesCount: selectedProfileStat.expensesCount,
          tasksCount: selectedProfileStat.tasksCount,
          completedTasks: selectedProfileStat.completedTasks,
          overdueTasks: selectedProfileStat.overdueTasks,
          lastActivity: selectedProfileStat.lastActivity,
          productivityScore:
            selectedProfileStat.productivityScore,
        }
      : null;

  const selectedNote =
    profileEmployeeId !== null
      ? employeeNotes.find(
          (note) => note.employee_id === profileEmployeeId
        ) || null
      : null;

  function openEmployeeProfile(employeeId: string) {
    setProfileEmployeeId(employeeId);
    setSelectedEmployeeId(employeeId);
  }

  function assignTaskToEmployee(employeeId: string) {
    setSelectedEmployeeId(employeeId);
    setProfileEmployeeId(null);

    window.setTimeout(() => {
      document
        .querySelector("#assign-task")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 50);
  }

  return (
    <AdminShell
      title="Employees"
      adminName={adminName}
      adminRole="Founder"
      showPageHeader={false}
      notifications={notifications}
      userId={userId}
    >
      <main className="min-h-screen bg-[color:var(--app-bg)] text-[color:var(--text-primary)]">
        <div className="mx-auto w-full max-w-[1680px] space-y-6 pb-16">
          <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">
                  Workforce operating system
                </p>
              </div>

              <h1 className="mt-3 text-[32px] font-semibold leading-none tracking-[-0.045em]">
                Workforce Intelligence
              </h1>

              <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[color:var(--text-tertiary)]">
                Manage employee performance, task execution,
                financial contribution and workspace access from one
                live operating centre.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <HeaderPill
                label="Employees"
                value={employees.length}
                tone="cyan"
              />
              <HeaderPill
                label="Open Tasks"
                value={Math.max(
                  tasks.length - totals.completedTasks,
                  0
                )}
                tone="blue"
              />
              <HeaderPill
                label="Health"
                value={`${totals.workforceHealth}/100`}
                tone={
                  totals.workforceHealth >= 80
                    ? "green"
                    : totals.workforceHealth >= 60
                      ? "amber"
                      : "red"
                }
              />
            </div>
          </header>

          {error && (
            <Message tone="error" text={error} />
          )}

          {success && (
            <Message tone="success" text={success} />
          )}

          <WorkforceOverview
            currency={currency}
            metrics={workforceOverviewMetrics}
          />

          <TopPerformers
            currency={currency}
            performers={performerData}
            onSelectEmployee={openEmployeeProfile}
          />

          <WorkforceInsights
            employees={insightData}
            totalTasks={tasks.length}
            completedTasks={totals.completedTasks}
            overdueTasks={totals.overdueTasks}
            activeEmployees={totals.activeEmployees}
            suspendedEmployees={totals.suspendedEmployees}
            totalRevenue={totals.totalRevenue}
            totalProfit={totals.totalProfit}
            onSelectEmployee={openEmployeeProfile}
          />

          <EmployeeGrid
            currency={currency}
            employees={employeeGridData}
            selectedEmployeeId={profileEmployeeId}
            onSelectEmployee={openEmployeeProfile}
          />

          <AssignTaskForm
            employees={employees}
            selectedEmployeeId={selectedEmployeeId}
            onSelectedEmployeeChange={setSelectedEmployeeId}
            createTask={createTask}
          />

          <TaskBoard
            employees={employees}
            tasks={tasks}
            selectedEmployeeId={selectedEmployeeId}
            onSelectedEmployeeChange={setSelectedEmployeeId}
            updateTask={updateTask}
            deleteTask={deleteTask}
          />

          <EmployeeProfileDrawer
            open={Boolean(selectedProfile)}
            currency={currency}
            profile={selectedProfile}
            tasks={tasks}
            sales={sales}
            expenses={expenses}
            expenseAccounts={expenseAccounts}
            note={selectedNote}
            onClose={() => setProfileEmployeeId(null)}
            onAssignTask={assignTaskToEmployee}
            saveEmployeeNote={saveEmployeeNote}
            suspendEmployee={suspendEmployee}
            reactivateEmployee={reactivateEmployee}
            removeEmployeeAccess={removeEmployeeAccess}
            sendEmployeePasswordReset={
              sendEmployeePasswordReset
            }
            reviewEmployeeExpense={reviewEmployeeExpense}
          />
        </div>
      </main>
    </AdminShell>
  );
}

function HeaderPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "cyan" | "blue" | "green" | "amber" | "red";
}) {
  const style = {
    cyan: "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
    blue: "border-[color:var(--secondary-border)] bg-[color:var(--secondary-soft)] text-[color:var(--secondary)]",
    green:
      "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
    amber:
      "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
    red: "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
  }[tone];

  return (
    <div
      className={`min-w-[112px] rounded-xl border px-4 py-3 ${style}`}
    >
      <p className="text-[8px] uppercase tracking-[0.11em] opacity-55">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function Message({
  tone,
  text,
}: {
  tone: "success" | "error";
  text: string;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        tone === "success"
          ? "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
          : "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
      }`}
    >
      {text}
    </div>
  );
}

function calculateActivityScore(value: string) {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return 0;
  }

  const ageInDays =
    (Date.now() - timestamp) / (1000 * 60 * 60 * 24);

  if (ageInDays <= 3) return 100;
  if (ageInDays <= 7) return 85;
  if (ageInDays <= 14) return 70;
  if (ageInDays <= 30) return 50;
  if (ageInDays <= 60) return 25;
  return 10;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}