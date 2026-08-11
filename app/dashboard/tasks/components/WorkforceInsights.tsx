"use client";

export type WorkforceInsightEmployee = {
  employeeId: string;
  name: string;
  revenue: number;
  profit: number;
  expensesTotal: number;
  tasksCount: number;
  completedTasks: number;
  overdueTasks: number;
  productivityScore: number;
  accessStatus: string | null;
  lastActivity: string | null;
};

type Props = {
  employees: WorkforceInsightEmployee[];
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  activeEmployees: number;
  suspendedEmployees: number;
  totalRevenue: number;
  totalProfit: number;
  onSelectEmployee: (employeeId: string) => void;
};

type Insight = {
  id: string;
  title: string;
  description: string;
  tone: "cyan" | "green" | "amber" | "red" | "violet";
  employeeId?: string;
  actionLabel?: string;
};

export default function WorkforceInsights({
  employees,
  totalTasks,
  completedTasks,
  overdueTasks,
  activeEmployees,
  suspendedEmployees,
  totalRevenue,
  totalProfit,
  onSelectEmployee,
}: Props) {
  const insights = buildInsights({
    employees,
    totalTasks,
    completedTasks,
    overdueTasks,
    activeEmployees,
    suspendedEmployees,
    totalRevenue,
    totalProfit,
  });

  const completionRate =
    totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
      <div className="relative border-b border-[color:var(--border)] px-6 py-6">
        <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-[color:var(--primary-soft)] blur-3xl" />

        <div className="relative flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]" />

              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">
                Automated management intelligence
              </p>
            </div>

            <h2 className="mt-3 text-xl font-semibold tracking-[-0.025em] text-[color:var(--text-primary)]">
              Workforce Insights
            </h2>

            <p className="mt-2 max-w-2xl text-xs leading-5 text-[color:var(--text-tertiary)]">
              Actionable observations generated from live employee,
              financial and task data.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <SummaryMetric
              label="Completion"
              value={`${completionRate}%`}
            />

            <SummaryMetric
              label="Active"
              value={activeEmployees}
            />

            <SummaryMetric
              label="Alerts"
              value={overdueTasks + suspendedEmployees}
              alert={overdueTasks + suspendedEmployees > 0}
            />
          </div>
        </div>
      </div>

      {insights.length > 0 ? (
        <div className="grid gap-px bg-[color:var(--surface-soft)] xl:grid-cols-2">
          {insights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onSelectEmployee={onSelectEmployee}
            />
          ))}
        </div>
      ) : (
        <div className="p-8">
          <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
              <InsightIcon />
            </div>

            <p className="mt-4 text-sm font-medium text-[color:var(--text-secondary)]">
              More operating history required
            </p>

            <p className="mt-2 text-xs leading-5 text-[color:var(--text-muted)]">
              Insights will appear after employees complete tasks,
              record sales and submit expenses.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function InsightCard({
  insight,
  onSelectEmployee,
}: {
  insight: Insight;
  onSelectEmployee: (employeeId: string) => void;
}) {
  const styles = {
    cyan: {
      icon: "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
      label: "text-[color:var(--primary)]",
      line: "bg-[color:var(--primary)]",
    },
    green: {
      icon: "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
      label: "text-[color:var(--success)]",
      line: "bg-[color:var(--success)]",
    },
    amber: {
      icon: "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
      label: "text-[color:var(--warning)]",
      line: "bg-[color:var(--warning)]",
    },
    red: {
      icon: "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
      label: "text-[color:var(--danger)]",
      line: "bg-[color:var(--danger)]",
    },
    violet: {
      icon: "border-[color:var(--violet-border)] bg-[color:var(--violet-soft)] text-[color:var(--chart-5)]",
      label: "text-[color:var(--chart-5)]",
      line: "bg-[color:var(--violet)]",
    },
  }[insight.tone];

  return (
    <article className="group relative bg-[color:var(--surface)] p-6">
      <div
        className={`absolute inset-y-0 left-0 w-px ${styles.line} opacity-40`}
      />

      <div className="flex items-start gap-4">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${styles.icon}`}
        >
          <InsightIcon />
        </span>

        <div className="min-w-0 flex-1">
          <p
            className={`text-[9px] font-semibold uppercase tracking-[0.14em] ${styles.label}`}
          >
            Management insight
          </p>

          <h3 className="mt-2 text-sm font-semibold text-[color:var(--text-primary)]">
            {insight.title}
          </h3>

          <p className="mt-2 text-sm leading-6 text-[color:var(--text-tertiary)]">
            {insight.description}
          </p>

          {insight.employeeId && insight.actionLabel && (
            <button
              type="button"
              onClick={() =>
                onSelectEmployee(insight.employeeId!)
              }
              className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 text-[10px] font-medium text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-brand)] hover:text-[color:var(--primary)]"
            >
              {insight.actionLabel}
              <ArrowUpRightIcon />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function buildInsights({
  employees,
  totalTasks,
  completedTasks,
  overdueTasks,
  activeEmployees,
  suspendedEmployees,
  totalRevenue,
  totalProfit,
}: Omit<Props, "onSelectEmployee">): Insight[] {
  if (employees.length === 0) {
    return [];
  }

  const insights: Insight[] = [];

  const completionRate =
    totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

  const topRevenueEmployee = [...employees].sort(
    (a, b) => b.revenue - a.revenue
  )[0];

  const topProfitEmployee = [...employees].sort(
    (a, b) => b.profit - a.profit
  )[0];

  const topProductivityEmployee = [...employees].sort(
    (a, b) => b.productivityScore - a.productivityScore
  )[0];

  const highestOverdueEmployee = [...employees].sort(
    (a, b) => b.overdueTasks - a.overdueTasks
  )[0];

  const inactiveEmployees = employees.filter(
    (employee) => !employee.lastActivity
  );

  if (topRevenueEmployee?.revenue > 0) {
    const contribution =
      totalRevenue > 0
        ? Math.round(
            (topRevenueEmployee.revenue / totalRevenue) * 100
          )
        : 0;

    insights.push({
      id: "top-revenue",
      title: `${topRevenueEmployee.name} leads company revenue`,
      description: `${topRevenueEmployee.name} generated ${contribution}% of employee-attributed company revenue. Review their workflow and repeatable strengths across the wider team.`,
      tone: "cyan",
      employeeId: topRevenueEmployee.employeeId,
      actionLabel: "Review Revenue Leader",
    });
  }

  if (topProfitEmployee?.profit > 0) {
    const contribution =
      totalProfit > 0
        ? Math.round(
            (topProfitEmployee.profit / totalProfit) * 100
          )
        : 0;

    insights.push({
      id: "top-profit",
      title: `${topProfitEmployee.name} is the strongest profit contributor`,
      description: `${topProfitEmployee.name} contributes approximately ${contribution}% of employee-attributed profit. Protect capacity and monitor workload to sustain this contribution.`,
      tone: "green",
      employeeId: topProfitEmployee.employeeId,
      actionLabel: "Open Profit Profile",
    });
  }

  if (overdueTasks > 0) {
    insights.push({
      id: "overdue-work",
      title: `${overdueTasks} overdue ${
        overdueTasks === 1 ? "task requires" : "tasks require"
      } attention`,
      description:
        highestOverdueEmployee?.overdueTasks > 0
          ? `${highestOverdueEmployee.name} has the highest overdue workload with ${highestOverdueEmployee.overdueTasks} outstanding ${
              highestOverdueEmployee.overdueTasks === 1
                ? "task"
                : "tasks"
            }. Review deadlines, blockers and workload allocation.`
          : "Review overdue work, deadlines and employee capacity before assigning additional tasks.",
      tone: "red",
      employeeId:
        highestOverdueEmployee?.overdueTasks > 0
          ? highestOverdueEmployee.employeeId
          : undefined,
      actionLabel:
        highestOverdueEmployee?.overdueTasks > 0
          ? "Review Overdue Work"
          : undefined,
    });
  }

  if (completionRate >= 85) {
    insights.push({
      id: "strong-completion",
      title: "Task execution is operating at a strong level",
      description: `The workforce has completed ${completionRate}% of assigned tasks. Maintain current operating rhythm and continue monitoring deadline quality alongside completion volume.`,
      tone: "green",
    });
  } else if (completionRate < 55 && totalTasks > 0) {
    insights.push({
      id: "weak-completion",
      title: "Task completion requires management attention",
      description: `Only ${completionRate}% of assigned tasks are complete. Review task clarity, priorities, workload distribution and employee blockers.`,
      tone: "amber",
    });
  }

  if (
    topProductivityEmployee &&
    topProductivityEmployee.productivityScore >= 80
  ) {
    insights.push({
      id: "productivity-leader",
      title: `${topProductivityEmployee.name} is the productivity benchmark`,
      description: `${topProductivityEmployee.name} has the highest workforce score at ${topProductivityEmployee.productivityScore}/100. Use their task execution and financial contribution as a benchmark for coaching.`,
      tone: "violet",
      employeeId: topProductivityEmployee.employeeId,
      actionLabel: "Review Productivity Profile",
    });
  }

  if (suspendedEmployees > 0) {
    insights.push({
      id: "suspended-access",
      title: `${suspendedEmployees} employee ${
        suspendedEmployees === 1 ? "account is" : "accounts are"
      } suspended`,
      description:
        "Review whether suspended access should remain blocked, be restored or be permanently removed from the company workspace.",
      tone: "amber",
    });
  }

  if (inactiveEmployees.length > 0) {
    const firstInactive = inactiveEmployees[0];

    insights.push({
      id: "no-activity",
      title: `${inactiveEmployees.length} employee ${
        inactiveEmployees.length === 1
          ? "has"
          : "have"
      } no recorded activity`,
      description: `${firstInactive.name}${
        inactiveEmployees.length > 1
          ? ` and ${inactiveEmployees.length - 1} other ${
              inactiveEmployees.length - 1 === 1
                ? "employee"
                : "employees"
            }`
          : ""
      } have no recorded sales, tasks or expenses. Confirm onboarding and role expectations.`,
      tone: "amber",
      employeeId: firstInactive.employeeId,
      actionLabel: "Review Employee",
    });
  }

  if (
    activeEmployees === employees.length &&
    overdueTasks === 0 &&
    completionRate >= 75
  ) {
    insights.push({
      id: "healthy-workforce",
      title: "Workforce operations are currently healthy",
      description:
        "All employee accounts are active, no tasks are overdue and completion performance is stable. No immediate workforce intervention is required.",
      tone: "green",
    });
  }

  return deduplicateInsights(insights).slice(0, 6);
}

function deduplicateInsights(insights: Insight[]) {
  return Array.from(
    new Map(
      insights.map((insight) => [insight.id, insight])
    ).values()
  );
}

function SummaryMetric({
  label,
  value,
  alert,
}: {
  label: string;
  value: string | number;
  alert?: boolean;
}) {
  return (
    <div className="min-w-[88px] rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-3 text-center">
      <p className="text-[8px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
        {label}
      </p>

      <p
        className={`mt-1.5 text-sm font-semibold ${
          alert ? "text-[color:var(--danger)]" : "text-[color:var(--text-secondary)]"
        }`}
      >
        {value}
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
      width="17"
      height="17"
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

function InsightIcon() {
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