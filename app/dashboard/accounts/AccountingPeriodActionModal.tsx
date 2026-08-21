"use client";

import type { AccountingPeriod } from "./page";

type PeriodAction = "soft_close" | "reopen" | "lock";

type Props = {
  period: AccountingPeriod;
  mode: PeriodAction;
  action: (formData: FormData) => void;
  onClose: () => void;
};

const content = {
  soft_close: {
    title: "Soft Close Accounting Period",
    description:
      "Routine posting will be restricted for this period. The period may still be reopened later if an authorised correction is required.",
    button: "Soft Close Period",
  },
  reopen: {
    title: "Reopen Accounting Period",
    description:
      "This will return the period to Open status so General Ledger posting can resume.",
    button: "Reopen Period",
  },
  lock: {
    title: "Lock Accounting Period",
    description:
      "Locking is permanent through the normal Helix accounting workflow. Once locked, this period cannot be reopened and historical postings remain protected.",
    button: "Lock Permanently",
  },
} satisfies Record<
  PeriodAction,
  {
    title: string;
    description: string;
    button: string;
  }
>;

export default function AccountingPeriodActionModal({
  period,
  mode,
  action,
  onClose,
}: Props) {
  const details = content[mode];
  const isLock = mode === "lock";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[560px] overflow-hidden rounded-3xl border border-[color:var(--border-brand)] bg-[color:var(--surface)] shadow-[var(--shadow-modal)]">
        <div className="flex items-start justify-between border-b border-[color:var(--border)] px-6 py-5">
          <div>
            <h2 className="text-[17px] font-semibold text-[color:var(--text-primary)]">
              {details.title}
            </h2>

            <p className="mt-1 max-w-md text-[11px] leading-5 text-[color:var(--text-tertiary)]">
              {details.description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)]"
          >
            ×
          </button>
        </div>

        <form action={action} className="space-y-5 p-6">
          <input
            type="hidden"
            name="period_id"
            value={period.id}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
              <div className="text-[9px] uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">
                Fiscal Year
              </div>
              <div className="mt-2 text-[13px] font-semibold text-[color:var(--text-primary)]">
                {period.fiscal_year_label}
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
              <div className="text-[9px] uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">
                Period
              </div>
              <div className="mt-2 text-[13px] font-semibold text-[color:var(--text-primary)]">
                {period.period_number} · {period.name}
              </div>
            </div>
          </div>

          {isLock && (
            <div className="rounded-2xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] p-4">
              <div className="text-[11px] font-semibold text-[color:var(--danger)]">
                Permanent accounting lock
              </div>

              <p className="mt-1 text-[10px] leading-5 text-[color:var(--text-secondary)]">
                Confirm only when this period is final. Helix will
                not allow it to be reopened through the ordinary
                accounting workflow.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-[color:var(--border)] pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-2.5 text-[12px] font-medium text-[color:var(--text-secondary)]"
            >
              Cancel
            </button>

            <button
              type="submit"
              className={
                isLock
                  ? "rounded-xl bg-[color:var(--danger)] px-5 py-2.5 text-[12px] font-semibold text-white"
                  : "rounded-xl bg-[color:var(--primary)] px-5 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[color:var(--primary-hover)]"
              }
            >
              {details.button}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
