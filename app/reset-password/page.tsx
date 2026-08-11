import { Suspense } from "react";
import ResetPasswordClient from "./reset-password-client";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordClient />
    </Suspense>
  );
}

function ResetPasswordLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-6 text-[var(--text-primary)]">
      <div className="w-full max-w-md rounded-[2rem] border border-[var(--primary-border)] bg-[var(--surface)] p-8">
        <p className="text-sm text-[var(--primary)]">Reset Password</p>

        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
          Create new password
        </h1>

        <div className="mt-8 rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-4 py-3 text-sm text-[var(--primary)]">
          Loading reset page...
        </div>
      </div>
    </main>
  );
}