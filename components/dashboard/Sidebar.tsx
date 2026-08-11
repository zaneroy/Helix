import Link from "next/link";

export default function Sidebar() {
  const navItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Investors", href: "/dashboard/investors" },
    { label: "Inventory", href: "/dashboard/products" },
    { label: "Sales", href: "/dashboard/sales" },
    { label: "Expenses", href: "/dashboard/expenses" },
    { label: "Reports", href: "/dashboard/reports" },
    { label: "Settings", href: "/dashboard/settings" },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-72 border-r border-[color:var(--border)] bg-[color:var(--sidebar-bg)] p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--primary)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
          △
        </div>
        <h1 className="text-2xl font-semibold text-[color:var(--text-primary)]">Helix</h1>
      </div>

      <nav className="mt-10 space-y-2">
        {navItems.map((item, index) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded-[var(--radius-md)] px-4 py-3 text-sm ${
              index === 0
                ? "border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
                : "text-[color:var(--text-secondary)] hover:bg-[color:var(--surface)]"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}