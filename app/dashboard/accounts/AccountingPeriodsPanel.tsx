"use client";

import { useState } from "react";
import type { AccountingPeriod } from "./page";
import CreateFiscalYearModal from "./CreateFiscalYearModal";
import AccountingPeriodActionModal from "./AccountingPeriodActionModal";

type Props = {
  periods: AccountingPeriod[];
  createAccountingFiscalYear: (
    formData: FormData
  ) => void;
  softCloseAccountingPeriod: (
    formData: FormData
  ) => void;
  reopenAccountingPeriod: (
    formData: FormData
  ) => void;
  lockAccountingPeriod: (
    formData: FormData
  ) => void;
};

type PeriodActionMode =
  | "soft_close"
  | "reopen"
  | "lock";

function formatDate(value: string) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(`${value}T00:00:00`));
  } catch {
    return value;
  }
}

function statusLabel(
  status: AccountingPeriod["status"]
) {
  if (status === "soft_closed") {
    return "Soft Closed";
  }

  if (status === "locked") {
    return "Locked";
  }

  return "Open";
}

function statusClasses(
  status: AccountingPeriod["status"]
) {
  if (status === "locked") {
    return "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]";
  }

  if (status === "soft_closed") {
    return "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]";
  }

  return "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]";
}

export default function AccountingPeriodsPanel({
  periods,
  createAccountingFiscalYear,
  softCloseAccountingPeriod,
  reopenAccountingPeriod,
  lockAccountingPeriod,
}: Props) {
  const [createOpen, setCreateOpen] =
    useState(false);

  const [periodAction, setPeriodAction] =
    useState<{
      period: AccountingPeriod;
      mode: PeriodActionMode;
    } | null>(null);

  const openCount = periods.filter(
    (period) => period.status === "open"
  ).length;

  const softClosedCount = periods.filter(
    (period) => period.status === "soft_closed"
  ).length;

  const lockedCount = periods.filter(
    (period) => period.status === "locked"
  ).length;

  const adjustmentCount = periods.filter(
    (period) => period.is_adjustment_period
  ).length;

  return (
    <section className="rounded-2xl border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
      <div className="border-b border-[color:var(--border)] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">
                Accounting Periods
              </h2>

              <span className="rounded-full border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--primary)]">
                {periods.length} periods
              </span>
            </div>

            <p className="mt-2 max-w-3xl text-[12px] leading-5 text-[color:var(--text-tertiary)]">
              Fiscal periods control when General Ledger
              activity may be posted. Open periods accept
              normal postings, soft-closed periods are
              restricted, and locked periods are final.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded-xl bg-[color:var(--primary)] px-4 py-2.5 font-semibold text-white transition hover:bg-[color:var(--primary-hover)]"
            >
              + Set Up Fiscal Year
            </button>

            <span className="rounded-lg border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-3 py-2 text-[color:var(--primary)]">
              {openCount} open
            </span>

            {softClosedCount > 0 && (
              <span className="rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-3 py-2 text-[color:var(--warning)]">
                {softClosedCount} soft closed
              </span>
            )}

            {lockedCount > 0 && (
              <span className="rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-3 py-2 text-[color:var(--danger)]">
                {lockedCount} locked
              </span>
            )}

            {adjustmentCount > 0 && (
              <span className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-[color:var(--text-secondary)]">
                {adjustmentCount} adjustment
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-h-[520px] overflow-auto overscroll-contain">
        <table className="w-full min-w-[1180px] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[color:var(--surface-soft)] text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-tertiary)]">
            <tr className="border-b border-[color:var(--border)]">
              <th className="px-5 py-4">
                Fiscal Year
              </th>

              <th className="px-5 py-4">
                Period
              </th>

              <th className="px-5 py-4">
                Name
              </th>

              <th className="px-5 py-4">
                Start
              </th>

              <th className="px-5 py-4">
                End
              </th>

              <th className="px-5 py-4">
                Type
              </th>

              <th className="px-5 py-4">
                Status
              </th>

              <th className="px-5 py-4 text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {periods.length > 0 ? (
              periods.map((period) => (
                <tr
                  key={period.id}
                  className="border-b border-[color:var(--border)] last:border-b-0 hover:bg-[color:var(--surface-soft)]"
                >
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="text-[12px] font-semibold text-[color:var(--text-primary)]">
                      {period.fiscal_year_label}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="font-mono text-[12px] font-semibold text-[color:var(--primary)]">
                      {period.period_number}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <div className="text-[13px] font-medium text-[color:var(--text-primary)]">
                      {period.name}
                    </div>

                    {period.notes && (
                      <div className="mt-1 max-w-[360px] text-[11px] leading-4 text-[color:var(--text-tertiary)]">
                        {period.notes}
                      </div>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-5 py-4 text-[12px] text-[color:var(--text-secondary)]">
                    {formatDate(
                      period.start_date
                    )}
                  </td>

                  <td className="whitespace-nowrap px-5 py-4 text-[12px] text-[color:var(--text-secondary)]">
                    {formatDate(
                      period.end_date
                    )}
                  </td>

                  <td className="whitespace-nowrap px-5 py-4">
                    {period.is_adjustment_period ? (
                      <span className="rounded-lg border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-2.5 py-1.5 text-[10px] font-medium text-[color:var(--primary)]">
                        Adjustment
                      </span>
                    ) : (
                      <span className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2.5 py-1.5 text-[10px] font-medium text-[color:var(--text-secondary)]">
                        Normal
                      </span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-5 py-4">
                    <span
                      className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-medium ${statusClasses(
                        period.status
                      )}`}
                    >
                      {statusLabel(
                        period.status
                      )}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {period.status ===
                        "open" && (
                        <button
                          type="button"
                          onClick={() =>
                            setPeriodAction({
                              period,
                              mode: "soft_close",
                            })
                          }
                          className="rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-3 py-2 text-[11px] font-medium text-[color:var(--warning)] transition"
                        >
                          Soft Close
                        </button>
                      )}

                      {period.status ===
                        "soft_closed" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setPeriodAction({
                                period,
                                mode: "reopen",
                              })
                            }
                            className="rounded-lg border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-3 py-2 text-[11px] font-medium text-[color:var(--primary)] transition"
                          >
                            Reopen
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setPeriodAction({
                                period,
                                mode: "lock",
                              })
                            }
                            className="rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-3 py-2 text-[11px] font-medium text-[color:var(--danger)] transition"
                          >
                            Lock
                          </button>
                        </>
                      )}

                      {period.status ===
                        "locked" && (
                        <span className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-[10px] font-medium text-[color:var(--text-tertiary)]">
                          Protected
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-16 text-center"
                >
                  <div className="text-sm font-medium text-[color:var(--text-secondary)]">
                    No accounting periods
                    configured yet.
                  </div>

                  <p className="mx-auto mt-2 max-w-xl text-[11px] leading-5 text-[color:var(--text-tertiary)]">
                    Set up a fiscal year to
                    automatically create monthly
                    General Ledger periods.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[color:var(--border)] px-5 py-4">
        <p className="text-[11px] text-[color:var(--text-tertiary)]">
          Accounting periods are part of the
          authoritative General Ledger posting
          controls.
        </p>
      </div>

      {createOpen && (
        <CreateFiscalYearModal
          action={createAccountingFiscalYear}
          onClose={() =>
            setCreateOpen(false)
          }
        />
      )}

      {periodAction && (
        <AccountingPeriodActionModal
          period={periodAction.period}
          mode={periodAction.mode}
          action={
            periodAction.mode ===
            "soft_close"
              ? softCloseAccountingPeriod
              : periodAction.mode ===
                  "reopen"
                ? reopenAccountingPeriod
                : lockAccountingPeriod
          }
          onClose={() =>
            setPeriodAction(null)
          }
        />
      )}
    </section>
  );
}