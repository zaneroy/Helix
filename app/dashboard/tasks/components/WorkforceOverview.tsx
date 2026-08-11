"use client";

import { formatCurrency } from "@/lib/currency/formatCurrency";

export type WorkforceOverviewMetrics = {
  totalEmployees: number;
  activeEmployees: number;
  suspendedEmployees: number;
  totalRevenue: number;
  totalProfit: number;
  totalExpenses: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  completionRate: number;
  workforceHealth: number;
};

type WorkforceOverviewProps = {
  currency: string;
  metrics: WorkforceOverviewMetrics;
};

type MetricTone =
  | "cyan"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "violet";

type MetricCardProps = {
  label: string;
  value: string | number;
  note: string;
  tone: MetricTone;
  progress?: number;
  icon: React.ReactNode;
};

export default function WorkforceOverview({
  currency,
  metrics,
}: WorkforceOverviewProps) {
  const money = (value: number) =>
    formatCurrency(value, currency);

  return (
    <section className="overflow-hidden rounded-2xl border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
      <div className="relative border-b border-[color:var(--border)] px-6 py-6">
        <div className="pointer-events-none absolute right-0 top-0 h-52 w-52 rounded-full bg-[color:var(--primary-soft)] blur-3xl" />

        <div className="relative flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]" />

              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">
                Live workforce intelligence
              </p>
            </div>

            <h2 className="mt-3 text-xl font-semibold tracking-[-0.025em] text-[color:var(--text-primary)]">
              Workforce Overview
            </h2>

            <p className="mt-2 max-w-2xl text-xs leading-5 text-[color:var(--text-tertiary)]">
              Real-time employee performance, profitability, task execution
              and access health across your company.
            </p>
          </div>

          <WorkforceHealth
            score={metrics.workforceHealth}
            completedTasks={metrics.completedTasks}
            overdueTasks={metrics.overdueTasks}
          />
        </div>
      </div>

      <div className="grid gap-px bg-[color:var(--surface-soft)] md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Employees"
          value={metrics.totalEmployees}
          note={`${metrics.activeEmployees} active · ${metrics.suspendedEmployees} suspended`}
          tone="cyan"
          icon={<UsersIcon />}
        />

        <MetricCard
          label="Revenue Generated"
          value={money(metrics.totalRevenue)}
          note="Employee-attributed sales"
          tone="blue"
          icon={<RevenueIcon />}
        />

        <MetricCard
          label="Net Contribution"
          value={money(metrics.totalProfit)}
          note={`${money(metrics.totalExpenses)} employee expenses`}
          tone={metrics.totalProfit >= 0 ? "green" : "red"}
          icon={<ProfitIcon />}
        />

        <MetricCard
          label="Task Completion"
          value={`${metrics.completionRate}%`}
          note={`${metrics.completedTasks} of ${metrics.totalTasks} completed`}
          tone={
            metrics.completionRate >= 80
              ? "green"
              : metrics.completionRate >= 55
                ? "amber"
                : "red"
          }
          progress={metrics.completionRate}
          icon={<TaskIcon />}
        />
      </div>

      <div className="grid gap-px border-t border-[color:var(--border)] bg-[color:var(--surface-soft)] sm:grid-cols-3">
        <OperationalMetric
          label="Open Tasks"
          value={Math.max(
            metrics.totalTasks - metrics.completedTasks,
            0
          )}
          note="Awaiting completion"
        />

        <OperationalMetric
          label="Overdue Tasks"
          value={metrics.overdueTasks}
          note={
            metrics.overdueTasks > 0
              ? "Requires management attention"
              : "No overdue work"
          }
          alert={metrics.overdueTasks > 0}
        />

        <OperationalMetric
          label="Active Workforce"
          value={
            metrics.totalEmployees > 0
              ? `${Math.round(
                  (metrics.activeEmployees /
                    metrics.totalEmployees) *
                    100
                )}%`
              : "0%"
          }
          note="Employees with active access"
        />
      </div>
    </section>
  );
}

function WorkforceHealth({
  score,
  completedTasks,
  overdueTasks,
}: {
  score: number;
  completedTasks: number;
  overdueTasks: number;
}) {
  const normalizedScore = Math.min(
    100,
    Math.max(0, Math.round(score))
  );

  const label =
    normalizedScore >= 85
      ? "Excellent"
      : normalizedScore >= 70
        ? "Strong"
        : normalizedScore >= 50
          ? "Needs attention"
          : "At risk";

  const tone =
    normalizedScore >= 85
      ? "text-[color:var(--success)] border-[color:var(--success-border)] bg-[color:var(--success-soft)]"
      : normalizedScore >= 70
        ? "text-[color:var(--primary)] border-[color:var(--border-brand)] bg-[color:var(--primary-soft)]"
        : normalizedScore >= 50
          ? "text-[color:var(--warning)] border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]"
          : "text-[color:var(--danger)] border-[color:var(--danger-border)] bg-[color:var(--danger-soft)]";

  return (
    <div
      className={`min-w-[250px] rounded-2xl border px-5 py-4 ${tone}`}
    >
      <div className="flex items-end justify-between gap-5">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.15em] opacity-60">
            Workforce Health
          </p>

          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-semibold text-[color:var(--text-primary)]">
              {normalizedScore}
            </p>

            <span className="text-xs opacity-50">/ 100</span>
          </div>

          <p className="mt-1 text-xs font-medium">{label}</p>
        </div>

        <HealthGauge score={normalizedScore} />
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[color:var(--surface-soft)]">
        <div
          className="h-full rounded-full bg-current transition-all"
          style={{ width: `${normalizedScore}%` }}
        />
      </div>

      <p className="mt-3 text-[10px] leading-4 opacity-55">
        {completedTasks} completed tasks · {overdueTasks} overdue
      </p>
    </div>
  );
}

function HealthGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 20;
  const offset =
    circumference - (score / 100) * circumference;

  return (
    <svg
      width="52"
      height="52"
      viewBox="0 0 52 52"
      aria-hidden="true"
      className="-rotate-90"
    >
      <circle
        cx="26"
        cy="26"
        r="20"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.12"
        strokeWidth="5"
      />

      <circle
        cx="26"
        cy="26"
        r="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

function MetricCard({
  label,
  value,
  note,
  tone,
  progress,
  icon,
}: MetricCardProps) {
  const toneClasses: Record<MetricTone, string> = {
    cyan: "text-[color:var(--primary)] bg-[color:var(--primary-soft)] border-[color:var(--border-brand)]",
    blue: "text-[color:var(--secondary)] bg-[color:var(--secondary-soft)] border-[color:var(--secondary-border)]",
    green:
      "text-[color:var(--success)] bg-[color:var(--success-soft)] border-[color:var(--success-border)]",
    amber:
      "text-[color:var(--warning)] bg-[color:var(--warning-soft)] border-[color:var(--warning-border)]",
    red: "text-[color:var(--danger)] bg-[color:var(--danger-soft)] border-[color:var(--danger-border)]",
    violet:
      "text-[color:var(--chart-5)] bg-[color:var(--violet-soft)] border-[color:var(--violet-border)]",
  };

  return (
    <article className="bg-[color:var(--surface)] px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
            {label}
          </p>

          <p className="mt-3 text-xl font-semibold tracking-[-0.025em] text-[color:var(--text-primary)]">
            {value}
          </p>
        </div>

        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl border ${toneClasses[tone]}`}
        >
          {icon}
        </span>
      </div>

      <p className="mt-2 text-xs text-[color:var(--text-tertiary)]">{note}</p>

      {typeof progress === "number" && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[color:var(--surface-soft)]">
          <div
            className={`h-full rounded-full ${
              tone === "green"
                ? "bg-[color:var(--success)]"
                : tone === "amber"
                  ? "bg-[color:var(--warning)]"
                  : tone === "red"
                    ? "bg-[color:var(--danger)]"
                    : "bg-[color:var(--primary)]"
            }`}
            style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
            }}
          />
        </div>
      )}
    </article>
  );
}

function OperationalMetric({
  label,
  value,
  note,
  alert,
}: {
  label: string;
  value: string | number;
  note: string;
  alert?: boolean;
}) {
  return (
    <div className="bg-[color:var(--surface)] px-6 py-4">
      <p className="text-[9px] uppercase tracking-[0.13em] text-[color:var(--text-muted)]">
        {label}
      </p>

      <p
        className={`mt-2 text-lg font-semibold ${
          alert ? "text-[color:var(--danger)]" : "text-[color:var(--text-primary)]"
        }`}
      >
        {value}
      </p>

      <p
        className={`mt-1 text-[10px] ${
          alert ? "text-[color:var(--danger)]" : "text-[color:var(--text-muted)]"
        }`}
      >
        {note}
      </p>
    </div>
  );
}

function SvgIcon({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
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

function RevenueIcon() {
  return (
    <SvgIcon>
      <path d="M4 19V9" />
      <path d="M10 19V5" />
      <path d="M16 19v-7" />
      <path d="M22 19H2" />
    </SvgIcon>
  );
}

function ProfitIcon() {
  return (
    <SvgIcon>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </SvgIcon>
  );
}

function TaskIcon() {
  return (
    <SvgIcon>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="m8 9 2 2 4-4" />
      <path d="M8 15h8" />
    </SvgIcon>
  );
}