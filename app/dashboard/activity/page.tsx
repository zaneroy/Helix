import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import { getUserNotifications } from "@/lib/notifications/server";

type ActivityActor = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type ActivityEventRow = {
  id: string;
  company_id: string;
  actor_id: string | null;
  actor_role: string | null;
  event_type: string;
  title: string;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  action_url: string | null;
  severity: "info" | "success" | "warning" | "error" | "critical";
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ActivityEvent = ActivityEventRow & {
  actor: ActivityActor | null;
};

type EventStyle = {
  label: string;
  icon: EventIconName;
  href: string | null;
  iconClassName: string;
  badgeClassName: string;
};

type EventIconName =
  | "inventory"
  | "sale"
  | "expense"
  | "task"
  | "investor"
  | "document"
  | "security"
  | "profile"
  | "suspended"
  | "success"
  | "activity";

function getEventStyle(type: string): EventStyle {
  const normalizedType = type.toLowerCase();

  if (
    normalizedType.includes("product") ||
    normalizedType.includes("inventory") ||
    normalizedType.includes("stock")
  ) {
    return {
      label: "Inventory",
      icon: "inventory",
      href: "/dashboard/products",
      iconClassName:
        "border-[color:var(--secondary-border)] bg-[color:var(--secondary-soft)] text-[color:var(--secondary)]",
      badgeClassName:
        "border-[color:var(--secondary-border)] bg-[color:var(--secondary-soft)] text-[color:var(--secondary)]",
    };
  }

  if (normalizedType.includes("sale")) {
    return {
      label: "Sales",
      icon: "sale",
      href: "/dashboard/sales",
      iconClassName:
        "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
      badgeClassName:
        "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
    };
  }

  if (normalizedType.includes("expense")) {
    return {
      label: "Expense",
      icon: "expense",
      href: "/dashboard/expenses",
      iconClassName:
        "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
      badgeClassName:
        "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
    };
  }

  if (normalizedType.includes("task")) {
    return {
      label: "Task",
      icon: "task",
      href: "/dashboard/tasks",
      iconClassName:
        "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
      badgeClassName:
        "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
    };
  }

  if (
    normalizedType.includes("investor") ||
    normalizedType.includes("capital") ||
    normalizedType.includes("investment")
  ) {
    return {
      label: "Investor",
      icon: "investor",
      href: "/dashboard/investors",
      iconClassName:
        "border-[color:var(--violet-border)] bg-[color:var(--violet-soft)] text-[color:var(--chart-5)]",
      badgeClassName:
        "border-[color:var(--violet-border)] bg-[color:var(--violet-soft)] text-[color:var(--chart-5)]",
    };
  }

  if (
    normalizedType.includes("document") ||
    normalizedType.includes("report")
  ) {
    return {
      label: normalizedType.includes("report") ? "Report" : "Document",
      icon: "document",
      href: normalizedType.includes("report")
        ? "/dashboard/reports"
        : "/dashboard/documents",
      iconClassName:
        "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
      badgeClassName:
        "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
    };
  }

  if (
    normalizedType.includes("password") ||
    normalizedType.includes("security")
  ) {
    return {
      label: "Security",
      icon: "security",
      href: "/dashboard/settings",
      iconClassName:
        "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
      badgeClassName:
        "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
    };
  }

  if (normalizedType.includes("suspended")) {
    return {
      label: "Access",
      icon: "suspended",
      href: "/dashboard/tasks",
      iconClassName:
        "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
      badgeClassName:
        "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
    };
  }

  if (
    normalizedType.includes("reactivated") ||
    normalizedType.includes("approved") ||
    normalizedType.includes("completed")
  ) {
    return {
      label: "Completed",
      icon: "success",
      href: null,
      iconClassName:
        "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
      badgeClassName:
        "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
    };
  }

  if (
    normalizedType.includes("profile") ||
    normalizedType.includes("employee") ||
    normalizedType.includes("team")
  ) {
    return {
      label: "Team",
      icon: "profile",
      href: "/dashboard/tasks",
      iconClassName:
        "border-[color:var(--violet-border)] bg-[color:var(--violet-soft)] text-[color:var(--chart-5)]",
      badgeClassName:
        "border-[color:var(--violet-border)] bg-[color:var(--violet-soft)] text-[color:var(--chart-5)]",
    };
  }

  return {
    label: "System",
    icon: "activity",
    href: null,
    iconClassName:
      "border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)]",
    badgeClassName:
      "border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)]",
  };
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatExactDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDay(value: string) {
  const date = new Date(value);
  const today = new Date();

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return formatExactDate(value);
}

function groupByDay(events: ActivityEvent[]) {
  return events.reduce<Record<string, ActivityEvent[]>>((groups, event) => {
    const label = formatDay(event.created_at);

    if (!groups[label]) {
      groups[label] = [];
    }

    groups[label].push(event);

    return groups;
  }, {});
}

function getActorName(event: ActivityEvent) {
  return (
    event.actor?.full_name ||
    event.actor?.email ||
    (event.actor_role
      ? `${event.actor_role.charAt(0).toUpperCase()}${event.actor_role.slice(1)} user`
      : "Helix System")
  );
}

function getActorInitials(event: ActivityEvent) {
  const actorName = getActorName(event);

  return actorName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isToday(value: string) {
  const date = new Date(value);
  const today = new Date();

  return date.toDateString() === today.toDateString();
}

function isWithinLastSevenDays(value: string) {
  const eventDate = new Date(value);
  const sevenDaysAgo = new Date();

  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  return eventDate >= sevenDaysAgo;
}

function getMostActiveCategory(events: ActivityEvent[]) {
  if (events.length === 0) return "No activity";

  const totals = events.reduce<Record<string, number>>((result, event) => {
    const category = getEventStyle(event.event_type).label;

    result[category] = (result[category] || 0) + 1;

    return result;
  }, {});

  return (
    Object.entries(totals).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "No activity"
  );
}

export default async function AdminActivityPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/admin/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, company_id, access_status")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin" ||
    !profile.company_id ||
    profile.access_status === "inactive"
  ) {
    redirect("/admin/login");
  }

  const [{ data: eventRows, error: eventsError }, notifications] =
    await Promise.all([
      supabase
        .from("activity_logs")
        .select(
          `
            id,
            company_id,
            actor_id,
            actor_role,
            event_type,
            title,
            description,
            reference_type,
            reference_id,
            action_url,
            severity,
            metadata,
            created_at
          `
        )
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false })
        .limit(100),

      getUserNotifications(user.id),
    ]);

  const rawEvents = (eventRows ?? []) as ActivityEventRow[];

  const actorIds = Array.from(
    new Set(
      rawEvents
        .map((event) => event.actor_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  let actorMap = new Map<string, ActivityActor>();

  if (actorIds.length > 0) {
    const { data: actorRows } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", actorIds);

    actorMap = new Map(
      ((actorRows ?? []) as ActivityActor[]).map((actor) => [
        actor.id,
        actor,
      ])
    );
  }

  const activityEvents: ActivityEvent[] = rawEvents.map((event) => ({
    ...event,
    actor: event.actor_id
      ? actorMap.get(event.actor_id) ?? null
      : null,
  }));

  const groupedEvents = groupByDay(activityEvents);

  const todayCount = activityEvents.filter((event) =>
    isToday(event.created_at)
  ).length;

  const sevenDayCount = activityEvents.filter((event) =>
    isWithinLastSevenDays(event.created_at)
  ).length;

  const mostActiveCategory = getMostActiveCategory(activityEvents);

  return (
    <AdminShell
      title="Activity"
      section="Financial Operating System"
      adminName={profile.full_name || profile.email || user.email || "Founder"}
      adminRole="Founder"
      showPageHeader={false}
      notifications={notifications}
      userId={user.id}
    >
      <div className="space-y-6 text-[color:var(--text-primary)]">
        {eventsError && (
          <div className="rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger)]">
            Activity could not be loaded: {eventsError.message}
          </div>
        )}
        <section className="overflow-hidden rounded-2xl border border-[color:var(--border-brand)] bg-[color:var(--surface-soft)]">
          <div className="relative px-6 py-7">
            <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-[color:var(--primary-soft)] blur-3xl" />

            <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--primary)]">
                    Company intelligence
                  </p>
                </div>

                <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-[color:var(--text-primary)]">
                  Activity &amp; Audit Trail
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--text-tertiary)]">
                  A chronological record of operational, financial and account
                  activity across your company.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
  <div className="inline-flex h-9 items-center gap-2 rounded-lg border border-[color:var(--success-border)] bg-[color:var(--success-soft)] px-3">
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--success)] opacity-30" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-[color:var(--success)]" />
    </span>

    <span className="whitespace-nowrap text-[11px] font-medium text-[color:var(--success)]">
      Event engine active
    </span>
  </div>

  <div className="inline-flex h-9 items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 text-[11px] text-[color:var(--text-tertiary)]">
    Last 100 events
  </div>
</div>
            </div>
          </div>

          <div className="grid border-t border-[color:var(--border)] sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Total events"
              value={activityEvents.length}
              note="Current timeline"
            />

            <Metric
              label="Today"
              value={todayCount}
              note="Events recorded today"
            />

            <Metric
              label="Last 7 days"
              value={sevenDayCount}
              note="Recent operating activity"
            />

            <Metric
              label="Most active"
              value={mostActiveCategory}
              note="Leading event category"
              last
            />
          </div>
        </section>

        <section className="rounded-2xl border border-[color:var(--border-brand)] bg-[color:var(--surface-soft)]">
          <div className="flex flex-col justify-between gap-4 border-b border-[color:var(--border)] px-6 py-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                Company timeline
              </p>
              <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
                Newest activity appears first.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-[color:var(--text-tertiary)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]" />
              {activityEvents.length} recorded{" "}
              {activityEvents.length === 1 ? "event" : "events"}
            </div>
          </div>

          {activityEvents.length > 0 ? (
            <div className="px-6 py-2">
              {Object.entries(groupedEvents).map(
                ([day, dayEvents], groupIndex) => (
                  <section
                    key={day}
                    className={
                      groupIndex === 0
                        ? "py-6"
                        : "border-t border-[color:var(--border)] py-6"
                    }
                  >
                    <div className="mb-5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                          {day}
                        </p>

                        <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2 py-1 text-[10px] text-[color:var(--text-tertiary)]">
                          {dayEvents.length}{" "}
                          {dayEvents.length === 1 ? "event" : "events"}
                        </span>
                      </div>

                      <div className="h-px flex-1 bg-[color:var(--surface-soft)]" />
                    </div>

                    <div>
                      {dayEvents.map((event, eventIndex) => {
                        const baseEventStyle = getEventStyle(event.event_type);
                        const eventStyle = {
                          ...baseEventStyle,
                          href: event.action_url || baseEventStyle.href,
                        };
                        const isLastEvent =
                          eventIndex === dayEvents.length - 1;

                        const content = (
                          <div className="group relative grid grid-cols-[44px_1fr] gap-4 sm:grid-cols-[72px_44px_1fr_auto]">
                            <div className="hidden pt-0.5 text-right sm:block">
                              <p className="text-xs font-medium text-[color:var(--text-secondary)]">
                                {formatTime(event.created_at)}
                              </p>
                            </div>

                            <div className="relative">
                              {!isLastEvent && (
                                <div className="absolute left-1/2 top-11 h-[calc(100%+16px)] w-px -translate-x-1/2 bg-[color:var(--surface-soft)]" />
                              )}

                              <div
                                className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-xl border ${eventStyle.iconClassName}`}
                              >
                                <EventIcon name={eventStyle.icon} />
                              </div>
                            </div>

                            <div
                              className={`min-w-0 ${
                                isLastEvent ? "pb-2" : "pb-7"
                              }`}
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                                  {event.title}
                                </p>

                                <span
                                  className={`rounded-md border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.11em] ${eventStyle.badgeClassName}`}
                                >
                                  {eventStyle.label}
                                </span>
                              </div>

                              {event.description && (
                                <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[color:var(--text-secondary)]">
                                  {event.description}
                                </p>
                              )}

                              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[9px] font-semibold text-[color:var(--primary)]">
                                    {getActorInitials(event)}
                                  </div>

                                  <span className="text-xs text-[color:var(--text-tertiary)]">
                                    {getActorName(event)}
                                  </span>
                                </div>

                                <span className="hidden h-1 w-1 rounded-full bg-[color:var(--surface-muted)] sm:block" />

                                <span className="text-xs text-[color:var(--text-muted)] sm:hidden">
                                  {formatTime(event.created_at)}
                                </span>

                                <span className="text-xs text-[color:var(--text-muted)]">
                                  Event ID {event.id.slice(0, 8)}
                                </span>
                              </div>
                            </div>

                            <div className="hidden items-start justify-end pt-1 sm:flex">
                              {eventStyle.href ? (
                                <span className="flex items-center gap-1.5 text-xs text-[color:var(--text-muted)] transition group-hover:text-[color:var(--primary)]">
                                  Open
                                  <ArrowUpRightIcon />
                                </span>
                              ) : (
                                <span className="text-xs text-[color:var(--text-muted)]">
                                  Logged
                                </span>
                              )}
                            </div>
                          </div>
                        );

                        if (eventStyle.href) {
                          return (
                            <Link
                              key={event.id}
                              href={eventStyle.href}
                              className="block rounded-xl px-3 py-3 transition hover:bg-[color:var(--surface-soft)]"
                            >
                              {content}
                            </Link>
                          );
                        }

                        return (
                          <div
                            key={event.id}
                            className="rounded-xl px-3 py-3"
                          >
                            {content}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )
              )}
            </div>
          ) : (
            <div className="px-6 py-16">
              <div className="mx-auto max-w-md text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
                  <EventIcon name="activity" />
                </div>

                <h2 className="mt-5 text-lg font-semibold text-[color:var(--text-primary)]">
                  Your audit trail is ready
                </h2>

                <p className="mt-2 text-sm leading-6 text-[color:var(--text-tertiary)]">
                  Company actions will appear here as inventory, sales,
                  expenses, tasks, documents and investor workflows emit
                  events.
                </p>

                <Link
                  href="/dashboard"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-4 py-2.5 text-sm font-medium text-[color:var(--primary)] transition hover:bg-[color:var(--primary-soft)]"
                >
                  Return to dashboard
                  <ArrowUpRightIcon />
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

function Metric({
  label,
  value,
  note,
  last,
}: {
  label: string;
  value: string | number;
  note: string;
  last?: boolean;
}) {
  return (
    <div
      className={`px-6 py-5 ${
        last
          ? ""
          : "border-b border-[color:var(--border)] sm:border-b-0 sm:border-r"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">
        {label}
      </p>

      <p className="mt-2 truncate text-xl font-semibold tracking-[-0.025em] text-[color:var(--text-primary)]">
        {value}
      </p>

      <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">{note}</p>
    </div>
  );
}

function EventIcon({ name }: { name: EventIconName }) {
  const commonProps = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "inventory") {
    return (
      <svg {...commonProps}>
        <path d="M21 8l-9 5-9-5" />
        <path d="M3 8l9-5 9 5v8l-9 5-9-5z" />
        <path d="M12 13v8" />
      </svg>
    );
  }

  if (name === "sale") {
    return (
      <svg {...commonProps}>
        <path d="M4 19V9" />
        <path d="M10 19V5" />
        <path d="M16 19v-7" />
        <path d="M22 19H2" />
      </svg>
    );
  }

  if (name === "expense") {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M16 8h-6a2 2 0 000 4h4a2 2 0 010 4H8" />
        <path d="M12 6v12" />
      </svg>
    );
  }

  if (name === "task") {
    return (
      <svg {...commonProps}>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8" />
        <path d="M8 12h5" />
        <path d="M8 16h7" />
      </svg>
    );
  }

  if (name === "investor") {
    return (
      <svg {...commonProps}>
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M15 7h6v6" />
      </svg>
    );
  }

  if (name === "document") {
    return (
      <svg {...commonProps}>
        <path d="M6 2h8l4 4v16H6z" />
        <path d="M14 2v5h5" />
        <path d="M9 13h6" />
        <path d="M9 17h6" />
      </svg>
    );
  }

  if (name === "security") {
    return (
      <svg {...commonProps}>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 018 0v3" />
        <path d="M12 14v3" />
      </svg>
    );
  }

  if (name === "profile") {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0116 0" />
      </svg>
    );
  }

  if (name === "suspended") {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M6 6l12 12" />
      </svg>
    );
  }

  if (name === "success") {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12l3 3 5-6" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M4 18V9" />
      <path d="M10 18V5" />
      <path d="M16 18v-7" />
      <path d="M22 18H2" />
    </svg>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17L17 7" />
      <path d="M7 7h10v10" />
    </svg>
  );
}