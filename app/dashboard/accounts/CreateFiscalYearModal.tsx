"use client";

type Props = {
  action: (formData: FormData) => void;
  onClose: () => void;
};

export default function CreateFiscalYearModal({
  action,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[620px] overflow-hidden rounded-3xl border border-[color:var(--border-brand)] bg-[color:var(--surface)] shadow-[var(--shadow-modal)]">
        <div className="flex items-start justify-between border-b border-[color:var(--border)] px-6 py-5">
          <div>
            <h2 className="text-[17px] font-semibold text-[color:var(--text-primary)]">
              Set Up Fiscal Year
            </h2>

            <p className="mt-1 max-w-md text-[11px] leading-5 text-[color:var(--text-tertiary)]">
              Helix will automatically create 12 monthly
              General Ledger periods beginning from the
              selected month.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)] transition hover:text-[color:var(--primary)]"
          >
            ×
          </button>
        </div>

        <form action={action} className="space-y-5 p-6">
          <div>
            <label
              htmlFor="fiscal_year_label"
              className="mb-2 block text-[11px] font-medium text-[color:var(--text-secondary)]"
            >
              Fiscal year label
            </label>

            <input
              id="fiscal_year_label"
              name="fiscal_year_label"
              type="text"
              required
              placeholder="Example: FY 2026/27"
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--border-brand)]"
            />
          </div>

          <div>
            <label
              htmlFor="start_date"
              className="mb-2 block text-[11px] font-medium text-[color:var(--text-secondary)]"
            >
              Fiscal year start
            </label>

            <input
              id="start_date"
              name="start_date"
              type="date"
              required
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--border-brand)]"
            />

            <p className="mt-2 text-[10px] leading-4 text-[color:var(--text-tertiary)]">
              Select the first day of the fiscal year,
              such as 1 January or 1 April.
            </p>
          </div>

          <div>
            <label
              htmlFor="notes"
              className="mb-2 block text-[11px] font-medium text-[color:var(--text-secondary)]"
            >
              Notes
              <span className="ml-1 text-[color:var(--text-tertiary)]">
                Optional
              </span>
            </label>

            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Optional fiscal year notes..."
              className="w-full resize-none rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--border-brand)]"
            />
          </div>

          <div className="rounded-2xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] p-4">
            <div className="text-[11px] font-semibold text-[color:var(--primary)]">
              Helix will create
            </div>

            <div className="mt-2 text-[11px] leading-5 text-[color:var(--text-secondary)]">
              12 monthly periods · Periods 1–12 ·
              All initially Open · No existing periods
              will be overwritten.
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-[color:var(--border)] pt-5">
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
              Create Fiscal Year
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
