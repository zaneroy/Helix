"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type InviteRole = "admin" | "employee" | "investor";

type Props = {
  companyId: string;
  invitedBy: string;
};

const fieldClass = "h-12 w-full rounded-[var(--input-radius)] border border-[var(--input-border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--input-text)] outline-none placeholder:text-[var(--input-placeholder)] transition duration-[var(--duration-fast)] focus:border-[var(--input-border-focus)] focus:shadow-[0_0_0_3px_var(--input-ring)]";

export default function InviteUserForm({ companyId, invitedBy }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("employee");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/invitations/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "send",
          companyId,
          invitedBy,
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          role,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Invitation could not be sent.");
        return;
      }

      setMessage(result.message || `${role} invitation sent successfully.`);
      setFullName("");
      setEmail("");
      setRole("employee");
      router.refresh();
    } catch {
      setError("Invitation could not be sent. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleInvite} className="rounded-[var(--radius-xl)] border border-[var(--card-border)] bg-[image:var(--gradient-card)] p-[var(--panel-padding)] text-[var(--text-primary)] shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">Secure invitation</p>
          <h2 className="mt-2 text-lg font-semibold">Add Workspace Access</h2>
          <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">Send a seven-day, role-based invitation through the configured Supabase email flow.</p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-2xl text-[var(--primary)]">+</span>
      </div>

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-2 block text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Full name</span>
          <input placeholder="e.g. Sarah Ahmed" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} className={fieldClass} />
        </label>

        <label className="block">
          <span className="mb-2 block text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Email address</span>
          <input type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={fieldClass} />
        </label>

        <label className="block">
          <span className="mb-2 block text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Workspace role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as InviteRole)} className={fieldClass}>
            <option value="employee">Employee — operational workspace</option>
            <option value="investor">Investor — financial portal</option>
            <option value="admin">Admin — full company control</option>
          </select>
        </label>

        {role === "admin" && (
          <div className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-3 text-xs leading-5 text-[var(--warning)]">
            Admin access includes full company control. Only invite trusted senior operators.
          </div>
        )}

        {message && <div className="rounded-xl border border-[var(--success-border)] bg-[var(--success-soft)] px-4 py-3 text-xs text-[var(--success)]">{message}</div>}
        {error && <div className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-xs text-[var(--danger)]">{error}</div>}

        <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center rounded-[var(--button-radius)] border border-[var(--primary)] bg-[image:var(--gradient-brand)] px-5 text-sm font-semibold text-[var(--text-on-brand)] shadow-[var(--shadow-brand)] transition duration-[var(--duration-fast)] hover:shadow-[var(--shadow-brand-strong)] active:scale-[var(--pressed-scale)] disabled:cursor-not-allowed disabled:opacity-45">
          {loading ? "Sending secure invitation..." : "Send Invitation"}
        </button>
      </div>
    </form>
  );
}