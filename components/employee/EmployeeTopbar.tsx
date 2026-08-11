"use client";

import LogoutButton from "@/components/auth/LogoutButton";
import NotificationBell from "@/components/notifications/NotificationBell";
import type { Notification } from "@/types/notifications";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notifications/actions";

type EmployeeTopbarProps = {
  name: string;
  notifications: Notification[];
  userId: string;
};

export default function EmployeeTopbar({
  name,
  notifications,
  userId,
}: EmployeeTopbarProps) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 flex h-20 items-center justify-between border-b border-[var(--primary-border)] bg-[var(--navbar-bg)] px-8 backdrop-blur-xl">
      <div>
        <p className="text-sm text-[var(--primary)]">Employee Workspace</p>

        <h1 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
          Dashboard
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <NotificationBell
          initialNotifications={notifications}
          userId={userId}
          markNotificationRead={markNotificationRead}
          markAllNotificationsRead={markAllNotificationsRead}
        />

        <div className="flex items-center gap-3 rounded-xl border border-[var(--primary-border)] bg-[var(--surface-soft)] px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)]">
            {initials}
          </div>

          <div className="text-left">
            <p className="text-sm font-medium text-[var(--text-primary)]">{name}</p>
            <p className="text-xs text-[var(--text-tertiary)]">Employee</p>
          </div>
        </div>

        <LogoutButton />
      </div>
    </header>
  );
}