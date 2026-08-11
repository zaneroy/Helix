"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/types/notifications";

type Props = {
  initialNotifications: Notification[];
  userId: string;
  markNotificationRead: (formData: FormData) => void;
  markAllNotificationsRead: (formData: FormData) => void;
};

export default function NotificationBell({
  initialNotifications,
  userId,
  markNotificationRead,
  markAllNotificationsRead,
}: Props) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [isPending, startTransition] = useTransition();

  const unreadCount = useMemo(() => {
    return notifications.filter((item) => !item.read).length;
  }, [notifications]);

  useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          window.location.reload();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3 transition hover:border-[color:var(--border-brand)]"
      >
        🔔

        {unreadCount > 0 && (
          <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-pill)] bg-[color:var(--primary)] px-1 text-[10px] font-bold text-[color:var(--text-on-brand)] shadow-[var(--shadow-brand)]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-14 z-50 w-[var(--notification-panel-width)] overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--border-brand)] bg-[color:var(--popover-bg)] shadow-[var(--shadow-modal)]">
          <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">Notifications</p>
              <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                {unreadCount} unread update{unreadCount === 1 ? "" : "s"}
              </p>
            </div>

            {unreadCount > 0 && (
              <form
                action={(formData) => {
                  startTransition(() => {
                    markAllNotificationsRead(formData);
                  });
                }}
              >
                <input type="hidden" name="user_id" value={userId} />
                <button
                  disabled={isPending}
                  className="rounded-[var(--radius-md)] border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-3 py-2 text-xs text-[color:var(--primary)] disabled:opacity-50"
                >
                  Mark all read
                </button>
              </form>
            )}
          </div>

          <div className="max-h-[520px] overflow-y-auto p-3">
            {notifications.length ? (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    markNotificationRead={markNotificationRead}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-6 text-sm text-[color:var(--text-secondary)]">
                No notifications yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  notification,
  markNotificationRead,
}: {
  notification: Notification;
  markNotificationRead: (formData: FormData) => void;
}) {
  const unread = !notification.read;

  return (
    <div
      className={`rounded-[var(--radius-md)] border p-4 ${
        unread
          ? "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)]"
          : "border-[color:var(--border)] bg-[color:var(--surface-soft)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-1 h-2.5 w-2.5 rounded-[var(--radius-pill)] ${
            unread ? "bg-[color:var(--primary)]" : "bg-[color:var(--neutral-300)]"
          }`}
        />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[color:var(--text-primary)]">{notification.title}</p>

          {notification.message && (
            <p className="mt-1 text-xs leading-5 text-[color:var(--text-secondary)]">
              {notification.message}
            </p>
          )}

          <p className="mt-2 text-xs text-[color:var(--text-muted)]">
            {formatDateTime(notification.created_at)}
          </p>

          {unread && (
            <form action={markNotificationRead} className="mt-3">
              <input
                type="hidden"
                name="notification_id"
                value={notification.id}
              />

              <button className="rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-xs text-[color:var(--text-primary)] hover:text-[color:var(--primary)]">
                Mark read
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}