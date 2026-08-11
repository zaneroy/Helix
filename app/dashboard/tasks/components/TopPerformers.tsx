"use client";

import { formatCurrency } from "@/lib/currency/formatCurrency";

export type TopPerformer = {
  employeeId: string;
  name: string;
  email: string | null;
  accessStatus: string | null;
  revenue: number;
  profit: number;
  completedTasks: number;
  tasksCount: number;
  overdueTasks: number;
  lastActivity: string | null;
  productivityScore: number;
};

type Props = {
  currency: string;
  performers: TopPerformer[];
  onSelectEmployee: (employeeId: string) => void;
};

type RankedCardProps = {
  eyebrow: string;
  title: string;
  performer: TopPerformer | null;
  value: string;
  note: string;
  tone: "cyan" | "green" | "violet" | "amber";
  icon: React.ReactNode;
  onOpen?: () => void;
};

export default function TopPerformers({
  currency,
  performers,
  onSelectEmployee,
}: Props) {
  const money = (value: number) =>
    formatCurrency(value, currency);

  const topRevenue =
    [...performers].sort((a, b) => b.revenue - a.revenue)[0] || null;

  const topProfit =
    [...performers].sort((a, b) => b.profit - a.profit)[0] || null;

  const topTaskCompleter =
    [...performers].sort(
      (a, b) =>
        b.completedTasks - a.completedTasks ||
        b.productivityScore - a.productivityScore
    )[0] || null;

  const topProductivity =
    [...performers].sort(
      (a, b) => b.productivityScore - a.productivityScore
    )[0] || null;

  return (
    <section className="rounded-2xl border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">
              Performance leaderboard
            </p>
          </div>

          <h2 className="mt-3 text-xl font-semibold tracking-[-0.025em] text-[color:var(--text-primary)]">
            Top Performers
          </h2>

          <p className="mt-2 max-w-2xl text-xs leading-5 text-[color:var(--text-tertiary)]">
            Live employee rankings based on revenue, profit, task execution and
            operational consistency.
          </p>
        </div>

        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-xs text-[color:var(--text-tertiary)]">
          {performers.length} employees ranked
        </div>
      </div>

      {performers.length > 0 ? (
        <div className="mt-6 grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
          <RankedCard
            eyebrow="Revenue leader"
            title="Top Revenue Generator"
            performer={topRevenue}
            value={money(topRevenue?.revenue || 0)}
            note={`${topRevenue?.tasksCount || 0} assigned tasks`}
            tone="cyan"
            icon={<RevenueIcon />}
            onOpen={
              topRevenue
                ? () => onSelectEmployee(topRevenue.employeeId)
                : undefined
            }
          />

          <RankedCard
            eyebrow="Profit leader"
            title="Most Profitable"
            performer={topProfit}
            value={money(topProfit?.profit || 0)}
            note={`${money(
              Math.max(
                (topProfit?.revenue || 0) - (topProfit?.profit || 0),
                0
              )
            )} estimated cost base`}
            tone="green"
            icon={<ProfitIcon />}
            onOpen={
              topProfit
                ? () => onSelectEmployee(topProfit.employeeId)
                : undefined
            }
          />

          <RankedCard
            eyebrow="Execution leader"
            title="Top Task Completer"
            performer={topTaskCompleter}
            value={`${topTaskCompleter?.completedTasks || 0} completed`}
            note={`${calculateCompletionRate(topTaskCompleter)}% completion rate`}
            tone="violet"
            icon={<TaskIcon />}
            onOpen={
              topTaskCompleter
                ? () =>
                    onSelectEmployee(topTaskCompleter.employeeId)
                : undefined
            }
          />

          <RankedCard
            eyebrow="Overall leader"
            title="Highest Productivity"
            performer={topProductivity}
            value={`${topProductivity?.productivityScore || 0} / 100`}
            note={getProductivityLabel(
              topProductivity?.productivityScore || 0
            )}
            tone="amber"
            icon={<SparkIcon />}
            onOpen={
              topProductivity
                ? () =>
                    onSelectEmployee(topProductivity.employeeId)
                : undefined
            }
          />
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-8 text-center">
          <p className="text-sm text-[color:var(--text-tertiary)]">
            No employee performance data is available yet.
          </p>
          <p className="mt-2 text-xs text-[color:var(--text-muted)]">
            Rankings will appear after employees record sales, complete tasks or
            submit expenses.
          </p>
        </div>
      )}
    </section>
  );
}

function RankedCard({
  eyebrow,
  title,
  performer,
  value,
  note,
  tone,
  icon,
  onOpen,
}: RankedCardProps) {
  const toneStyles = {
    cyan: {
      icon: "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
      value: "text-[color:var(--primary)]",
      line: "bg-[color:var(--primary)]",
    },
    green: {
      icon: "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
      value: "text-[color:var(--success)]",
      line: "bg-[color:var(--success)]",
    },
    violet: {
      icon: "border-[color:var(--violet-border)] bg-[color:var(--violet-soft)] text-[color:var(--chart-5)]",
      value: "text-[color:var(--chart-5)]",
      line: "bg-[color:var(--violet)]",
    },
    amber: {
      icon: "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
      value: "text-[color:var(--warning)]",
      line: "bg-[color:var(--warning)]",
    },
  }[tone];

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 transition hover:border-[color:var(--border-brand)]">
      <div
        className={`absolute inset-x-0 top-0 h-px ${toneStyles.line} opacity-45`}
      />

      <div className="flex items-start justify-between gap-4">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl border ${toneStyles.icon}`}
        >
          {icon}
        </span>

        {performer && (
          <AccessIndicator status={performer.accessStatus} />
        )}
      </div>

      <p className="mt-5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
        {eyebrow}
      </p>

      <h3 className="mt-2 text-sm font-semibold text-[color:var(--text-primary)]">
        {title}
      </h3>

      {performer ? (
        <>
          <div className="mt-5 flex items-center gap-3">
            <Avatar name={performer.name} />

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[color:var(--text-primary)]">
                {performer.name}
              </p>
              <p className="mt-1 truncate text-[10px] text-[color:var(--text-muted)]">
                {performer.email || "No email"}
              </p>
            </div>
          </div>

          <p className={`mt-5 text-xl font-semibold ${toneStyles.value}`}>
            {value}
          </p>

          <p className="mt-2 text-xs text-[color:var(--text-tertiary)]">{note}</p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <MiniMetric
              label="Tasks"
              value={performer.tasksCount}
            />
            <MiniMetric
              label="Overdue"
              value={performer.overdueTasks}
              alert={performer.overdueTasks > 0}
            />
          </div>

          {onOpen && (
            <button
              type="button"
              onClick={onOpen}
              className="mt-5 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-xs font-medium text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-brand)] hover:text-[color:var(--primary)]"
            >
              Open Profile
              <ArrowUpRightIcon />
            </button>
          )}
        </>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5 text-xs text-[color:var(--text-muted)]">
          No employee data available.
        </div>
      )}
    </article>
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
      <p className="text-[8px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
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

function AccessIndicator({
  status,
}: {
  status: string | null;
}) {
  const suspended = status === "suspended";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] ${
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

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-xs font-semibold text-[color:var(--primary)]">
      {initials || "U"}
    </span>
  );
}

function calculateCompletionRate(
  performer: TopPerformer | null
) {
  if (!performer || performer.tasksCount <= 0) {
    return 0;
  }

  return Math.round(
    (performer.completedTasks / performer.tasksCount) * 100
  );
}

function getProductivityLabel(score: number) {
  if (score >= 90) return "Elite workforce performance";
  if (score >= 75) return "Strong and consistent";
  if (score >= 55) return "Stable performance";
  return "Management attention recommended";
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

function SparkIcon() {
  return (
    <SvgIcon>
      <path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
      <path d="m18 15 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z" />
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