"use client";

import {
  Bell,
  CheckCheck,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  PackageSearch,
  ReceiptText,
  ShoppingCart,
  X,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import {
  markAllEmployeeNotificationsReadInline,
  markEmployeeNotificationReadInline,
} from "@/lib/actions/employee-portal";

type JsonRecord = Record<string, unknown>;

type EmployeeNotificationLike = {
  id: string;
  title?: string | null;
  message?: string | null;
  type?: string | null;
  actionUrl?: string | null;
  action_url?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  readAt?: string | null;
  read_at?: string | null;
  metadata?: JsonRecord | null;
};

type Props = {
  notifications?: EmployeeNotificationLike[];
  unreadCount?: number;
  model?: {
    notifications?: EmployeeNotificationLike[];
    summary?: {
      unreadNotificationCount?: number;
    };
  };
};

function notificationText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function notificationDate(notification: EmployeeNotificationLike): string {
  return (
    notificationText(notification.createdAt) ||
    notificationText(notification.created_at) ||
    new Date().toISOString()
  );
}

function notificationReadAt(notification: EmployeeNotificationLike): string {
  return notificationText(notification.readAt) || notificationText(notification.read_at);
}

function notificationActionUrl(notification: EmployeeNotificationLike): string {
  return notificationText(notification.actionUrl) || notificationText(notification.action_url);
}

function isEmployeeRelevantNotification(notification: EmployeeNotificationLike): boolean {
  const type = notificationText(notification.type).toLowerCase();
  const title = notificationText(notification.title).toLowerCase();
  const message = notificationText(notification.message).toLowerCase();
  const actionUrl = notificationActionUrl(notification).toLowerCase();
  const haystack = `${type} ${title} ${message} ${actionUrl}`;

  const blocked = [
    "investor",
    "capital",
    "equity",
    "share",
    "certificate",
    "agreement",
    "offer pdf",
    "agreement pdf",
    "founder/admin capital",
    "dividend",
    "buyback",
    "valuation",
  ];

  if (blocked.some((word) => haystack.includes(word))) return false;

  if (actionUrl.startsWith("/employee")) return true;
  if (type.startsWith("employee_")) return true;

  return [
    "task",
    "expense",
    "sale",
    "inventory",
    "stock",
    "low-stock",
    "low_stock",
  ].some((word) => haystack.includes(word));
}

function notificationIcon(notification: EmployeeNotificationLike) {
  const type = notificationText(notification.type).toLowerCase();
  const title = notificationText(notification.title).toLowerCase();
  const message = notificationText(notification.message).toLowerCase();
  const haystack = `${type} ${title} ${message}`;

  if (haystack.includes("task")) return ClipboardList;
  if (haystack.includes("expense")) return ReceiptText;
  if (haystack.includes("sale")) return ShoppingCart;
  if (haystack.includes("stock") || haystack.includes("inventory")) return PackageSearch;

  return CircleAlert;
}

function formatNotificationDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function EmployeeNotificationBell({ notifications, unreadCount, model }: Props) {
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const scopedNotifications = useMemo(() => {
    return (notifications || model?.notifications || [])
      .filter((notification) => notification?.id)
      .filter(isEmployeeRelevantNotification)
      .slice(0, 12);
  }, [notifications, model?.notifications]);

  const visibleUnreadTotal = scopedNotifications.filter(
    (notification) => !notificationReadAt(notification),
  ).length;

  function markOne(notificationId: string) {
    setPendingId(notificationId);

    startTransition(() => {
      void (async () => {
        await markEmployeeNotificationReadInline(notificationId);
        setPendingId(null);
      })();
    });
  }

  function markAll() {
    setPendingId("all");

    startTransition(() => {
      void (async () => {
        await markAllEmployeeNotificationsReadInline();
        setPendingId(null);
      })();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative grid h-14 w-14 place-items-center rounded-2xl border border-[var(--primary-border)] bg-[var(--surface-soft)] text-[var(--primary)] shadow-[var(--shadow-md)] transition hover:border-[var(--primary-border)] hover:bg-[var(--primary-soft)]"
        aria-label="Employee notifications"
      >
        <Bell className="h-5 w-5" />

        {visibleUnreadTotal > 0 && (
          <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-[var(--primary)] px-1.5 text-[10px] font-bold text-[var(--text-on-brand)] shadow-[var(--glow-brand)]">
            {visibleUnreadTotal > 9 ? "9+" : visibleUnreadTotal}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.8rem)] z-50 w-[min(440px,calc(100vw-2rem))] overflow-hidden rounded-[1.4rem] border border-[var(--primary-border)] bg-[var(--popover-bg)] shadow-[var(--shadow-dropdown)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--primary)]">
                Employee notifications
              </p>
              <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                Notifications
              </h3>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                {visibleUnreadTotal} unread · employee-only updates
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={markAll}
                disabled={isPending || visibleUnreadTotal === 0}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 text-xs font-medium text-[var(--primary)] transition hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <CheckCheck className="h-4 w-4" />
                Read all
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                aria-label="Close notifications"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[520px] overflow-y-auto">
            {scopedNotifications.length ? (
              scopedNotifications.map((notification) => {
                const Icon = notificationIcon(notification);
                const isUnread = !notificationReadAt(notification);
                const date = formatNotificationDate(notificationDate(notification));

                return (
                  <div
                    key={notification.id}
                    className={[
                      "group border-b border-[var(--border)] px-5 py-4 transition last:border-b-0",
                      isUnread ? "bg-[var(--primary-soft)]" : "bg-transparent",
                    ].join(" ")}
                  >
                    <div className="flex gap-3">
                      <div
                        className={[
                          "grid h-11 w-11 shrink-0 place-items-center rounded-xl border",
                          isUnread
                            ? "border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]"
                            : "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-tertiary)]",
                        ].join(" ")}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                              {notification.title || "Employee update"}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-tertiary)]">
                              {notification.message || "No notification details."}
                            </p>
                          </div>

                          <span className="shrink-0 text-[11px] text-[var(--text-tertiary)]">
                            {date}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className="rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                            {notification.type
                              ? notification.type.replaceAll("_", " ")
                              : "employee"}
                          </span>

                          {isUnread ? (
                            <button
                              type="button"
                              disabled={isPending && pendingId === notification.id}
                              onClick={() => markOne(notification.id)}
                              className="inline-flex items-center gap-2 rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1.5 text-[11px] font-medium text-[var(--primary)] transition hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Mark read
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-2 text-[11px] text-[var(--text-tertiary)]">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Read
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-5 py-10 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]">
                  <Bell className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm font-semibold text-[var(--text-primary)]">
                  No employee notifications
                </p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  Task, sale, inventory and expense updates will appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { EmployeeNotificationBell };
export default EmployeeNotificationBell;
