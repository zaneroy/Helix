"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AcceptInviteClient({ token }: { token: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function acceptInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setError("Invitation session not found. Please open the invite link again.");
      setLoading(false);
      return;
    }

    const { error: passwordError } = await supabase.auth.updateUser({
      password,
    });

    if (passwordError) {
      setError(passwordError.message);
      setLoading(false);
      return;
    }

    const response = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.error || "Invitation could not be accepted.");
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();

    if (result.role === "employee") router.push("/employee/login");
    else if (result.role === "investor") router.push("/investor/login");
    else router.push("/admin/login");

    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[var(--app-bg)] px-6 py-10 text-[var(--text-primary)]">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center">
        <div className="w-full rounded-[2rem] border border-[var(--primary-border)] bg-[var(--surface-subtle)] p-8 shadow-[var(--shadow-brand)]">
          <p className="text-sm text-[var(--primary)]">Helix Invitation</p>

          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
            Create your password
          </h1>

          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            Set your password to activate your Helix account.
          </p>

          <form onSubmit={acceptInvite} className="mt-8 space-y-5">
            <label className="block text-sm text-[var(--text-secondary)]">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                className="mt-2 w-full rounded-xl border border-[var(--primary-border)] bg-[var(--surface-soft)] px-4 py-4 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary-border)]"
              />
            </label>

            <label className="block text-sm text-[var(--text-secondary)]">
              Confirm password
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                required
                className="mt-2 w-full rounded-xl border border-[var(--primary-border)] bg-[var(--surface-soft)] px-4 py-4 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary-border)]"
              />
            </label>

            {error && (
              <div className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-5 py-4 font-semibold text-[var(--text-primary)] shadow-[var(--shadow-brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Activating account..." : "Activate Account"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}