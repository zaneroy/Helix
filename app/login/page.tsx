import Link from "next/link";

export default function LoginPage() {
  const portals = [
    {
      title: "Admin Login",
      description: "Founder and business owner workspace.",
      href: "/admin/login",
      label: "Continue as Admin",
    },
    {
      title: "Employee Login",
      description: "Employee workspace for tasks, sales and expenses.",
      href: "/employee/login",
      label: "Continue as Employee",
    },
    {
      title: "Investor Login",
      description: "Investor portal for reports, valuation and documents.",
      href: "/investor/login",
      label: "Continue as Investor",
    },
  ];

  return (
    <main className="min-h-screen bg-[var(--app-bg)] px-6 py-10 text-[var(--text-primary)]">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]">
            △
          </div>
          <span className="text-2xl font-semibold">Helix</span>
        </Link>

        <div className="mt-20 max-w-3xl">
          <p className="text-sm text-[var(--primary)]">Choose your portal</p>
          <h1 className="mt-4 text-6xl font-semibold leading-[0.95] tracking-[-0.06em]">
            Sign in to your Helix workspace.
          </h1>
          <p className="mt-6 text-lg leading-8 text-[var(--text-secondary)]">
            Admins, employees and investors each get a secure workspace designed
            around their role.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {portals.map((portal) => (
            <div
              key={portal.href}
              className="rounded-[2rem] border border-[var(--primary-border)] bg-[var(--surface)] p-6"
            >
              <h2 className="text-xl font-semibold">{portal.title}</h2>
              <p className="mt-3 min-h-16 text-sm leading-6 text-[var(--text-secondary)]">
                {portal.description}
              </p>

              <Link
                href={portal.href}
                className="mt-6 block rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-4 py-3 text-center text-sm font-medium text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
              >
                {portal.label}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-10 text-sm text-[var(--text-tertiary)]">
          New founder?{" "}
          <Link href="/signup" className="text-[var(--primary)]">
            Create a workspace
          </Link>
        </p>
      </div>
    </main>
  );
}