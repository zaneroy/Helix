"use client";

import type {
  AccountingAccount,
  AccountingPeriod,
  JournalEntry,
  JournalLine,
} from "./page";

type Props = {
  entry: JournalEntry;
  lines: JournalLine[];
  accounts: AccountingAccount[];
  periods: AccountingPeriod[];
  onClose: () => void;
};

function formatMoney(
  value: number | string,
  currency: string
) {
  const amount = Number(value || 0);

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatDate(value: string) {
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

function statusLabel(status: JournalEntry["status"]) {
  if (status === "posted") {
    return "Posted";
  }

  if (status === "reversed") {
    return "Reversed";
  }

  return "Draft";
}

function statusClasses(status: JournalEntry["status"]) {
  if (status === "posted") {
    return "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]";
  }

  if (status === "reversed") {
    return "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]";
  }

  return "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]";
}

export default function JournalEntryDetailsModal({
  entry,
  lines,
  accounts,
  periods,
  onClose,
}: Props) {
  const period = periods.find(
    (item) => item.id === entry.accounting_period_id
  );

  const totalDebit = lines.reduce(
    (total, line) =>
      total + Number(line.base_debit || 0),
    0
  );

  const totalCredit = lines.reduce(
    (total, line) =>
      total + Number(line.base_credit || 0),
    0
  );

  const balanced =
    Math.abs(totalDebit - totalCredit) < 0.0001;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-[980px] overflow-y-auto rounded-3xl border border-[color:var(--border-brand)] bg-[color:var(--surface)] shadow-[var(--shadow-modal)]">
        <div className="flex items-start justify-between border-b border-[color:var(--border)] px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[17px] font-semibold text-[color:var(--text-primary)]">
                {entry.entry_number
                  ? `Journal Entry #${entry.entry_number}`
                  : "Draft Journal Entry"}
              </h2>

              <span
                className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-medium ${statusClasses(
                  entry.status
                )}`}
              >
                {statusLabel(entry.status)}
              </span>
            </div>

            <p className="mt-2 text-[12px] text-[color:var(--text-secondary)]">
              {entry.description}
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

        <div className="grid gap-3 border-b border-[color:var(--border)] p-6 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
            <div className="text-[9px] uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">
              Entry Date
            </div>
            <div className="mt-2 text-[12px] font-semibold text-[color:var(--text-primary)]">
              {formatDate(entry.entry_date)}
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
            <div className="text-[9px] uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">
              Accounting Period
            </div>
            <div className="mt-2 text-[12px] font-semibold text-[color:var(--text-primary)]">
              {period
                ? `${period.fiscal_year_label} · ${period.name}`
                : "Not assigned"}
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
            <div className="text-[9px] uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">
              Source
            </div>
            <div className="mt-2 text-[12px] font-semibold capitalize text-[color:var(--text-primary)]">
              {entry.source_type || "Manual"}
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
            <div className="text-[9px] uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">
              Reference
            </div>
            <div className="mt-2 text-[12px] font-semibold text-[color:var(--text-primary)]">
              {entry.reference || "—"}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead className="bg-[color:var(--surface-soft)] text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-tertiary)]">
              <tr className="border-b border-[color:var(--border)]">
                <th className="px-5 py-4">
                  Line
                </th>

                <th className="px-5 py-4">
                  GL Account
                </th>

                <th className="px-5 py-4">
                  Description
                </th>

                <th className="px-5 py-4 text-right">
                  Debit
                </th>

                <th className="px-5 py-4 text-right">
                  Credit
                </th>
              </tr>
            </thead>

            <tbody>
              {lines.map((line) => {
                const account = accounts.find(
                  (item) => item.id === line.account_id
                );

                return (
                  <tr
                    key={line.id}
                    className="border-b border-[color:var(--border)] last:border-b-0"
                  >
                    <td className="px-5 py-4 font-mono text-[11px] text-[color:var(--text-tertiary)]">
                      {line.line_number}
                    </td>

                    <td className="px-5 py-4">
                      <div className="text-[12px] font-semibold text-[color:var(--text-primary)]">
                        {account
                          ? `${account.code} — ${account.name}`
                          : line.account_id}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-[11px] text-[color:var(--text-secondary)]">
                      {line.description || "—"}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right text-[12px] font-medium text-[color:var(--text-primary)]">
                      {Number(line.debit || 0) > 0
                        ? formatMoney(
                            line.debit,
                            line.currency_code
                          )
                        : "—"}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right text-[12px] font-medium text-[color:var(--text-primary)]">
                      {Number(line.credit || 0) > 0
                        ? formatMoney(
                            line.credit,
                            line.currency_code
                          )
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[color:var(--border)] p-6">
          <div className="ml-auto grid max-w-[440px] gap-3">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-[color:var(--text-secondary)]">
                Total Debit
              </span>

              <span className="font-semibold text-[color:var(--text-primary)]">
                {formatMoney(
                  totalDebit,
                  entry.base_currency_code
                )}
              </span>
            </div>

            <div className="flex items-center justify-between text-[12px]">
              <span className="text-[color:var(--text-secondary)]">
                Total Credit
              </span>

              <span className="font-semibold text-[color:var(--text-primary)]">
                {formatMoney(
                  totalCredit,
                  entry.base_currency_code
                )}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-[color:var(--border)] pt-3">
              <span className="text-[12px] font-semibold text-[color:var(--text-primary)]">
                Balance Check
              </span>

              <span
                className={
                  balanced
                    ? "rounded-lg border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-3 py-2 text-[10px] font-semibold text-[color:var(--primary)]"
                    : "rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-3 py-2 text-[10px] font-semibold text-[color:var(--danger)]"
                }
              >
                {balanced
                  ? "Balanced"
                  : "Out of Balance"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}