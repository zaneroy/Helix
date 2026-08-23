"use client";

import { useMemo, useState } from "react";

import type { AccountingAccount } from "./page";
import CreateAccountingAccountModal from "./CreateAccountingAccountModal";
import EditAccountingAccountModal from "./EditAccountingAccountModal";
import ArchiveAccountingAccountModal from "./ArchiveAccountingAccountModal";
import RestoreAccountingAccountModal from "./RestoreAccountingAccountModal";

type AccountTypeFilter =
  | "all"
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "cost_of_sales"
  | "expense";

type AccountStatusFilter = "active" | "archived" | "all";

type Props = {
  accounts: AccountingAccount[];
  addAccountingAccount: (formData: FormData) => void;
  updateAccountingAccount: (formData: FormData) => void;
  archiveAccountingAccount: (formData: FormData) => void;
  restoreAccountingAccount: (formData: FormData) => void;
};

const ACCOUNT_TYPES: Array<{
  value: AccountTypeFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "asset", label: "Assets" },
  { value: "liability", label: "Liabilities" },
  { value: "equity", label: "Equity" },
  { value: "revenue", label: "Revenue" },
  { value: "cost_of_sales", label: "Cost of Sales" },
  { value: "expense", label: "Expenses" },
];

function formatAccountType(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatNormalBalance(value: string) {
  return value === "credit" ? "Credit" : "Debit";
}

export default function ChartOfAccountsPanel({
  accounts,
  addAccountingAccount,
  updateAccountingAccount,
  archiveAccountingAccount,
  restoreAccountingAccount,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false);

  const [editAccount, setEditAccount] =
    useState<AccountingAccount | null>(null);

  const [archiveAccount, setArchiveAccount] =
  useState<AccountingAccount | null>(null);

  const [restoreAccount, setRestoreAccount] =
  useState<AccountingAccount | null>(null);

  const [search, setSearch] = useState("");

  const [typeFilter, setTypeFilter] =
    useState<AccountTypeFilter>("all");

  const [statusFilter, setStatusFilter] =
    useState<AccountStatusFilter>("active");

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return accounts.filter((account) => {
      const matchesType =
        typeFilter === "all" ||
        account.account_type === typeFilter;

      const matchesStatus =
        statusFilter === "all" ||
        account.status === statusFilter;

      const matchesSearch =
        !query ||
        [
          account.code,
          account.name,
          account.account_type,
          account.account_subtype,
          account.system_key,
          account.description,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query)
        );

      return (
        matchesType &&
        matchesStatus &&
        matchesSearch
      );
    });
  }, [accounts, search, statusFilter, typeFilter]);

  const activeCount = useMemo(
    () =>
      accounts.filter(
        (account) => account.status === "active"
      ).length,
    [accounts]
  );

  const archivedCount =
    accounts.length - activeCount;

  return (
    <section className="rounded-2xl border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
      <div className="border-b border-[color:var(--border)] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">
                Chart of Accounts
              </h2>

              <span className="rounded-full border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--primary)]">
                {accounts.length} accounts
              </span>
            </div>

            <p className="mt-2 max-w-3xl text-[12px] leading-5 text-[color:var(--text-tertiary)]">
              General Ledger accounts used to classify
              assets, liabilities, equity, revenue, cost of
              sales and expenses. These are separate from
              your operational cash and bank accounts above.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded-lg bg-[color:var(--primary)] px-3 py-2 font-semibold text-white transition hover:bg-[color:var(--primary-hover)]"
            >
              + New GL Account
            </button>

            <span className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-[color:var(--text-secondary)]">
              {activeCount} active
            </span>

            {archivedCount > 0 && (
              <span className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-[color:var(--text-secondary)]">
                {archivedCount} archived
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_TYPES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setTypeFilter(option.value)
                }
                className={`rounded-lg px-3 py-2 text-[11px] font-medium transition ${
                  typeFilter === option.value
                    ? "bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
                    : "border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search code or account..."
              className="h-10 min-w-[240px] rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 text-xs text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--border-brand)]"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target
                    .value as AccountStatusFilter
                )
              }
              className="h-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 text-xs text-[color:var(--text-secondary)] outline-none focus:border-[color:var(--border-brand)]"
            >
              <option value="active">
                Active
              </option>

              <option value="archived">
                Archived
              </option>

              <option value="all">
                All statuses
              </option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-h-[560px] overflow-auto overscroll-contain">
        <table className="w-full min-w-[1180px] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[color:var(--surface-soft)] text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-tertiary)]">
            <tr className="border-b border-[color:var(--border)]">
              <th className="px-5 py-4">
                Code
              </th>

              <th className="px-5 py-4">
                Account
              </th>

              <th className="px-5 py-4">
                Type
              </th>

              <th className="px-5 py-4">
                Normal Balance
              </th>

              <th className="px-5 py-4">
                Classification
              </th>

              <th className="px-5 py-4">
                Posting
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
            {filteredAccounts.length > 0 ? (
              filteredAccounts.map((account) => (
                <tr
                  key={account.id}
                  className="border-b border-[color:var(--border)] last:border-b-0 hover:bg-[color:var(--surface-soft)]"
                >
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="font-mono text-[12px] font-semibold text-[color:var(--primary)]">
                      {account.code}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <div className="font-medium text-[13px] text-[color:var(--text-primary)]">
                      {account.name}
                    </div>

                    {account.description && (
                      <div className="mt-1 max-w-[420px] text-[11px] leading-4 text-[color:var(--text-tertiary)]">
                        {account.description}
                      </div>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-5 py-4 text-[12px] text-[color:var(--text-secondary)]">
                    {formatAccountType(
                      account.account_type
                    )}
                  </td>

                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2.5 py-1.5 text-[10px] font-medium text-[color:var(--text-secondary)]">
                      {formatNormalBalance(
                        account.normal_balance
                      )}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      {account.is_system && (
                        <span className="rounded-lg bg-[color:var(--primary-soft)] px-2.5 py-1.5 text-[10px] font-medium text-[color:var(--primary)]">
                          System
                        </span>
                      )}

                      {account.is_contra && (
                        <span className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2.5 py-1.5 text-[10px] font-medium text-[color:var(--text-secondary)]">
                          Contra
                        </span>
                      )}

                      {!account.is_system &&
                        !account.is_contra && (
                          <span className="text-[11px] text-[color:var(--text-tertiary)]">
                            Custom
                          </span>
                        )}
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-5 py-4 text-[11px]">
                    {account.allow_manual_posting ? (
                      <span className="text-[color:var(--text-secondary)]">
                        Manual allowed
                      </span>
                    ) : (
                      <span className="font-medium text-[color:var(--primary)]">
                        System controlled
                      </span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-5 py-4">
                    <span
                      className={`rounded-lg px-2.5 py-1.5 text-[10px] font-medium ${
                        account.status === "active"
                          ? "bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
                          : "bg-[color:var(--surface-soft)] text-[color:var(--text-tertiary)]"
                      }`}
                    >
                      {account.status === "active"
                        ? "Active"
                        : "Archived"}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-5 py-4 text-right">
  <div className="flex items-center justify-end gap-2">
    <button
      type="button"
      onClick={() => setEditAccount(account)}
      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-[11px] font-medium text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-brand)] hover:text-[color:var(--primary)]"
    >
      Edit
    </button>

    {account.is_system && (
      <span className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-[10px] font-medium text-[color:var(--text-tertiary)]">
        Protected
      </span>
    )}

    {!account.is_system &&
      account.status === "active" && (
        <button
          type="button"
          onClick={() => setArchiveAccount(account)}
          className="rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-3 py-2 text-[11px] font-medium text-[color:var(--danger)] transition"
        >
          Archive
        </button>
      )}

    {!account.is_system &&
      account.status === "archived" && (
        <button
          type="button"
          onClick={() => setRestoreAccount(account)}
          className="rounded-lg border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-3 py-2 text-[11px] font-medium text-[color:var(--primary)] transition"
        >
          Restore
        </button>
      )}
  </div>
</td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-16 text-center text-sm text-[color:var(--text-tertiary)]"
                >
                  No accounting accounts match the
                  current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[color:var(--border)] px-5 py-4">
        <p className="text-[11px] text-[color:var(--text-tertiary)]">
          Showing {filteredAccounts.length} of{" "}
          {accounts.length} General Ledger accounts.
        </p>
      </div>

      {createOpen && (
        <CreateAccountingAccountModal
          action={addAccountingAccount}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {editAccount && (
        <EditAccountingAccountModal
          account={editAccount}
          action={updateAccountingAccount}
          onClose={() => setEditAccount(null)}
        />
      )}

      {archiveAccount && (
  <ArchiveAccountingAccountModal
    account={archiveAccount}
    action={archiveAccountingAccount}
    onClose={() => setArchiveAccount(null)}
  />
)}

{restoreAccount && (
  <RestoreAccountingAccountModal
    account={restoreAccount}
    action={restoreAccountingAccount}
    onClose={() => setRestoreAccount(null)}
  />
)}
    </section>
  );
}
