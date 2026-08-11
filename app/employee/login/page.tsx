import Link from "next/link";
import LoginForm from "@/components/auth/LoginForm";

export default function EmployeeLoginPage() {
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
            <p className="mb-4 text-sm text-[var(--primary)]">Employee Access</p>
            <h1 className="max-w-xl text-6xl font-semibold leading-[0.95] tracking-[-0.06em]">
              Enter sales, inventory and expenses securely.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-[var(--text-secondary)]">
              Employees get limited access to the tools they need without seeing
              investor or ownership information.
            </p>
          </div>

          <p className="text-sm text-[var(--text-tertiary)]">
            Limited permissions. Secure access. Clean workflows.
          </p>
        </section>

        <section className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <LoginForm
              role="employee"
              redirectTo="/employee"
              title="Employee Login"
              description="Sign in with your employee account."
              buttonText="Sign in as Employee"
            />
          </div>
        </section>
      </div>
    </main>
  );
}