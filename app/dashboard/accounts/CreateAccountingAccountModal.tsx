"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

type AccountingAccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "cost_of_sales"
  | "expense";

type Props = {
  action: (formData: FormData) => void;
  onClose: () => void;
};

function normalBalanceFor(
  accountType: AccountingAccountType,
  isContra: boolean
) {
  const regular =
    accountType === "asset" ||
    accountType === "cost_of_sales" ||
    accountType === "expense"
      ? "Debit"
      : "Credit";

  if (!isContra) {
    return regular;
  }

  return regular === "Debit" ? "Credit" : "Debit";
}

export default function CreateAccountingAccountModal({
  action,
  onClose,
}: Props) {
  const [accountType, setAccountType] =
    useState<AccountingAccountType>("expense");

  const [isContra, setIsContra] = useState(false);

  const normalBalance = useMemo(
    () => normalBalanceFor(accountType, isContra),
    [accountType, isContra]
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-[color:var(--border-brand)] bg-[color:var(--surface)] shadow-[var(--shadow-modal)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[color:var(--border)] px-6 py-5">
          <div>
            <h2 className="text-[17px] font-semibold text-[color:var(--text-primary)]">
              New GL Account
            </h2>

            <p className="mt-1 text-xs leading-5 text-[color:var(--text-tertiary)]">
              Create a custom account in the company&apos;s
              General Ledger Chart of Accounts.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-lg text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form action={action} className="space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
            <Field label="Account code">
              <input
                name="code"
                required
                maxLength={20}
                placeholder="6105"
                autoComplete="off"
                className={INPUT_CLASS}
              />
            </Field>

            <Field label="Account name">
              <input
                name="name"
                required
                maxLength={120}
                placeholder="Marketing Contractors"
                autoComplete="off"
                className={INPUT_CLASS}
              />
            </Field>
          </div>

          <Field label="Account type">
            <select
              name="account_type"
              value={accountType}
              onChange={(event) =>
                setAccountType(
                  event.target.value as AccountingAccountType
                )
              }
              className={INPUT_CLASS}
            >
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
              <option value="equity">Equity</option>
              <option value="revenue">Revenue</option>
              <option value="cost_of_sales">
                Cost of Sales
              </option>
              <option value="expense">Expense</option>
            </select>
          </Field>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
            <input
              type="checkbox"
              name="is_contra"
              value="true"
              checked={isContra}
              onChange={(event) =>
                setIsContra(event.target.checked)
              }
              className="mt-0.5 h-4 w-4 accent-[color:var(--primary)]"
            />

            <div>
              <div className="text-xs font-medium text-[color:var(--text-primary)]">
                Contra account
              </div>

              <div className="mt-1 text-[11px] leading-5 text-[color:var(--text-tertiary)]">
                Use this only when the account offsets the
                normal balance of its account type.
              </div>
            </div>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-tertiary)]">
                Normal balance
              </div>

              <div className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">
                {normalBalance}
              </div>
            </div>

            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-tertiary)]">
                Classification
              </div>

              <div className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">
                Custom
              </div>
            </div>
          </div>

          <Field label="Description">
            <textarea
              name="description"
              rows={3}
              placeholder="Optional description of how this account is used..."
              className={`${INPUT_CLASS} min-h-[96px] resize-y`}
            />
          </Field>

          <div className="rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-4 py-3 text-[11px] leading-5 text-[color:var(--text-secondary)]">
            Custom accounts allow manual journal posting by
            default. Helix system accounts and their permanent
            system mappings are not affected.
          </div>

          <div className="flex justify-end gap-3 border-t border-[color:var(--border)] pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-2.5 text-xs font-medium text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
            >
              Cancel
            </button>

            <CreateButton />
          </div>
        </form>
      </div>
    </div>
  );
}

const INPUT_CLASS =
  "mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--border-brand)]";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-[color:var(--text-secondary)]">
      {label}
      {children}
    </label>
  );
}

function CreateButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[color:var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Creating..." : "Create GL Account"}
    </button>
  );
}
