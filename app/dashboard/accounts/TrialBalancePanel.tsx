"use client";

import { useMemo, useState } from "react";

type GeneralLedgerRow = {
  journal_entry_id: string;
  entry_number: number;
  entry_date: string;
  account_code: string;
  account_name: string;
  journal_description: string | null;
  reference: string | null;
  debit: number;
  credit: number;
  base_debit?: number;
  base_credit?: number;
  currency_code: string | null;
  base_currency_code?: string | null;
  journal_status: string;
  posted_at: string | null;
};

type Props = {
  rows: GeneralLedgerRow[];
};

type TrialBalanceAccount = {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
};

function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export default function TrialBalancePanel({
  rows,
}: Props) {
  const latestDate =
    rows.length > 0
      ? [...rows]
          .map((row) => row.entry_date)
          .sort()
          .at(-1) || ""
      : "";

  const [asOfDate, setAsOfDate] =
    useState(latestDate);

  const accounts = useMemo(() => {
    const map = new Map<
      string,
      TrialBalanceAccount
    >();

    for (const row of rows) {
      if (
        asOfDate &&
        row.entry_date > asOfDate
      ) {
        continue;
      }

      const current =
        map.get(row.account_code) || {
          accountCode:
            row.account_code,
          accountName:
            row.account_name,
          debit: 0,
          credit: 0,
        };

      current.debit += Number(
        row.base_debit ??
          row.debit ??
          0
      );

      current.credit += Number(
        row.base_credit ??
          row.credit ??
          0
      );

      map.set(
        row.account_code,
        current
      );
    }

    return Array.from(map.values())
      .map((account) => {
        const net =
          account.debit -
          account.credit;

        if (net > 0) {
          return {
            ...account,
            debit: net,
            credit: 0,
          };
        }

        if (net < 0) {
          return {
            ...account,
            debit: 0,
            credit:
              Math.abs(net),
          };
        }

        return {
          ...account,
          debit: 0,
          credit: 0,
        };
      })
      .filter(
        (account) =>
          account.debit !== 0 ||
          account.credit !== 0
      )
      .sort((a, b) =>
        a.accountCode.localeCompare(
          b.accountCode,
          undefined,
          {
            numeric: true,
          }
        )
      );
  }, [rows, asOfDate]);

  const totals = useMemo(() => {
    return accounts.reduce(
      (total, account) => ({
        debit:
          total.debit +
          account.debit,
        credit:
          total.credit +
          account.credit,
      }),
      {
        debit: 0,
        credit: 0,
      }
    );
  }, [accounts]);

  const difference =
    totals.debit -
    totals.credit;

  const balanced =
    Math.abs(difference) <
    0.005;

  return (
    <section className="rounded-2xl border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
      <div className="border-b border-[color:var(--border)] p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">
                Trial Balance
              </h2>

              <span
                className={`rounded-full border px-3 py-1 text-[10px] font-semibold ${
                  balanced
                    ? "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
                    : "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
                }`}
              >
                {balanced
                  ? "Balanced"
                  : "Out of Balance"}
              </span>
            </div>

            <p className="mt-2 max-w-2xl text-[12px] leading-5 text-[color:var(--text-tertiary)]">
              Account balances
              derived from posted
              General Ledger
              activity. Total debits
              must equal total
              credits.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">
                As of date
              </span>

              <input
                type="date"
                value={asOfDate}
                onChange={(event) =>
                  setAsOfDate(
                    event.target.value
                  )
                }
                className="h-[58px] min-w-[170px] rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-[12px] font-medium text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--border-brand)]"
              />
            </label>

            <div className="grid min-w-[300px] grid-cols-2 gap-2">
              <div className="flex h-[58px] flex-col justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4">
                <div className="text-[10px] text-[color:var(--text-tertiary)]">
                  Total Debit
                </div>

                <div className="mt-1 text-[14px] font-semibold text-[color:var(--text-primary)]">
                  {money(
                    totals.debit
                  )}
                </div>
              </div>

              <div className="flex h-[58px] flex-col justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4">
                <div className="text-[10px] text-[color:var(--text-tertiary)]">
                  Total Credit
                </div>

                <div className="mt-1 text-[14px] font-semibold text-[color:var(--text-primary)]">
                  {money(
                    totals.credit
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-h-[520px] overflow-auto overscroll-contain">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[color:var(--surface-soft)] text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-tertiary)]">
            <tr className="border-b border-[color:var(--border)]">
              <th className="px-5 py-4">
                Code
              </th>

              <th className="px-5 py-4">
                Account
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
            {accounts.length >
            0 ? (
              accounts.map(
                (account) => (
                  <tr
                    key={
                      account.accountCode
                    }
                    className="border-b border-[color:var(--border)] last:border-b-0 hover:bg-[color:var(--surface-soft)]"
                  >
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-[12px] font-semibold text-[color:var(--primary)]">
                      {
                        account.accountCode
                      }
                    </td>

                    <td className="px-5 py-4 text-[12px] font-medium text-[color:var(--text-primary)]">
                      {
                        account.accountName
                      }
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right text-[12px] font-medium text-[color:var(--text-primary)]">
                      {account.debit
                        ? money(
                            account.debit
                          )
                        : "—"}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right text-[12px] font-medium text-[color:var(--text-primary)]">
                      {account.credit
                        ? money(
                            account.credit
                          )
                        : "—"}
                    </td>
                  </tr>
                )
              )
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-16 text-center"
                >
                  <div className="text-sm font-medium text-[color:var(--text-secondary)]">
                    No Trial Balance
                    activity yet.
                  </div>

                  <p className="mt-2 text-[11px] text-[color:var(--text-tertiary)]">
                    Posted General
                    Ledger balances
                    will appear here
                    automatically.
                  </p>
                </td>
              </tr>
            )}
          </tbody>

          {accounts.length >
            0 && (
            <tfoot className="sticky bottom-0 bg-[color:var(--surface)]">
              <tr className="border-t-2 border-[color:var(--border-brand)]">
                <td
                  colSpan={2}
                  className="px-5 py-4 text-[12px] font-semibold text-[color:var(--text-primary)]"
                >
                  Total
                </td>

                <td className="px-5 py-4 text-right text-[13px] font-semibold text-[color:var(--text-primary)]">
                  {money(
                    totals.debit
                  )}
                </td>

                <td className="px-5 py-4 text-right text-[13px] font-semibold text-[color:var(--text-primary)]">
                  {money(
                    totals.credit
                  )}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-[color:var(--border)] px-5 py-4">
        <span className="text-[11px] text-[color:var(--text-tertiary)]">
          {accounts.length} accounts
          with non-zero balances.
        </span>

        <span
          className={
            balanced
              ? "text-[11px] font-semibold text-[color:var(--primary)]"
              : "text-[11px] font-semibold text-[color:var(--danger)]"
          }
        >
          {balanced
            ? "Debits equal credits"
            : `Difference: ${money(
                Math.abs(
                  difference
                )
              )}`}
        </span>
      </div>
    </section>
  );
}