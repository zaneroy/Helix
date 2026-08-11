"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Invitation = {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "employee" | "investor";
  company_id: string;
  status: string;
};

export default function AcceptInvitePage() {
  const params = useParams();
  const token = params.token as string;
  const supabase = createClient();

  const [invite, setInvite] = useState<Invitation | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadInvite() {
      const { data, error } = await supabase
        .from("invitations")
        .select("id, full_name, email, role, company_id, status")
        .eq("token", token)
        .eq("status", "pending")
        .single();

      if (error || !data) {
        setError("This invitation is invalid or has already been used.");
      } else {
        setInvite(data);
      }

      setLoading(false);
    }

    loadInvite();
  }, [token, supabase]);

  async function acceptInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!invite) return;

    setCreating(true);
    setError("");
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: {
        data: {
          full_name: invite.full_name,
          role: invite.role,
          company_id: invite.company_id,
          invitation_token: token,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/admin/login`,
      },
    });

    if (error) {
  console.log("SIGNUP ERROR:", error);
  setError(error.message || JSON.stringify(error));
  setCreating(false);
  return;
}

    setMessage("Account created. Check your email to verify your account.");
    setCreating(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-[var(--text-primary)]">
        Loading invitation...
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-6 text-[var(--text-primary)]">
      <div className="w-full max-w-md rounded-[2rem] border border-[var(--primary-border)] bg-[var(--surface)] p-8">
        <p className="text-sm text-[var(--primary)]">Helix Invitation</p>

        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
          Create your account
        </h1>

        {invite && (
          <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
            You’ve been invited as a{" "}
            <span className="text-[var(--primary)]">{invite.role}</span> using{" "}
            <span className="text-[var(--text-primary)]">{invite.email}</span>.
          </p>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-4 py-3 text-sm text-[var(--primary)]">
            {message}
          </div>
        )}

        {invite && !message && (
          <form onSubmit={acceptInvite} className="mt-8 space-y-5">
            <div>
              <label className="text-sm text-[var(--text-secondary)]">Password</label>
              <input
                type="password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-2 w-full rounded-xl border border-[var(--primary-border)] bg-[var(--surface-soft)] px-4 py-4 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary-border)]"
              />
            </div>

            <button
              disabled={creating}
              className="w-full rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-5 py-4 font-semibold text-[var(--text-primary)] shadow-[var(--shadow-brand-strong)] disabled:opacity-60"
            >
              {creating ? "Creating account..." : "Accept invitation"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}