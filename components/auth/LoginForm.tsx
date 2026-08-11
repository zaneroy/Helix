"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type LoginRole = "admin" | "employee" | "investor";

type LoginFormProps = {
  role: LoginRole;
  redirectTo: string;
  title: string;
  description: string;
  buttonText: string;
};

export default function LoginForm({
  role,
  redirectTo,
  title,
  description,
  buttonText,
}: LoginFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      setError(error?.message || "Unable to sign in.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setError("Profile not found.");
      setLoading(false);
      return;
    }

    if (profile.role !== role) {
      await supabase.auth.signOut();
      setError("You do not have permission to use this portal.");
      setLoading(false);
      return;
    }

    window.location.href = redirectTo;
  }

  return (
    <div className="rounded-[2rem] border border-[var(--primary-border)] bg-[var(--surface)] p-8 shadow-[var(--shadow-brand)]">
      <p className="text-sm text-[var(--primary)]">{title}</p>

      <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
        Welcome back
      </h2>

      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>

      <form onSubmit={handleLogin} className="mt-8 space-y-5">
        <div>
          <label className="text-sm text-[var(--text-secondary)]">Email address</label>
          <input
            type="email"
            placeholder={`${role}@company.com`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-2 w-full rounded-xl border border-[var(--primary-border)] bg-[var(--surface-soft)] px-4 py-4 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary-border)]"
          />
        </div>

        <div>
          <label className="text-sm text-[var(--text-secondary)]">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-2 w-full rounded-xl border border-[var(--primary-border)] bg-[var(--surface-soft)] px-4 py-4 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary-border)]"
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="accent-cyan-300"
            />
            Remember me
          </label>

          <Link href="/forgot-password" className="text-[var(--primary)]">
            Forgot password?
          </Link>
        </div>

        {error && (
          <div className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-5 py-4 font-semibold text-[var(--text-primary)] shadow-[var(--shadow-brand-strong)] transition hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in..." : buttonText}
        </button>
      </form>
    </div>
  );
}