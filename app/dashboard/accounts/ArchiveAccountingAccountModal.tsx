"use client";

import { useFormStatus } from "react-dom";

import type { AccountingAccount } from "./page";

type Props = {
  account: AccountingAccount;
  action: (formData: FormData) => void;
  onClose: () => void;
};

export default function ArchiveAccountingAccountModal({
  account,
  action,
  onClose,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[color:var(--border-brand)] bg-[color:var(--surface)] shadow-[var(--shadow-modal)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[color:var(--border)] px-6 py-5">
          <div>
            <h2 className="text-[17px] font-semibold text-[color:var(--text-primary)]">
              Archive GL Account
            </h2>

            <p className="mt-1 text-xs leading-5 text-[color:var(--text-tertiary)]">
              Stop this account from being used for future
              General Ledger postings.
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
          <input
            type="hidden"
            name="account_id"
            value={account.id}
          />

          <div className="rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] p-4">
            <p className="text-sm font-semibold text-[color:var(--warning)]">
              Archive {account.code} — {account.name}?
            </p>

            <p className="mt-2 text-xs leading-5 text-[color:var(--text-secondary)]">
              This does not delete the account. Existing
              General Ledger history remains intact for
              reporting and audit purposes.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ReadOnlyField
              label="Account code"
              value={account.code}
            />

            <ReadOnlyField
              label="Account type"
              value={formatValue(account.account_type)}
            />

            <ReadOnlyField
              label="Normal balance"
              value={
                account.normal_balance === "credit"
                  ? "Credit"
                  : "Debit"
              }
            />

            <ReadOnlyField
              label="Current status"
              value={
                account.status === "active"
                  ? "Active"
                  : "Archived"
              }
            />
          </div>

          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-[11px] leading-5 text-[color:var(--text-tertiary)]">
            After archiving, the account remains in historical
            reports but cannot be used by new posted journals.
            You can view it using the Archived or All statuses
            filter in the Chart of Accounts.
          </div>

          <div className="flex justify-end gap-3 border-t border-[color:var(--border)] pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-2.5 text-xs font-medium text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
            >
              Cancel
            </button>

            <ArchiveButton />
          </div>
        </form>
      </div>
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-tertiary)]">
        {label}
      </div>

      <div className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}

function formatValue(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ArchiveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-4 py-2.5 text-xs font-semibold text-[color:var(--danger)] transition disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Archiving..." : "Archive Account"}
    </button>
  );
}
