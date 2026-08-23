"use client";

import type { AccountingAccount } from "./page";

type Props = {
  accounts: AccountingAccount[];
  action: (formData: FormData) => void;
  onClose: () => void;
};

export default function CreateJournalEntryModal({
  accounts,
  action,
  onClose,
}: Props) {
  const postingAccounts = accounts.filter(
    (account) =>
      account.status === "active" &&
      account.allow_manual_posting
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[760px] rounded-3xl border border-[color:var(--border-brand)] bg-[color:var(--surface)] shadow-[var(--shadow-modal)]">
        <div className="flex items-start justify-between border-b border-[color:var(--border)] px-6 py-5">
          <div>
            <h2 className="text-[17px] font-semibold text-[color:var(--text-primary)]">
              New Journal Entry
            </h2>

            <p className="mt-2 text-[12px] leading-5 text-[color:var(--text-tertiary)]">
              Create a balanced manual journal. The journal will
              first be saved as a draft and will not affect the
              General Ledger until it is posted.
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

        <form action={action} className="p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-[11px] font-medium text-[color:var(--text-secondary)]">
                Entry date
              </span>

              <input
                type="date"
                name="entry_date"
                defaultValue={today}
                required
                className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-[12px] text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[11px] font-medium text-[color:var(--text-secondary)]">
                Reference
              </span>

              <input
                type="text"
                name="reference"
                placeholder="e.g. MANUAL-001"
                maxLength={100}
                className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-[12px] text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--border-brand)]"
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-[11px] font-medium text-[color:var(--text-secondary)]">
              Description
            </span>

            <input
              type="text"
              name="description"
              placeholder="e.g. Test product sale"
              required
              maxLength={250}
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-[12px] text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--border-brand)]"
            />
          </label>

          <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5">
            <div className="mb-4">
              <div className="text-[13px] font-semibold text-[color:var(--text-primary)]">
                Debit
              </div>

              <div className="mt-1 text-[10px] text-[color:var(--text-tertiary)]">
                Select the General Ledger account receiving the
                debit.
              </div>
            </div>

            <select
              name="debit_account_id"
              required
              defaultValue=""
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[12px] text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
            >
              <option value="" disabled>
                Select debit account
              </option>

              {postingAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} — {account.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5">
            <div className="mb-4">
              <div className="text-[13px] font-semibold text-[color:var(--text-primary)]">
                Credit
              </div>

              <div className="mt-1 text-[10px] text-[color:var(--text-tertiary)]">
                Select the General Ledger account receiving the
                credit.
              </div>
            </div>

            <select
              name="credit_account_id"
              required
              defaultValue=""
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[12px] text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
            >
              <option value="" disabled>
                Select credit account
              </option>

              {postingAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} — {account.name}
                </option>
              ))}
            </select>
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-[11px] font-medium text-[color:var(--text-secondary)]">
              Amount
            </span>

            <input
              type="number"
              name="amount"
              min="0.01"
              step="0.01"
              required
              placeholder="0.00"
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-[13px] font-medium text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--border-brand)]"
            />
          </label>

          <div className="mt-6 rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-4 py-3">
            <p className="text-[10px] leading-5 text-[color:var(--primary)]">
              Helix will create two equal journal lines. Debit and
              credit must balance before the posting engine will
              allow this journal into the General Ledger.
            </p>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-[color:var(--border)] pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-2.5 text-[12px] font-medium text-[color:var(--text-secondary)]"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="rounded-xl bg-[color:var(--primary)] px-5 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[color:var(--primary-hover)]"
            >
              Save Draft
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}