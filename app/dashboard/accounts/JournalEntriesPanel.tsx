"use client";

import { useMemo, useState } from "react";
import type {
  AccountingAccount,
  AccountingPeriod,
  JournalEntry,
  JournalLine,
} from "./page";
import JournalEntryDetailsModal from "./JournalEntryDetailsModal";

type StatusFilter =
  | "all"
  | "draft"
  | "posted"
  | "reversed";

type Props = {
  entries: JournalEntry[];
  lines: JournalLine[];
  accounts: AccountingAccount[];
  periods: AccountingPeriod[];
};

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

function formatMoney(
  value: number,
  currency: string
) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
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

export default function JournalEntriesPanel({
  entries,
  lines,
  accounts,
  periods,
}: Props) {
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [search, setSearch] =
    useState("");

  const [selectedEntry, setSelectedEntry] =
    useState<JournalEntry | null>(null);

  const linesByEntry = useMemo(() => {
    const map = new Map<string, JournalLine[]>();

    for (const line of lines) {
      const current =
        map.get(line.journal_entry_id) || [];

      current.push(line);

      map.set(
        line.journal_entry_id,
        current
      );
    }

    return map;
  }, [lines]);

  const visibleEntries = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return entries.filter((entry) => {
      if (
        statusFilter !== "all" &&
        entry.status !== statusFilter
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        entry.entry_number
          ? String(entry.entry_number)
          : "",
        entry.description,
        entry.reference || "",
        entry.source_type,
        entry.source_action || "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(
        normalizedSearch
      );
    });
  }, [
    entries,
    search,
    statusFilter,
  ]);

  const draftCount = entries.filter(
    (entry) => entry.status === "draft"
  ).length;

  const postedCount = entries.filter(
    (entry) => entry.status === "posted"
  ).length;

  const reversedCount = entries.filter(
    (entry) => entry.status === "reversed"
  ).length;

  return (
    <section className="rounded-2xl border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
      <div className="border-b border-[color:var(--border)] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">
                Journal Entries
              </h2>

              <span className="rounded-full border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--primary)]">
                {entries.length} entries
              </span>
            </div>

            <p className="mt-2 max-w-3xl text-[12px] leading-5 text-[color:var(--text-tertiary)]">
              Journal entries are the double-entry
              accounting records that feed the
              authoritative General Ledger.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            {draftCount > 0 && (
              <span className="rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-3 py-2 text-[color:var(--warning)]">
                {draftCount} draft
              </span>
            )}

            {postedCount > 0 && (
              <span className="rounded-lg border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-3 py-2 text-[color:var(--primary)]">
                {postedCount} posted
              </span>
            )}

            {reversedCount > 0 && (
              <span className="rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-3 py-2 text-[color:var(--danger)]">
                {reversedCount} reversed
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "All"],
                ["draft", "Draft"],
                ["posted", "Posted"],
                ["reversed", "Reversed"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setStatusFilter(value)
                }
                className={
                  statusFilter === value
                    ? "rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-3 py-2 text-[11px] font-medium text-[color:var(--primary)]"
                    : "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-[11px] font-medium text-[color:var(--text-secondary)]"
                }
              >
                {label}
              </button>
            ))}
          </div>

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search journal entries..."
            className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-2.5 text-[12px] text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--border-brand)] xl:max-w-[300px]"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse text-left">
          <thead className="bg-[color:var(--surface-soft)] text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-tertiary)]">
            <tr className="border-b border-[color:var(--border)]">
              <th className="px-5 py-4">
                Journal
              </th>

              <th className="px-5 py-4">
                Date
              </th>

              <th className="px-5 py-4">
                Description
              </th>

              <th className="px-5 py-4">
                Source
              </th>

              <th className="px-5 py-4 text-right">
                Debit
              </th>

              <th className="px-5 py-4 text-right">
                Credit
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
            {visibleEntries.length > 0 ? (
              visibleEntries.map((entry) => {
                const entryLines =
                  linesByEntry.get(entry.id) || [];

                const totalDebit =
                  entryLines.reduce(
                    (total, line) =>
                      total +
                      Number(
                        line.base_debit || 0
                      ),
                    0
                  );

                const totalCredit =
                  entryLines.reduce(
                    (total, line) =>
                      total +
                      Number(
                        line.base_credit || 0
                      ),
                    0
                  );

                return (
                  <tr
                    key={entry.id}
                    className="border-b border-[color:var(--border)] last:border-b-0 hover:bg-[color:var(--surface-soft)]"
                  >
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className="font-mono text-[12px] font-semibold text-[color:var(--primary)]">
                        {entry.entry_number
                          ? `JE #${entry.entry_number}`
                          : "DRAFT"}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-[12px] text-[color:var(--text-secondary)]">
                      {formatDate(
                        entry.entry_date
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <div className="max-w-[320px] text-[12px] font-semibold text-[color:var(--text-primary)]">
                        {entry.description}
                      </div>

                      {entry.reference && (
                        <div className="mt-1 text-[10px] text-[color:var(--text-tertiary)]">
                          Ref: {entry.reference}
                        </div>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-[11px] capitalize text-[color:var(--text-secondary)]">
                      {entry.source_type}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right text-[12px] font-medium text-[color:var(--text-primary)]">
                      {formatMoney(
                        totalDebit,
                        entry.base_currency_code
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right text-[12px] font-medium text-[color:var(--text-primary)]">
                      {formatMoney(
                        totalCredit,
                        entry.base_currency_code
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <span
                        className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-medium ${statusClasses(
                          entry.status
                        )}`}
                      >
                        {statusLabel(
                          entry.status
                        )}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedEntry(
                            entry
                          )
                        }
                        className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-[11px] font-medium text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-brand)] hover:text-[color:var(--primary)]"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-16 text-center"
                >
                  <div className="text-sm font-medium text-[color:var(--text-secondary)]">
                    No journal entries found.
                  </div>

                  <p className="mx-auto mt-2 max-w-xl text-[11px] leading-5 text-[color:var(--text-tertiary)]">
                    Journal entries will appear here
                    once accounting activity begins.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[color:var(--border)] px-5 py-4">
        <p className="text-[11px] text-[color:var(--text-tertiary)]">
          Draft journals do not affect financial
          statements. Posted and reversed journals form
          part of the authoritative General Ledger.
        </p>
      </div>

      {selectedEntry && (
        <JournalEntryDetailsModal
          entry={selectedEntry}
          lines={
            linesByEntry.get(
              selectedEntry.id
            ) || []
          }
          accounts={accounts}
          periods={periods}
          onClose={() =>
            setSelectedEntry(null)
          }
        />
      )}
    </section>
  );
}