"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupForm() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");

    const cleanFullName = fullName.trim();
    const cleanCompanyName = companyName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanFullName || !cleanCompanyName || !cleanEmail || !password) {
      setError("Please complete all fields.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    const { error: signupError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanFullName,
          company_name: cleanCompanyName,
          role: "admin",
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }

    router.push(
      `/login?message=${encodeURIComponent(
        "Check your email to confirm your account, then sign in."
      )}`
    );
    router.refresh();
  }

  return (
    <div className="rounded-[2rem] border border-[var(--primary-border)] bg-[var(--surface)] p-8 shadow-[var(--shadow-brand)]">
      <p className="text-sm text-[var(--primary)]">Founder Signup</p>

      <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
        Create your Helix workspace
      </h2>

      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
        Start with a founder/admin account. Employees and investors can be
        invited later.
      </p>

      <form onSubmit={handleSignup} className="mt-8 space-y-5">
        <Field
          label="Full name"
          value={fullName}
          onChange={setFullName}
          placeholder="Jayden Smith"
        />

        <Field
          label="Company name"
          value={companyName}
          onChange={setCompanyName}
          placeholder="Your company"
        />

        <Field
          label="Email address"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="founder@company.com"
        />

        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
        />

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
          {loading ? "Creating workspace..." : "Create Workspace"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--text-tertiary)]">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--primary)]">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block text-sm text-[var(--text-secondary)]">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="mt-2 w-full rounded-xl border border-[var(--primary-border)] bg-[var(--surface-soft)] px-4 py-4 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary-border)]"
      />
    </label>
  );
}