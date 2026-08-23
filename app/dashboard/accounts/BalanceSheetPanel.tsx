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

type BalanceSheetAccount = {
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

export default function BalanceSheetPanel({
  rows,
  accounts,
  currency,
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

  const accountMetadata = useMemo(() => {
    const map = new Map<
      string,
      AccountingAccount
    >();

    for (const account of accounts) {
      map.set(account.code, account);
    }

    return map;
  }, [accounts]);

  const result = useMemo(() => {
    const balanceMap = new Map<
      string,
      {
        code: string;
        name: string;
        debit: number;
        credit: number;
      }
    >();

    let revenue = 0;
    let costOfSales = 0;
    let expenses = 0;

    for (const row of rows) {
      if (
        asOfDate &&
        row.entry_date > asOfDate
      ) {
        continue;
      }

      const metadata =
        accountMetadata.get(
          row.account_code
        );

      if (!metadata) {
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

      if (
        metadata.account_type ===
        "revenue"
      ) {
        revenue += credit - debit;
        continue;
      }

      if (
        metadata.account_type ===
        "cost_of_sales"
      ) {
        costOfSales += debit - credit;
        continue;
      }

      if (
        metadata.account_type ===
        "expense"
      ) {
        expenses += debit - credit;
        continue;
      }

      if (
        metadata.account_type !==
          "asset" &&
        metadata.account_type !==
          "liability" &&
        metadata.account_type !==
          "equity"
      ) {
        continue;
      }

      const current =
        balanceMap.get(
          row.account_code
        ) || {
          code: row.account_code,
          name: row.account_name,
          debit: 0,
          credit: 0,
        };

      current.debit += debit;
      current.credit += credit;

      balanceMap.set(
        row.account_code,
        current
      );
    }

    const assets: BalanceSheetAccount[] =
      [];

    const liabilities: BalanceSheetAccount[] =
      [];

    const equity: BalanceSheetAccount[] =
      [];

    for (const balance of balanceMap.values()) {
      const metadata =
        accountMetadata.get(
          balance.code
        );

      if (!metadata) {
        continue;
      }

      const normalAmount =
        metadata.normal_balance ===
        "credit"
          ? balance.credit -
            balance.debit
          : balance.debit -
            balance.credit;

      const amount =
        metadata.is_contra
          ? -normalAmount
          : normalAmount;

      if (
        Math.abs(amount) < 0.005
      ) {
        continue;
      }

      const item = {
        code: balance.code,
        name: balance.name,
        amount,
      };

      if (
        metadata.account_type ===
        "asset"
      ) {
        assets.push(item);
      }

      if (
        metadata.account_type ===
        "liability"
      ) {
        liabilities.push(item);
      }

      if (
        metadata.account_type ===
        "equity"
      ) {
        equity.push(item);
      }
    }

    const sortAccounts = (
      values: BalanceSheetAccount[]
    ) =>
      values.sort((a, b) =>
        a.code.localeCompare(
          b.code,
          undefined,
          {
            numeric: true,
          }
        )
      );

    const currentEarnings =
      revenue -
      costOfSales -
      expenses;

    return {
      assets: sortAccounts(assets),
      liabilities:
        sortAccounts(liabilities),
      equity: sortAccounts(equity),
      currentEarnings,
    };
  }, [
    rows,
    accountMetadata,
    asOfDate,
  ]);

  const totalAssets =
    result.assets.reduce(
      (total, account) =>
        total + account.amount,
      0
    );

  const totalLiabilities =
    result.liabilities.reduce(
      (total, account) =>
        total + account.amount,
      0
    );

  const postedEquity =
    result.equity.reduce(
      (total, account) =>
        total + account.amount,
      0
    );

  const totalEquity =
    postedEquity +
    result.currentEarnings;

  const liabilitiesAndEquity =
    totalLiabilities +
    totalEquity;

  const difference =
    totalAssets -
    liabilitiesAndEquity;

  const balanced =
    Math.abs(difference) < 0.005;

  function renderSection(
    title: string,
    sectionAccounts: BalanceSheetAccount[],
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

        {sectionAccounts.length > 0 ? (
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
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">
                Balance Sheet
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
              Assets, liabilities and equity
              derived from the authoritative
              General Ledger.
            </p>
          </div>

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
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
            <div className="text-[10px] text-[color:var(--text-tertiary)]">
              Total Assets
            </div>

            <div className="mt-1 text-[15px] font-semibold text-[color:var(--text-primary)]">
              {formatMoney(
                totalAssets,
                currency
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
            <div className="text-[10px] text-[color:var(--text-tertiary)]">
              Total Liabilities
            </div>

            <div className="mt-1 text-[15px] font-semibold text-[color:var(--text-primary)]">
              {formatMoney(
                totalLiabilities,
                currency
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] p-4">
            <div className="text-[10px] text-[color:var(--primary)]">
              Total Equity
            </div>

            <div className="mt-1 text-[15px] font-semibold text-[color:var(--primary)]">
              {formatMoney(
                totalEquity,
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
              "Assets",
              result.assets,
              "Total Assets",
              totalAssets
            )}

            {renderSection(
              "Liabilities",
              result.liabilities,
              "Total Liabilities",
              totalLiabilities
            )}

            <tr className="bg-[color:var(--surface-soft)]">
              <td
                colSpan={3}
                className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-secondary)]"
              >
                Equity
              </td>
            </tr>

            {result.equity.map(
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

                  <td className="px-5 py-3 text-right text-[12px] font-medium text-[color:var(--text-primary)]">
                    {formatMoney(
                      account.amount,
                      currency
                    )}
                  </td>
                </tr>
              )
            )}

            <tr className="border-b border-[color:var(--border)]">
              <td className="px-5 py-3 text-[11px] font-semibold text-[color:var(--primary)]">
                —
              </td>

              <td className="px-5 py-3 text-[12px] font-medium text-[color:var(--text-primary)]">
                Current Earnings
              </td>

              <td className="px-5 py-3 text-right text-[12px] font-medium text-[color:var(--text-primary)]">
                {formatMoney(
                  result.currentEarnings,
                  currency
                )}
              </td>
            </tr>

            <tr className="border-b border-[color:var(--border)]">
              <td
                colSpan={2}
                className="px-5 py-3 text-[12px] font-semibold text-[color:var(--text-primary)]"
              >
                Total Equity
              </td>

              <td className="px-5 py-3 text-right text-[12px] font-semibold text-[color:var(--text-primary)]">
                {formatMoney(
                  totalEquity,
                  currency
                )}
              </td>
            </tr>

            <tr className="border-y-2 border-[color:var(--border-brand)] bg-[color:var(--primary-soft)]">
              <td
                colSpan={2}
                className="px-5 py-4 text-[12px] font-semibold text-[color:var(--primary)]"
              >
                Total Liabilities + Equity
              </td>

              <td className="px-5 py-4 text-right text-[13px] font-semibold text-[color:var(--primary)]">
                {formatMoney(
                  liabilitiesAndEquity,
                  currency
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-[color:var(--border)] px-5 py-4">
        <span className="text-[11px] text-[color:var(--text-tertiary)]">
          Assets must equal liabilities plus equity.
        </span>

        <span
          className={
            balanced
              ? "text-[11px] font-semibold text-[color:var(--primary)]"
              : "text-[11px] font-semibold text-[color:var(--danger)]"
          }
        >
          {balanced
            ? "Balance Sheet balances"
            : `Difference: ${formatMoney(
                Math.abs(difference),
                currency
              )}`}
        </span>
      </div>
    </section>
  );
}