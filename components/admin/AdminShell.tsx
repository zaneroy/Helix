"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpenText,
  Boxes,
  Building2,
  ChevronRight,
  CircleDollarSign,
  Command,
  FileText,
  FolderLock,
  Gauge,
  Menu,
  Package,
  ReceiptText,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import LogoutButton from "@/components/auth/LogoutButton";
import NotificationBell from "@/components/notifications/NotificationBell";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/actions";
import type { Notification } from "@/types/notifications";

type AdminShellProps = {
  title: string;
  section?: string;
  subtitle?: string;
  adminName?: string;
  adminRole?: string;
  showPageHeader?: boolean;
  notifications?: Notification[];
  userId?: string;
  children: React.ReactNode;
};

type NavigationItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
};

type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

const navigationGroups: NavigationGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: Gauge, keywords: ["home", "overview", "financial"] },
      { label: "Activity", href: "/dashboard/activity", icon: Activity, keywords: ["events", "audit", "timeline", "history"] },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Sales", href: "/dashboard/sales", icon: ShoppingCart, keywords: ["orders", "revenue", "transactions"] },
      { label: "Inventory", href: "/dashboard/products", icon: Package, keywords: ["products", "stock", "sku", "warehouse"] },
      { label: "Customers", href: "/dashboard/customers", icon: UserRound, keywords: ["clients", "buyers", "contacts"] },
      { label: "Expenses", href: "/dashboard/expenses", icon: ReceiptText, keywords: ["spend", "costs", "purchases"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Accounts", href: "/dashboard/accounts", icon: WalletCards, keywords: ["cash", "bank", "ledger", "balances"] },
      { label: "Invoices", href: "/dashboard/invoices", icon: FileText, keywords: ["billing", "receivables", "payments"] },
      { label: "Reports", href: "/dashboard/reports", icon: BarChart3, keywords: ["analytics", "pdf", "publishing", "profit"] },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Team", href: "/dashboard/team", icon: UsersRound, keywords: ["users", "members", "roles", "invitations"] },
      { label: "Investors", href: "/dashboard/investors", icon: CircleDollarSign, keywords: ["equity", "capital", "ownership", "portfolio"] },
      { label: "Employees", href: "/dashboard/tasks", icon: BookOpenText, keywords: ["tasks", "workforce", "performance"] },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Documents", href: "/dashboard/documents", icon: FolderLock, keywords: ["files", "vault", "data room"] },
      { label: "Settings", href: "/dashboard/settings", icon: Settings, keywords: ["company", "profile", "security", "configuration"] },
    ],
  },
];

const allNavigationItems = navigationGroups.flatMap((group) => group.items);

function normalizePath(pathname: string) {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function isRouteActive(pathname: string, href: string) {
  const currentPath = normalizePath(pathname);
  const targetPath = normalizePath(href);
  if (targetPath === "/dashboard") return currentPath === targetPath;
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

export default function AdminShell({
  title,
  section = "Financial Operating System",
  subtitle,
  adminName = "Founder",
  adminRole = "Founder",
  showPageHeader = true,
  notifications = [],
  userId,
  children,
}: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);

  const initials = useMemo(
    () =>
      adminName
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "FO",
    [adminName]
  );

  const unreadNotifications = useMemo(
    () =>
      notifications.filter((notification) => {
        const candidate = notification as Notification & {
          is_read?: boolean;
          read_at?: string | null;
        };
        return typeof candidate.is_read === "boolean" ? !candidate.is_read : !candidate.read_at;
      }).length,
    [notifications]
  );

  const searchResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return allNavigationItems;
    return allNavigationItems.filter((item) =>
      [item.label, item.href, ...item.keywords].join(" ").toLowerCase().includes(normalizedQuery)
    );
  }, [query]);

  const closeCommand = useCallback(() => {
    setCommandOpen(false);
    setQuery("");
    setSelectedResultIndex(0);
  }, []);

  const visitSearchResult = useCallback(
    (href: string) => {
      closeCommand();
      setMobileNavigationOpen(false);
      router.push(href);
    },
    [closeCommand, router]
  );

  useEffect(() => {
    function handleKeyboardShortcut(event: KeyboardEvent) {
      const isCommandShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isCommandShortcut) {
        event.preventDefault();
        setCommandOpen((current) => !current);
      } else if (event.key === "Escape") {
        closeCommand();
        setMobileNavigationOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, [closeCommand]);

  useEffect(() => {
    if (!commandOpen) return;
    const timeout = window.setTimeout(() => searchInputRef.current?.focus(), 20);
    return () => window.clearTimeout(timeout);
  }, [commandOpen]);

  useEffect(() => setSelectedResultIndex(0), [query]);
  useEffect(() => setMobileNavigationOpen(false), [pathname]);

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedResultIndex((current) => Math.min(current + 1, searchResults.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedResultIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && searchResults[selectedResultIndex]) {
      event.preventDefault();
      visitSearchResult(searchResults[selectedResultIndex].href);
    }
  }

  return (
    <main className="helix-app min-h-screen bg-[color:var(--app-bg)] text-[color:var(--text-primary)]">
      <DesktopSidebar pathname={pathname} adminName={adminName} adminRole={adminRole} initials={initials} />
      <MobileSidebar
        open={mobileNavigationOpen}
        pathname={pathname}
        adminName={adminName}
        adminRole={adminRole}
        initials={initials}
        onClose={() => setMobileNavigationOpen(false)}
      />

      <section className="min-h-screen lg:ml-[var(--sidebar-width)]">
        <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--navbar-bg)] backdrop-blur-xl">
          <div className="flex h-[var(--nav-height)] items-center justify-between gap-4 px-4 sm:px-6 xl:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavigationOpen(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-primary)] transition hover:border-[color:var(--border-brand)] hover:text-[color:var(--primary)] lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-[18px] w-[18px]" />
              </button>

              <div className="min-w-0">
                <p className="truncate text-[9px] uppercase tracking-[0.19em] text-[color:var(--primary)]">{section}</p>
                <h1 className="mt-1 truncate text-[17px] font-semibold tracking-[-0.025em] text-[color:var(--text-primary)] sm:text-[19px]">{title}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                className="hidden min-w-[260px] items-center gap-3 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3.5 py-2.5 text-left transition hover:border-[color:var(--border-brand)] hover:bg-[color:var(--primary-soft)] md:flex"
                aria-label="Search Helix"
              >
                <Search className="h-4 w-4 shrink-0 text-[color:var(--text-tertiary)]" />
                <span className="flex-1 text-[11px] text-[color:var(--text-tertiary)]">Search Helix</span>
                <span className="flex items-center gap-1 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2 py-1 text-[9px] text-[color:var(--text-tertiary)]">
                  <Command className="h-3 w-3" /> K
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-brand)] hover:text-[color:var(--primary)] md:hidden"
                aria-label="Search Helix"
              >
                <Search className="h-[17px] w-[17px]" />
              </button>

              {userId ? (
                <NotificationBell
                  initialNotifications={notifications}
                  userId={userId}
                  markNotificationRead={markNotificationRead}
                  markAllNotificationsRead={markAllNotificationsRead}
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)]">
                  <Bell className="h-[17px] w-[17px]" />
                </div>
              )}

              <div className="hidden items-center gap-3 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-soft)] py-1.5 pl-1.5 pr-3 xl:flex">
                <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[11px] font-semibold text-[color:var(--primary)]">{initials}</div>
                <div className="max-w-[145px]">
                  <p className="truncate text-[11px] font-medium text-[color:var(--text-primary)]">{adminName}</p>
                  <p className="mt-0.5 text-[9px] text-[color:var(--text-tertiary)]">{adminRole}</p>
                </div>
              </div>

              <div className="hidden lg:block"><LogoutButton /></div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[color:var(--border-subtle)] px-4 py-2.5 sm:px-6 lg:hidden">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--primary-soft)] text-[10px] font-semibold text-[color:var(--primary)]">{initials}</div>
              <div className="min-w-0">
                <p className="truncate text-[10px] text-[color:var(--text-primary)]">{adminName}</p>
                <p className="text-[8px] text-[color:var(--text-muted)]">{adminRole}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[8px] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
              <span className="h-1.5 w-1.5 rounded-[var(--radius-pill)] bg-[color:var(--success)] shadow-[var(--shadow-success)]" />
              Live
              {unreadNotifications > 0 && (
                <span className="rounded-[var(--radius-pill)] border border-[color:var(--border)] bg-[color:var(--primary-soft)] px-2 py-1 text-[color:var(--primary)]">{unreadNotifications} unread</span>
              )}
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[var(--app-content-max-width)] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
          {showPageHeader && subtitle && (
            <div className="mb-6 rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[image:var(--gradient-card)] px-5 py-5 shadow-[var(--shadow-card)] sm:px-6">
              <p className="text-[9px] uppercase tracking-[0.21em] text-[color:var(--primary)]">Admin workspace</p>
              <h2 className="mt-2 text-[21px] font-semibold tracking-[-0.035em] text-[color:var(--text-primary)]">{title}</h2>
              <p className="mt-2 max-w-3xl text-[11px] leading-5 text-[color:var(--text-secondary)]">{subtitle}</p>
            </div>
          )}
          {children}
        </div>
      </section>

      <CommandPalette
        open={commandOpen}
        query={query}
        results={searchResults}
        selectedIndex={selectedResultIndex}
        inputRef={searchInputRef}
        onQueryChange={setQuery}
        onKeyDown={handleSearchKeyDown}
        onSelect={visitSearchResult}
        onClose={closeCommand}
      />
    </main>
  );
}

function DesktopSidebar({ pathname, adminName, adminRole, initials }: { pathname: string; adminName: string; adminRole: string; initials: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-width)] border-r border-[color:var(--border)] bg-[image:var(--gradient-panel)] lg:flex lg:flex-col">
      <SidebarContent pathname={pathname} adminName={adminName} adminRole={adminRole} initials={initials} />
    </aside>
  );
}

function MobileSidebar({ open, pathname, adminName, adminRole, initials, onClose }: { open: boolean; pathname: string; adminName: string; adminRole: string; initials: string; onClose: () => void }) {
  return (
    <>
      <button type="button" aria-label="Close navigation" onClick={onClose} className={`fixed inset-0 z-40 bg-[color:var(--overlay-bg)] backdrop-blur-sm transition lg:hidden ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`} />
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[var(--sidebar-width)] max-w-[86vw] flex-col border-r border-[color:var(--border)] bg-[color:var(--sidebar-bg)] shadow-[var(--shadow-lg)] transition-transform duration-[var(--duration-normal)] lg:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <button type="button" onClick={onClose} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]" aria-label="Close navigation">
          <X className="h-4 w-4" />
        </button>
        <SidebarContent pathname={pathname} adminName={adminName} adminRole={adminRole} initials={initials} />
      </aside>
    </>
  );
}

function SidebarContent({ pathname, adminName, adminRole, initials }: { pathname: string; adminName: string; adminRole: string; initials: string }) {
  return (
    <>
      <div className="border-b border-[color:var(--border-subtle)] px-5 py-5">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)] shadow-[var(--shadow-brand)]">
  △
</div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[20px] font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">Helix</span>
              <span className="rounded-[var(--radius-pill)] border border-[color:var(--border)] bg-[color:var(--primary-soft)] px-2 py-0.5 text-[7px] uppercase tracking-[0.16em] text-[color:var(--primary)]">OS</span>
            </div>
            <p className="mt-0.5 text-[8px] uppercase tracking-[0.17em] text-[color:var(--text-muted)]">Financial operating system</p>
          </div>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <nav className="space-y-5">
          {navigationGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-[8px] font-medium uppercase tracking-[0.2em] text-[color:var(--text-muted)]">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isRouteActive(pathname, item.href);
                  return (
                    <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`group relative flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-[11px] font-medium transition ${active ? "border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)] shadow-[var(--shadow-sm)]" : "border border-transparent text-[color:var(--text-secondary)] hover:border-[color:var(--border-subtle)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text-primary)]"}`}>
                      {active && <span className="absolute bottom-2.5 left-0 top-2.5 w-0.5 rounded-r-full bg-[color:var(--primary)] shadow-[var(--shadow-brand)]" />}
                      <Icon className={`h-[16px] w-[16px] shrink-0 transition ${active ? "text-[color:var(--primary)]" : "text-[color:var(--text-tertiary)] group-hover:text-[color:var(--primary)]"}`} />
                      <span className="flex-1">{item.label}</span>
                      {active && <ChevronRight className="h-3.5 w-3.5 text-[color:var(--primary)]" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="space-y-3 border-t border-[color:var(--border-subtle)] p-4">
        <Link href="/dashboard/reports" className="group block rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[image:var(--gradient-brand-soft)] p-3.5 transition hover:border-[color:var(--border-brand)]">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]"><Sparkles className="h-4 w-4" /></span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-[color:var(--text-primary)]">Executive reports</p>
              <p className="mt-1 text-[8px] leading-4 text-[color:var(--text-muted)]">Generate and publish live financial intelligence.</p>
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-soft)] p-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[10px] font-semibold text-[color:var(--primary)]">{initials}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-medium text-[color:var(--text-primary)]">{adminName}</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-[var(--radius-pill)] bg-[color:var(--success)]" />
              <p className="text-[8px] text-[color:var(--text-muted)]">{adminRole} · Online</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function CommandPalette({ open, query, results, selectedIndex, inputRef, onQueryChange, onKeyDown, onSelect, onClose }: { open: boolean; query: string; results: NavigationItem[]; selectedIndex: number; inputRef: React.RefObject<HTMLInputElement | null>; onQueryChange: (query: string) => void; onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void; onSelect: (href: string) => void; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-[color:var(--overlay-strong)] px-4 pt-[12vh] backdrop-blur-sm">
      <button type="button" aria-label="Close search" onClick={onClose} className="absolute inset-0" />
      <div role="dialog" aria-modal="true" aria-label="Search Helix" className="relative z-10 w-full max-w-[var(--command-palette-width)] overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-modal)]">
        <div className="flex items-center gap-3 border-b border-[color:var(--border-subtle)] px-4">
          <Search className="h-[18px] w-[18px] shrink-0 text-[color:var(--primary)]" />
          <input ref={inputRef} value={query} onChange={(event) => onQueryChange(event.target.value)} onKeyDown={onKeyDown} placeholder="Search pages, modules and workflows..." className="h-[62px] flex-1 bg-transparent text-[13px] text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]" />
          <button type="button" onClick={onClose} className="rounded-[var(--radius-sm)] border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2 py-1.5 text-[9px] text-[color:var(--text-tertiary)] transition hover:text-[color:var(--text-primary)]">ESC</button>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-2">
          {results.length > 0 ? (
            results.map((item, index) => {
              const Icon = item.icon;
              const selected = index === selectedIndex;
              return (
                <button key={item.href} type="button" onClick={() => onSelect(item.href)} className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] border px-3 py-3 text-left transition ${selected ? "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)]" : "border-transparent hover:border-[color:var(--border-subtle)] hover:bg-[color:var(--surface-soft)]"}`}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-soft)] text-[color:var(--primary)]"><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-[color:var(--text-primary)]">{item.label}</p>
                    <p className="mt-1 truncate text-[8px] text-[color:var(--text-muted)]">{item.keywords.join(" · ")}</p>
                  </div>
                  <span className="text-[9px] text-[color:var(--text-muted)]">Open</span>
                </button>
              );
            })
          ) : (
            <div className="p-8 text-center">
              <Boxes className="mx-auto h-8 w-8 text-[color:var(--text-muted)]" />
              <p className="mt-3 text-[11px] text-[color:var(--text-secondary)]">No matching Helix page was found.</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-[color:var(--border-subtle)] px-4 py-3 text-[8px] text-[color:var(--text-muted)]">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>ESC Close</span>
          <span className="ml-auto">Searches real application routes</span>
        </div>
      </div>
    </div>
  );
}