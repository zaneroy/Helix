"use client";

import { useFormStatus } from "react-dom";

import type { AccountingAccount } from "./page";

type Props = {
  account: AccountingAccount;
  action: (formData: FormData) => void;
  onClose: () => void;
};

export default function EditAccountingAccountModal({
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
        className="w-full max-w-xl rounded-2xl border border-[color:var(--border-brand)] bg-[color:var(--surface)] shadow-[var(--shadow-modal)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[color:var(--border)] px-6 py-5">
          <div>
            <h2 className="text-[17px] font-semibold text-[color:var(--text-primary)]">
              Edit GL Account
            </h2>

            <p className="mt-1 text-xs leading-5 text-[color:var(--text-tertiary)]">
              Update permitted Chart of Accounts details without
              changing protected accounting identity.
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

          <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
            <Field label="Account code">
              <input
                name="code"
                required
                maxLength={20}
                defaultValue={account.code}
                autoComplete="off"
                className={INPUT_CLASS}
              />
            </Field>

            <Field label="Account name">
              <input
                name="name"
                required
                maxLength={120}
                defaultValue={account.name}
                autoComplete="off"
                className={INPUT_CLASS}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <ReadOnlyField
              label="Type"
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
              label="Classification"
              value={
                account.is_system
                  ? account.is_contra
                    ? "System · Contra"
                    : "System"
                  : account.is_contra
                    ? "Custom · Contra"
                    : "Custom"
              }
            />
          </div>

          <Field label="Description">
            <textarea
              name="description"
              rows={3}
              defaultValue={account.description || ""}
              placeholder="Optional description of how this account is used..."
              className={`${INPUT_CLASS} min-h-[96px] resize-y`}
            />
          </Field>

          {account.is_system ? (
            <div className="rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-4 py-3">
              <div className="text-xs font-semibold text-[color:var(--text-primary)]">
                Helix system account
              </div>

              <p className="mt-1 text-[11px] leading-5 text-[color:var(--text-secondary)]">
                Its permanent system mapping, account type,
                normal balance, contra classification and
                posting-control setting remain protected.
              </p>

              <div className="mt-3 text-[11px] text-[color:var(--text-tertiary)]">
                Posting:{" "}
                <span className="font-medium text-[color:var(--text-primary)]">
                  {account.allow_manual_posting
                    ? "Manual posting allowed"
                    : "System controlled"}
                </span>
              </div>
            </div>
          ) : (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
              <input
                type="checkbox"
                name="allow_manual_posting"
                value="true"
                defaultChecked={account.allow_manual_posting}
                className="mt-0.5 h-4 w-4 accent-[color:var(--primary)]"
              />

              <div>
                <div className="text-xs font-medium text-[color:var(--text-primary)]">
                  Allow manual journal posting
                </div>

                <div className="mt-1 text-[11px] leading-5 text-[color:var(--text-tertiary)]">
                  When disabled, manual journals cannot post
                  directly to this account.
                </div>
              </div>
            </label>
          )}

          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-[11px] leading-5 text-[color:var(--text-tertiary)]">
            Account type, normal balance and contra status are
            intentionally locked after creation to protect
            General Ledger consistency.
          </div>

          <div className="flex justify-end gap-3 border-t border-[color:var(--border)] pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-2.5 text-xs font-medium text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
            >
              Cancel
            </button>

            <SaveButton />
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

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[color:var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Saving..." : "Save Changes"}
    </button>
  );
}
