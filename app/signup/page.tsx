import Link from "next/link";
import SignupForm from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-[var(--text-primary)]">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="hidden border-r border-[var(--primary-border)] bg-[var(--sidebar-bg)] p-10 lg:flex lg:flex-col lg:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]">
              △
            </div>
            <span className="text-2xl font-semibold">Helix</span>
          </Link>

          <div>
            <p className="mb-4 text-sm text-[var(--primary)]">Financial OS for SMEs</p>
            <h1 className="max-w-xl text-6xl font-semibold leading-[0.95] tracking-[-0.06em]">
              Build a business investors can understand.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-[var(--text-secondary)]">
              Track operations, inventory, employees, investors, reports,
              valuation, cash flow and AI CFO insights from one workspace.
            </p>
          </div>

          <p className="text-sm text-[var(--text-tertiary)]">
            Founder workspace. Investor-grade reporting. Financial intelligence.
          </p>
        </section>

        <section className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <SignupForm />
          </div>
        </section>
      </div>
    </main>
  );
}