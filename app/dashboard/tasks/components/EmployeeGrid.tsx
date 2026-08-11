"use client";

import { formatCurrency } from "@/lib/currency/formatCurrency";

export type EmployeeGridItem = {
  employeeId: string;
  name: string;
  email: string | null;
  accessStatus: string | null;
  createdAt: string | null;
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
  currency: string;
  employees: EmployeeGridItem[];
  selectedEmployeeId: string | null;
  onSelectEmployee: (employeeId: string) => void;
};

export default function EmployeeGrid({
  currency,
  employees,
  selectedEmployeeId,
  onSelectEmployee,
}: Props) {
  const money = (value: number) =>
    formatCurrency(value, currency);

  if (employees.length === 0) {
    return (
      <section className="rounded-2xl border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] p-6 shadow-[var(--shadow-card)]">
        <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
            <UsersIcon />
          </div>

          <p className="mt-4 text-sm font-medium text-[color:var(--text-secondary)]">
            No employees found
          </p>

          <p className="mt-2 text-xs text-[color:var(--text-muted)]">
            Invite employees from the Team page to begin workforce
            tracking.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]" />

            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">
              Employee intelligence
            </p>
          </div>

          <h2 className="mt-3 text-xl font-semibold tracking-[-0.025em] text-[color:var(--text-primary)]">
            Workforce Performance
          </h2>

          <p className="mt-2 max-w-2xl text-xs leading-5 text-[color:var(--text-tertiary)]">
            Open any employee profile to review performance, tasks,
            expenses, notes and access controls.
          </p>
        </div>

        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-xs text-[color:var(--text-tertiary)]">
          {employees.length} active records
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {employees.map((employee) => {
          const selected =
            selectedEmployeeId === employee.employeeId;

          const completionRate =
            employee.tasksCount > 0
              ? Math.round(
                  (employee.completedTasks /
                    employee.tasksCount) *
                    100
                )
              : 0;

          return (
            <article
              key={employee.employeeId}
              className={`group relative overflow-hidden rounded-2xl border bg-[color:var(--surface)] p-5 transition ${
                selected
                  ? "border-[color:var(--border-brand)] shadow-[var(--shadow-brand)]"
                  : "border-[color:var(--border)] hover:border-[color:var(--border-brand)]"
              }`}
            >
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[color:var(--primary-soft)] blur-3xl transition group-hover:bg-[color:var(--primary-soft)]" />

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={employee.name} />

                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                        {employee.name}
                      </h3>

                      <p className="mt-1 truncate text-[10px] text-[color:var(--text-muted)]">
                        {employee.email || "No email address"}
                      </p>
                    </div>
                  </div>

                  <AccessBadge
                    status={employee.accessStatus || "active"}
                  />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Metric
                    label="Revenue"
                    value={money(employee.revenue)}
                    tone="cyan"
                  />

                  <Metric
                    label="Profit"
                    value={money(employee.profit)}
                    tone={
                      employee.profit >= 0 ? "green" : "red"
                    }
                  />

                  <Metric
                    label="Tasks"
                    value={employee.tasksCount}
                    tone="blue"
                  />

                  <Metric
                    label="Completion"
                    value={`${completionRate}%`}
                    tone={
                      completionRate >= 80
                        ? "green"
                        : completionRate >= 55
                          ? "amber"
                          : "red"
                    }
                  />
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[9px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
                      Productivity
                    </p>

                    <p
                      className={`text-xs font-semibold ${getScoreColour(
                        employee.productivityScore
                      )}`}
                    >
                      {employee.productivityScore}/100
                    </p>
                  </div>

                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:var(--surface-soft)]">
                    <div
                      className={`h-full rounded-full ${getScoreBarColour(
                        employee.productivityScore
                      )}`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            employee.productivityScore
                          )
                        )}%`,
                      }}
                    />
                  </div>

                  <p className="mt-2 text-[10px] text-[color:var(--text-muted)]">
                    {getScoreLabel(employee.productivityScore)}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <MiniMetric
                    label="Sales"
                    value={employee.salesCount}
                  />

                  <MiniMetric
                    label="Expenses"
                    value={employee.expensesCount}
                  />

                  <MiniMetric
                    label="Overdue"
                    value={employee.overdueTasks}
                    alert={employee.overdueTasks > 0}
                  />
                </div>

                <div className="mt-5 flex items-center justify-between gap-4 border-t border-[color:var(--border)] pt-4">
                  <div>
                    <p className="text-[8px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
                      Last activity
                    </p>

                    <p className="mt-1 text-[10px] text-[color:var(--text-tertiary)]">
                      {formatDate(employee.lastActivity)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onSelectEmployee(employee.employeeId)
                    }
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-3 text-[10px] font-medium text-[color:var(--primary)] transition hover:bg-[color:var(--primary-soft)]"
                  >
                    Open Profile
                    <ArrowUpRightIcon />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "cyan" | "green" | "red" | "blue" | "amber";
}) {
  const colour = {
    cyan: "text-[color:var(--primary)]",
    green: "text-[color:var(--success)]",
    red: "text-[color:var(--danger)]",
    blue: "text-[color:var(--secondary)]",
    amber: "text-[color:var(--warning)]",
  }[tone];

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-3">
      <p className="text-[8px] uppercase tracking-[0.11em] text-[color:var(--text-muted)]">
        {label}
      </p>

      <p className={`mt-1.5 truncate text-xs font-semibold ${colour}`}>
        {value}
      </p>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  alert,
}: {
  label: string;
  value: string | number;
  alert?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2.5">
      <p className="text-[8px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
        {label}
      </p>

      <p
        className={`mt-1 text-xs font-semibold ${
          alert ? "text-[color:var(--danger)]" : "text-[color:var(--text-secondary)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-xs font-semibold text-[color:var(--primary)]">
      {initials || "U"}
    </span>
  );
}

function AccessBadge({ status }: { status: string }) {
  const suspended = status === "suspended";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.09em] ${
        suspended
          ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
          : "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          suspended ? "bg-[color:var(--warning)]" : "bg-[color:var(--success)]"
        }`}
      />

      {suspended ? "Suspended" : "Active"}
    </span>
  );
}

function getScoreLabel(score: number) {
  if (score >= 90) return "Elite workforce performance";
  if (score >= 75) return "Strong and consistent";
  if (score >= 55) return "Stable performance";
  return "Management attention recommended";
}

function getScoreColour(score: number) {
  if (score >= 90) return "text-[color:var(--success)]";
  if (score >= 75) return "text-[color:var(--primary)]";
  if (score >= 55) return "text-[color:var(--warning)]";
  return "text-[color:var(--danger)]";
}

function getScoreBarColour(score: number) {
  if (score >= 90) return "bg-[color:var(--success)]";
  if (score >= 75) return "bg-[color:var(--primary)]";
  if (score >= 55) return "bg-[color:var(--warning)]";
  return "bg-[color:var(--danger)]";
}

function formatDate(value: string | null) {
  if (!value) return "No activity yet";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function SvgIcon({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function UsersIcon() {
  return (
    <SvgIcon>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19a6 6 0 0112 0" />
      <circle cx="17" cy="9" r="2" />
      <path d="M16 15a5 5 0 015 4" />
    </SvgIcon>
  );
}

function ArrowUpRightIcon() {
  return (
    <SvgIcon>
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </SvgIcon>
  );
}