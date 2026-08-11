"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage("Password reset link sent. Check your email.");
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-6 text-[var(--text-primary)]">
      <div className="w-full max-w-md rounded-[2rem] border border-[var(--primary-border)] bg-[var(--surface)] p-8">
        <Link href="/" className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]">
            △
          </div>
          <span className="text-2xl font-semibold">Helix</span>
        </Link>

        <p className="text-sm text-[var(--primary)]">Password Recovery</p>

        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
          Forgot password?
        </h1>

        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          Enter your email and we’ll send you a secure reset link.
        </p>

        <form onSubmit={handleReset} className="mt-8 space-y-5">
          <div>
            <label className="text-sm text-[var(--text-secondary)]">Email address</label>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-2 w-full rounded-xl border border-[var(--primary-border)] bg-[var(--surface-soft)] px-4 py-4 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary-border)]"
            />
          </div>

          {message && (
            <div className="rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-4 py-3 text-sm text-[var(--primary)]">
              {message}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-5 py-4 font-semibold text-[var(--text-primary)] shadow-[var(--shadow-brand-strong)] disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <div className="mt-6 text-sm text-[var(--text-tertiary)]">
          Remembered your password?{" "}
          <Link href="/admin/login" className="text-[var(--primary)]">
            Back to login
          </Link>
        </div>
      </div>
    </main>
  );
}