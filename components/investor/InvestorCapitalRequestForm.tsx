"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { submitInvestorCapitalRequest } from "@/lib/actions/investor-portal";
import type { InvestorCapitalRequestType } from "@/types/investor-portal";

type Props = {
  currency: string;
};

type MessageState =
  | { type: "success"; text: string }
  | { type: "error"; text: string }
  | null;

function currencyPrefix(currency: string): string {
  const code = String(currency || "GBP").toUpperCase();

  if (code === "GBP") return "£";
  if (code === "USD") return "$";
  if (code === "EUR") return "€";
  if (code === "CAD") return "C$";

  return `${code} `;
}

export default function InvestorCapitalRequestForm({ currency }: Props) {
  const router = useRouter();
  const [requestType, setRequestType] = useState<InvestorCapitalRequestType>("capital_in");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<MessageState>(null);
  const [isPending, startTransition] = useTransition();

  const prefix = useMemo(() => currencyPrefix(currency), [currency]);
  const noteCount = notes.length;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const result = await submitInvestorCapitalRequest({
        requestType,
        amount,
        notes,
      });

      if (!result.ok) {
        setMessage({
          type: "error",
          text: result.error,
        });
        return;
      }

      setAmount("");
      setNotes("");
      setMessage({
        type: "success",
        text: result.data.message,
      });
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <label className="block space-y-2">
        <span className="text-[10px] font-medium text-[var(--text-secondary)]">Request type</span>
        <select
          value={requestType}
          onChange={(event) => setRequestType(event.target.value as InvestorCapitalRequestType)}
          disabled={isPending}
          className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-[11px] text-[var(--text-primary)] outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="capital_in">Capital In</option>
          <option value="withdrawal_request">Withdrawal Request</option>
        </select>
      </label>

      <label className="block space-y-2">
        <span className="text-[10px] font-medium text-[var(--text-secondary)]">Amount ({currency})</span>
        <div className="grid h-10 grid-cols-[auto_1fr] items-center rounded-lg border border-[var(--border)] bg-[var(--surface-soft)]">
          <span className="pl-3 pr-2 text-[11px] text-[var(--primary)]">{prefix}</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={isPending}
            inputMode="decimal"
            placeholder="0.00"
            className="h-full min-w-0 bg-transparent pr-3 text-[11px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] disabled:cursor-not-allowed"
          />
        </div>
      </label>

      <label className="block space-y-2">
        <span className="text-[10px] font-medium text-[var(--text-secondary)]">Notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value.slice(0, 500))}
          disabled={isPending}
          placeholder="Add any additional notes (optional)..."
          className="min-h-[76px] w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3 text-[11px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] disabled:cursor-not-allowed disabled:opacity-60"
        />
        <span className="-mt-7 block pr-3 text-right text-[9px] text-[var(--text-muted)]">{noteCount}/500</span>
      </label>

      {message && (
        <div
          className={[
            "rounded-xl border px-3 py-2 text-[10px] leading-5",
            message.type === "success"
              ? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]"
              : "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]",
          ].join(" ")}
        >
          {message.text}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="h-11 w-full rounded-lg bg-[var(--primary-soft)] text-[12px] font-semibold text-[var(--text-primary)] transition hover:bg-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-55"
      >
        {isPending ? "Submitting..." : "Submit request"}
      </button>

      <p className="text-center text-[10px] leading-4 text-[var(--primary)]">
        Requests are reviewed by the company before completion.
      </p>
    </form>
  );
}