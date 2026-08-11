"use client";

import LogoutButton from "@/components/auth/LogoutButton";

export default function Topbar() {
  return (
    <header className="sticky top-0 z-40 flex h-20 items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--navbar-bg)] px-8 backdrop-blur-xl">

      {/* Left */}

      <div>
        <p className="text-sm text-[color:var(--primary)]">
          Financial Operating System
        </p>

        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
          Dashboard
        </h1>
      </div>

      {/* Right */}

      <div className="flex items-center gap-5">

        {/* Search */}

        <div className="relative">
          <input
            placeholder="Search..."
            className="w-72 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-5 py-3 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--primary)]"
          />

          <svg
            className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--text-tertiary)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
        </div>

        {/* Notifications */}

        <button className="relative flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] transition hover:border-[color:var(--border-brand)]">

          🔔

          <span className="absolute right-3 top-3 h-2 w-2 rounded-[var(--radius-pill)] bg-[color:var(--primary)]" />

        </button>

        {/* User */}

<button className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 transition hover:border-[color:var(--border-brand)]">

  <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] bg-[color:var(--primary-soft-hover)] font-semibold text-[color:var(--primary)]">
    ZA
  </div>

  <div className="text-left">

    <p className="text-sm font-medium text-[color:var(--text-primary)]">
      Zeeshan
    </p>

    <p className="text-xs text-[color:var(--text-secondary)]">
      Founder
    </p>

  </div>

</button>

{/* Logout */}

<LogoutButton />

      </div>

    </header>
  );
}