"use client";

import { useMemo, useState } from "react";
import type { AccountingAccount } from "./page";

type GeneralLedgerRow = {
  journal_entry_id: string;
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

type ActivityType =
  | "operating"
  | "investing"
  | "financing";

type CashFlowLine = {
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

function numericCode(code: string) {
  if (!/^\d+$/.test(code)) {
    return null;
  }

  return Number(code);
}

function isCashAccount(
  code: string,
  name: string,
  account?: AccountingAccount
) {
  const normalizedCode =
    code.trim().toUpperCase();

  const normalizedName =
    name.trim().toLowerCase();

  if (
    ["1000", "1010", "1050"].includes(
      normalizedCode
    )
  ) {
    return true;
  }

  if (
    account?.account_type === "asset" &&
    (
      normalizedName.includes("cash") ||
      normalizedName.includes(
        "undeposited funds"
      ) ||
      normalizedName.includes(
        "bank clearing"
      ) ||
      normalizedName.includes(
        "payment processor"
      )
    )
  ) {
    return true;
  }

  return false;
}

function classifyAccount(
  account?: AccountingAccount
): ActivityType {
  if (!account) {
    return "operating";
  }

  const code =
    numericCode(account.code);

  const name =
    account.name.toLowerCase();

  if (
    account.account_type === "equity"
  ) {
    return "financing";
  }

  if (
    account.account_type === "liability"
  ) {
    if (
      (
        code !== null &&
        code >= 2300 &&
        code < 2700
      ) ||
      name.includes("loan") ||
      name.includes("debt") ||
      name.includes("borrowing") ||
      name.includes("shareholder")
    ) {
      return "financing";
    }

    return "operating";
  }

  if (
    account.account_type === "asset"
  ) {
    if (
      (
        code !== null &&
        code >= 1500 &&
        code < 1800
      ) ||
      name.includes(
        "property"
      ) ||
      name.includes(
        "plant"
      ) ||
      name.includes(
        "equipment"
      ) ||
      name.includes(
        "fixed asset"
      ) ||
      name.includes(
        "intangible"
      ) ||
      name.includes(
        "long-term investment"
      )
    ) {
      return "investing";
    }

    return "operating";
  }

  return "operating";
}

function normalizeAmount(
  value: number
) {
  if (Math.abs(value) < 0.005) {
    return 0;
  }

  return value;
}

export default function CashFlowStatementPanel({
  rows,
  accounts,
  currency,
}: Props) {
  const dates = useMemo(() => {
    return rows
      .map((row) => row.entry_date)
      .filter(Boolean)
      .sort();
  }, [rows]);

  const firstDate =
    dates[0] || "";

  const latestDate =
    dates.length > 0
      ? dates[dates.length - 1]
      : "";

  const [fromDate, setFromDate] =
    useState(firstDate);

  const [toDate, setToDate] =
    useState(latestDate);

  const accountMap = useMemo(() => {
    const map = new Map<
      string,
      AccountingAccount
    >();

    for (const account of accounts) {
      map.set(
        account.code,
        account
      );
    }

    return map;
  }, [accounts]);

  const statement = useMemo(() => {
    const operating = new Map<
      string,
      CashFlowLine
    >();

    const investing = new Map<
      string,
      CashFlowLine
    >();

    const financing = new Map<
      string,
      CashFlowLine
    >();

    let openingCash = 0;
    let directPeriodCashMovement = 0;

    for (const row of rows) {
      const account =
        accountMap.get(
          row.account_code
        );

      const cashAccount =
        isCashAccount(
          row.account_code,
          row.account_name,
          account
        );

      if (!cashAccount) {
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

      const movement =
        debit - credit;

      if (
        fromDate &&
        row.entry_date < fromDate
      ) {
        openingCash += movement;
        continue;
      }

      if (
        toDate &&
        row.entry_date > toDate
      ) {
        continue;
      }

      directPeriodCashMovement +=
        movement;
    }

    const periodRows =
      rows.filter((row) => {
        if (
          fromDate &&
          row.entry_date < fromDate
        ) {
          return false;
        }

        if (
          toDate &&
          row.entry_date > toDate
        ) {
          return false;
        }

        return true;
      });

    const journals = new Map<
      string,
      GeneralLedgerRow[]
    >();

    for (const row of periodRows) {
      const current =
        journals.get(
          row.journal_entry_id
        ) || [];

      current.push(row);

      journals.set(
        row.journal_entry_id,
        current
      );
    }

    function addLine(
      target: Map<
        string,
        CashFlowLine
      >,
      row: GeneralLedgerRow,
      amount: number
    ) {
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

    for (const journalRows of journals.values()) {
      const hasCashLine =
        journalRows.some(
          (row) => {
            const account =
              accountMap.get(
                row.account_code
              );

            return isCashAccount(
              row.account_code,
              row.account_name,
              account
            );
          }
        );

      if (!hasCashLine) {
        continue;
      }

      for (const row of journalRows) {
        const account =
          accountMap.get(
            row.account_code
          );

        if (
          isCashAccount(
            row.account_code,
            row.account_name,
            account
          )
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

        /*
         * Non-cash counterpart contribution:
         *
         * Revenue credit       -> cash inflow
         * Expense debit        -> cash outflow
         * Asset debit          -> cash outflow
         * Liability credit     -> cash inflow
         * Equity credit        -> cash inflow
         */
        const amount =
          credit - debit;

        if (
          Math.abs(amount) <
          0.005
        ) {
          continue;
        }

        const activity =
          classifyAccount(account);

        if (
          activity ===
          "investing"
        ) {
          addLine(
            investing,
            row,
            amount
          );

          continue;
        }

        if (
          activity ===
          "financing"
        ) {
          addLine(
            financing,
            row,
            amount
          );

          continue;
        }

        addLine(
          operating,
          row,
          amount
        );
      }
    }

    function normalizeLines(
      values: Map<
        string,
        CashFlowLine
      >
    ) {
      return Array.from(
        values.values()
      )
        .map((line) => ({
          ...line,
          amount:
            normalizeAmount(
              line.amount
            ),
        }))
        .filter(
          (line) =>
            line.amount !== 0
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
    }

    const operatingLines =
      normalizeLines(operating);

    const investingLines =
      normalizeLines(investing);

    const financingLines =
      normalizeLines(financing);

    const operatingTotal =
      operatingLines.reduce(
        (total, line) =>
          total + line.amount,
        0
      );

    const investingTotal =
      investingLines.reduce(
        (total, line) =>
          total + line.amount,
        0
      );

    const financingTotal =
      financingLines.reduce(
        (total, line) =>
          total + line.amount,
        0
      );

    const netChange =
      operatingTotal +
      investingTotal +
      financingTotal;

    const closingCash =
      openingCash +
      netChange;

    const reconciliationDifference =
      directPeriodCashMovement -
      netChange;

    return {
      operatingLines,
      investingLines,
      financingLines,
      operatingTotal:
        normalizeAmount(
          operatingTotal
        ),
      investingTotal:
        normalizeAmount(
          investingTotal
        ),
      financingTotal:
        normalizeAmount(
          financingTotal
        ),
      openingCash:
        normalizeAmount(
          openingCash
        ),
      netChange:
        normalizeAmount(
          netChange
        ),
      closingCash:
        normalizeAmount(
          closingCash
        ),
      directPeriodCashMovement:
        normalizeAmount(
          directPeriodCashMovement
        ),
      reconciliationDifference:
        normalizeAmount(
          reconciliationDifference
        ),
    };
  }, [
    rows,
    accountMap,
    fromDate,
    toDate,
  ]);

  const reconciled =
    Math.abs(
      statement
        .reconciliationDifference
    ) < 0.005;

  function renderSection(
    title: string,
    lines: CashFlowLine[],
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

        {lines.length > 0 ? (
          lines.map((line) => (
            <tr
              key={line.code}
              className="border-b border-[color:var(--border)]"
            >
              <td className="whitespace-nowrap px-5 py-3 font-mono text-[11px] font-semibold text-[color:var(--primary)]">
                {line.code}
              </td>

              <td className="px-5 py-3 text-[12px] text-[color:var(--text-primary)]">
                {line.name}
              </td>

              <td className="whitespace-nowrap px-5 py-3 text-right text-[12px] font-medium text-[color:var(--text-primary)]">
                {formatMoney(
                  line.amount,
                  currency
                )}
              </td>
            </tr>
          ))
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
                Cash Flow Statement
              </h2>

              <span
                className={`rounded-full border px-3 py-1 text-[10px] font-semibold ${
                  reconciled
                    ? "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
                    : "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
                }`}
              >
                {reconciled
                  ? "Reconciled"
                  : "Check Required"}
              </span>
            </div>

            <p className="mt-2 max-w-2xl text-[12px] leading-5 text-[color:var(--text-tertiary)]">
              Cash movements derived from
              posted General Ledger activity
              and classified as operating,
              investing or financing.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <label>
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">
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
                className="h-[58px] min-w-[170px] rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-[12px] font-medium text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--border-brand)]"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">
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
                className="h-[58px] min-w-[170px] rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-[12px] font-medium text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--border-brand)]"
              />
            </label>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
            <div className="text-[10px] text-[color:var(--text-tertiary)]">
              Operating
            </div>

            <div className="mt-1 text-[15px] font-semibold text-[color:var(--text-primary)]">
              {formatMoney(
                statement.operatingTotal,
                currency
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
            <div className="text-[10px] text-[color:var(--text-tertiary)]">
              Investing
            </div>

            <div className="mt-1 text-[15px] font-semibold text-[color:var(--text-primary)]">
              {formatMoney(
                statement.investingTotal,
                currency
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
            <div className="text-[10px] text-[color:var(--text-tertiary)]">
              Financing
            </div>

            <div className="mt-1 text-[15px] font-semibold text-[color:var(--text-primary)]">
              {formatMoney(
                statement.financingTotal,
                currency
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] p-4">
            <div className="text-[10px] text-[color:var(--primary)]">
              Net Change in Cash
            </div>

            <div className="mt-1 text-[15px] font-semibold text-[color:var(--primary)]">
              {formatMoney(
                statement.netChange,
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
                Cash Movement
              </th>
            </tr>
          </thead>

          <tbody>
            {renderSection(
              "Operating Activities",
              statement.operatingLines,
              "Net Cash from Operating Activities",
              statement.operatingTotal
            )}

            {renderSection(
              "Investing Activities",
              statement.investingLines,
              "Net Cash from Investing Activities",
              statement.investingTotal
            )}

            {renderSection(
              "Financing Activities",
              statement.financingLines,
              "Net Cash from Financing Activities",
              statement.financingTotal
            )}

            <tr className="border-y-2 border-[color:var(--border-brand)] bg-[color:var(--primary-soft)]">
              <td
                colSpan={2}
                className="px-5 py-4 text-[12px] font-semibold text-[color:var(--primary)]"
              >
                Net Change in Cash
              </td>

              <td className="px-5 py-4 text-right text-[13px] font-semibold text-[color:var(--primary)]">
                {formatMoney(
                  statement.netChange,
                  currency
                )}
              </td>
            </tr>

            <tr className="border-b border-[color:var(--border)]">
              <td
                colSpan={2}
                className="px-5 py-3 text-[12px] font-medium text-[color:var(--text-secondary)]"
              >
                Opening Cash
              </td>

              <td className="px-5 py-3 text-right text-[12px] font-medium text-[color:var(--text-primary)]">
                {formatMoney(
                  statement.openingCash,
                  currency
                )}
              </td>
            </tr>

            <tr className="border-b border-[color:var(--border)]">
              <td
                colSpan={2}
                className="px-5 py-4 text-[13px] font-semibold text-[color:var(--text-primary)]"
              >
                Closing Cash
              </td>

              <td className="px-5 py-4 text-right text-[14px] font-semibold text-[color:var(--text-primary)]">
                {formatMoney(
                  statement.closingCash,
                  currency
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-[color:var(--border)] px-5 py-4">
        <span className="text-[11px] text-[color:var(--text-tertiary)]">
          Cash activity is derived only from
          journals containing cash or cash-equivalent
          General Ledger accounts.
        </span>

        <span
          className={
            reconciled
              ? "text-[11px] font-semibold text-[color:var(--primary)]"
              : "text-[11px] font-semibold text-[color:var(--danger)]"
          }
        >
          {reconciled
            ? "Cash movement reconciles"
            : `Difference: ${formatMoney(
                Math.abs(
                  statement
                    .reconciliationDifference
                ),
                currency
              )}`}
        </span>
      </div>
    </section>
  );
}