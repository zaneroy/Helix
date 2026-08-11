"use client";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "Delete",
  cancelText = "Cancel",
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[color:var(--overlay-strong)] px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-[color:var(--danger-border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-danger)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--danger)]">
          Confirmation
        </p>

        <div className="mt-3 text-xl font-semibold text-[color:var(--text-primary)]">{title}</div>

        <p className="mt-3 text-sm leading-6 text-[color:var(--text-secondary)]">{description}</p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--text-primary)] hover:bg-[color:var(--surface-muted)]"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-4 py-3 text-sm font-medium text-[color:var(--danger)] hover:bg-[color:var(--danger-soft)]"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}