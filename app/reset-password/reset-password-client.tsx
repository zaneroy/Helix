"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function prepareResetSession() {
      setError("");

      const code = searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          setError(error.message || "Reset link is invalid or expired.");
          setCheckingSession(false);
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError(
          "Reset session not found. Please request a new password reset link."
        );
      }

      setCheckingSession(false);
    }

    prepareResetSession();
  }, [searchParams, supabase]);

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message || "Password could not be updated.");
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();

    router.push(
      "/admin/login?success=Password updated. Please sign in."
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-6 text-[var(--text-primary)]">
      <div className="w-full max-w-md rounded-[2rem] border border-[var(--primary-border)] bg-[var(--surface)] p-8">
        <p className="text-sm text-[var(--primary)]">Reset Password</p>

        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
          Create new password
        </h1>

        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          Enter a new password for your Helix account.
        </p>

        {checkingSession ? (
          <div className="mt-8 rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-4 py-3 text-sm text-[var(--primary)]">
            Checking reset link...
          </div>
        ) : (
          <form onSubmit={handleUpdate} className="mt-8 space-y-5">
            <div>
              <label className="text-sm text-[var(--text-secondary)]">
                New password
              </label>

              <input
                type="password"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="mt-2 w-full rounded-xl border border-[var(--primary-border)] bg-[var(--surface-soft)] px-4 py-4 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary-border)]"
              />
            </div>

            <div>
              <label className="text-sm text-[var(--text-secondary)]">
                Confirm password
              </label>

              <input
                type="password"
                placeholder="Minimum 8 characters"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="mt-2 w-full rounded-xl border border-[var(--primary-border)] bg-[var(--surface-soft)] px-4 py-4 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary-border)]"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={
                loading ||
                Boolean(error && error.includes("session"))
              }
              className="w-full rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-5 py-4 font-semibold text-[var(--text-primary)] shadow-[var(--shadow-brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}