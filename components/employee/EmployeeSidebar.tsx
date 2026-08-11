import Link from "next/link";

export default function EmployeeSidebar() {
  const navItems = [
    { label: "Dashboard", href: "/employee" },
    { label: "My Tasks", href: "/employee/tasks" },
    { label: "My Sales", href: "/employee/sales" },
    { label: "Inventory", href: "/employee/inventory" },
    { label: "Submit Expense", href: "/employee/expenses" },
    { label: "Profile", href: "/employee/profile" },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-72 border-r border-[var(--primary-border)] bg-[var(--sidebar-bg)] p-6">
      <Link href="/employee" className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]">
          △
        </div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Helix</h1>
      </Link>

      <nav className="mt-10 space-y-2">
        {navItems.map((item, index) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded-xl px-4 py-3 text-sm ${
              index === 0
                ? "border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface)]"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}