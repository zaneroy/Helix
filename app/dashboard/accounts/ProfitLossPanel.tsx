"use client";

import { useMemo, useState } from "react";
import type { AccountingAccount } from "./page";

type GeneralLedgerRow = {
  entry_date: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  base_debit?: number;
  base_credit?: number;
};

type Props = {
  rows: GeneralLedgerRow[];
  accounts: AccountingAccount[];
  currency: string;
};

type ProfitLossAccount = {
  code: string;
  name: string;
  amount: number;
};

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

export default function ProfitLossPanel({
  rows,
  accounts,
  currency,
}: Props) {
  const dates = useMemo(
    () =>
      rows
        .map((row) => row.entry_date)
        .filter(Boolean)
        .sort(),
    [rows]
  );

  const firstDate = dates[0] || "";
  const latestDate =
    dates.length > 0
      ? dates[dates.length - 1]
      : "";

  const [fromDate, setFromDate] =
    useState(firstDate);

  const [toDate, setToDate] =
    useState(latestDate);

  const accountTypes = useMemo(() => {
    const map = new Map<
      string,
      AccountingAccount["account_type"]
    >();

    for (const account of accounts) {
      map.set(
        account.code,
        account.account_type
      );
    }

    return map;
  }, [accounts]);

  const results = useMemo(() => {
    const revenue = new Map<
      string,
      ProfitLossAccount
    >();

    const costOfSales = new Map<
      string,
      ProfitLossAccount
    >();

    const expenses = new Map<
      string,
      ProfitLossAccount
    >();

    for (const row of rows) {
      if (
        fromDate &&
        row.entry_date < fromDate
      ) {
        continue;
      }

      if (
        toDate &&
        row.entry_date > toDate
      ) {
        continue;
      }

      const accountType =
        accountTypes.get(
          row.account_code
        );

      if (
        accountType !== "revenue" &&
        accountType !==
          "cost_of_sales" &&
        accountType !== "expense"
      ) {
        continue;
      }

      const debit = Number(
        row.base_debit ??
          row.debit ??
          0
      );

      const credit = Number(
        row.base_credit ??
          row.credit ??
          0
      );

      const amount =
        accountType === "revenue"
          ? credit - debit
          : debit - credit;

      const target =
        accountType === "revenue"
          ? revenue
          : accountType ===
              "cost_of_sales"
            ? costOfSales
            : expenses;

      const current =
        target.get(
          row.account_code
        ) || {
          code: row.account_code,
          name: row.account_name,
          amount: 0,
        };

      current.amount += amount;

      target.set(
        row.account_code,
        current
      );
    }

    const normalize = (
      map: Map<
        string,
        ProfitLossAccount
      >
    ) =>
      Array.from(map.values())
        .filter(
          (account) =>
            Math.abs(account.amount) >=
            0.005
        )
        .sort((a, b) =>
          a.code.localeCompare(
            b.code,
            undefined,
            {
              numeric: true,
            }
          )
        );

    return {
      revenue: normalize(revenue),
      costOfSales:
        normalize(costOfSales),
      expenses: normalize(expenses),
    };
  }, [
    rows,
    accountTypes,
    fromDate,
    toDate,
  ]);

  const totalRevenue =
    results.revenue.reduce(
      (total, account) =>
        total + account.amount,
      0
    );

  const totalCostOfSales =
    results.costOfSales.reduce(
      (total, account) =>
        total + account.amount,
      0
    );

  const grossProfit =
    totalRevenue -
    totalCostOfSales;

  const totalExpenses =
    results.expenses.reduce(
      (total, account) =>
        total + account.amount,
      0
    );

  const netProfit =
    grossProfit - totalExpenses;

  function renderSection(
    title: string,
    sectionAccounts: ProfitLossAccount[],
    totalLabel: string,
    total: number
  ) {
    return (
      <>
        <tr className="bg-[color:var(--surface-soft)]">
          <td
            colSpan={3}
            className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-secondary)]"
          >
            {title}
          </td>
        </tr>

        {sectionAccounts.length >
        0 ? (
          sectionAccounts.map(
            (account) => (
              <tr
                key={account.code}
                className="border-b border-[color:var(--border)]"
              >
                <td className="whitespace-nowrap px-5 py-3 font-mono text-[11px] font-semibold text-[color:var(--primary)]">
                  {account.code}
                </td>

                <td className="px-5 py-3 text-[12px] text-[color:var(--text-primary)]">
                  {account.name}
                </td>

                <td className="whitespace-nowrap px-5 py-3 text-right text-[12px] font-medium text-[color:var(--text-primary)]">
                  {formatMoney(
                    account.amount,
                    currency
                  )}
                </td>
              </tr>
            )
          )
        ) : (
          <tr className="border-b border-[color:var(--border)]">
            <td
              colSpan={3}
              className="px-5 py-3 text-[11px] text-[color:var(--text-tertiary)]"
            >
              No activity
            </td>
          </tr>
        )}

        <tr className="border-b border-[color:var(--border)]">
          <td
            colSpan={2}
            className="px-5 py-3 text-[12px] font-semibold text-[color:var(--text-primary)]"
          >
            {totalLabel}
          </td>

          <td className="px-5 py-3 text-right text-[12px] font-semibold text-[color:var(--text-primary)]">
            {formatMoney(
              total,
              currency
            )}
          </td>
        </tr>
      </>
    );
  }

  return (
    <section className="rounded-2xl border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
      <div className="border-b border-[color:var(--border)] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">
              Profit & Loss
            </h2>

            <p className="mt-2 text-[12px] leading-5 text-[color:var(--text-tertiary)]">
              Revenue, cost of sales and
              operating expenses derived from
              the authoritative General Ledger.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <label>
              <span className="mb-1 block text-[10px] text-[color:var(--text-tertiary)]">
                From
              </span>

              <input
                type="date"
                value={fromDate}
                onChange={(event) =>
                  setFromDate(
                    event.target.value
                  )
                }
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2.5 text-[12px] text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
              />
            </label>

            <label>
              <span className="mb-1 block text-[10px] text-[color:var(--text-tertiary)]">
                To
              </span>

              <input
                type="date"
                value={toDate}
                onChange={(event) =>
                  setToDate(
                    event.target.value
                  )
                }
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2.5 text-[12px] text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
              />
            </label>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
            <div className="text-[10px] text-[color:var(--text-tertiary)]">
              Revenue
            </div>

            <div className="mt-1 text-[15px] font-semibold text-[color:var(--text-primary)]">
              {formatMoney(
                totalRevenue,
                currency
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
            <div className="text-[10px] text-[color:var(--text-tertiary)]">
              Gross Profit
            </div>

            <div className="mt-1 text-[15px] font-semibold text-[color:var(--text-primary)]">
              {formatMoney(
                grossProfit,
                currency
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] p-4">
            <div className="text-[10px] text-[color:var(--primary)]">
              Net Profit
            </div>

            <div className="mt-1 text-[15px] font-semibold text-[color:var(--primary)]">
              {formatMoney(
                netProfit,
                currency
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-h-[520px] overflow-auto overscroll-contain">
        <table className="w-full min-w-[820px] border-collapse">
          <thead className="sticky top-0 z-10 bg-[color:var(--surface-soft)] text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-tertiary)]">
            <tr className="border-b border-[color:var(--border)]">
              <th className="px-5 py-4 text-left">
                Code
              </th>

              <th className="px-5 py-4 text-left">
                Account
              </th>

              <th className="px-5 py-4 text-right">
                Amount
              </th>
            </tr>
          </thead>

          <tbody>
            {renderSection(
              "Revenue",
              results.revenue,
              "Total Revenue",
              totalRevenue
            )}

            {renderSection(
              "Cost of Sales",
              results.costOfSales,
              "Total Cost of Sales",
              totalCostOfSales
            )}

            <tr className="border-y-2 border-[color:var(--border-brand)] bg-[color:var(--primary-soft)]">
              <td
                colSpan={2}
                className="px-5 py-4 text-[12px] font-semibold text-[color:var(--primary)]"
              >
                Gross Profit
              </td>

              <td className="px-5 py-4 text-right text-[13px] font-semibold text-[color:var(--primary)]">
                {formatMoney(
                  grossProfit,
                  currency
                )}
              </td>
            </tr>

            {renderSection(
              "Operating Expenses",
              results.expenses,
              "Total Operating Expenses",
              totalExpenses
            )}

            <tr className="border-t-2 border-[color:var(--border-brand)]">
              <td
                colSpan={2}
                className="px-5 py-4 text-[13px] font-semibold text-[color:var(--text-primary)]"
              >
                Net Profit
              </td>

              <td className="px-5 py-4 text-right text-[14px] font-semibold text-[color:var(--primary)]">
                {formatMoney(
                  netProfit,
                  currency
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}