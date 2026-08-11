"use client";

import { Bell } from "lucide-react";
import { useState, useTransition } from "react";

import { markInvestorNotificationReadInline } from "@/lib/actions/investor-portal";
import type { InvestorPortalNotification } from "@/types/investor-portal";

function dateLabel(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function InvestorNotificationBell({
  notifications,
}: {
  notifications: InvestorPortalNotification[];
}) {
  const [open, setOpen] = useState(false);
  const [localNotifications, setLocalNotifications] = useState(notifications);
  const [isPending, startTransition] = useTransition();
  const unreadCount = localNotifications.filter((notice) => !notice.readAt).length;
  const latest = localNotifications.slice(0, 8);

  function markRead(notificationId: string) {
    setLocalNotifications((items) =>
      items.map((item) =>
        item.id === notificationId
          ? { ...item, readAt: item.readAt || new Date().toISOString() }
          : item,
      ),
    );

    startTransition(() => {
      void markInvestorNotificationReadInline(notificationId);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] transition hover:border-[var(--primary-border)] hover:text-[var(--primary)]"
        aria-label="Notifications"
      >
        <Bell className="h-[17px] w-[17px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-[var(--text-primary)]">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[22rem] overflow-hidden rounded-2xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-dropdown)]">
          <div className="border-b border-[var(--border)] p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Notifications</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  Investor updates from offers, documents and certificates.
                </p>
              </div>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[var(--primary-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--primary)]">
                  {unreadCount} new
                </span>
              )}
            </div>
          </div>

          <div className="max-h-[28rem] overflow-y-auto p-2">
            {latest.map((notice) => (
              <div
                key={notice.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{notice.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">{notice.message}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--text-primary)]">
                      {dateLabel(notice.createdAt)}
                    </p>
                  </div>
                  {!notice.readAt && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => markRead(notice.id)}
                      className="shrink-0 rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--primary)] disabled:opacity-60"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            ))}

            {!latest.length && (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
                No investor notifications yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}