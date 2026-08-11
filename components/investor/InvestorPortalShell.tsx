"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  ChevronRight,
  CircleDollarSign,
  Command,
  FileText,
  FolderLock,
  Gauge,
  Menu,
  Search,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { InvestorNotificationBell } from "@/components/investor/InvestorNotificationBell";
import { signOutInvestor } from "@/lib/actions/investor-portal";
import type { InvestorPortalReadModel } from "@/types/investor-portal";

type PortalNavKey = "dashboard" | "investments" | "reports" | "documents" | "profile";

type NavigationItem = {
  key: PortalNavKey;
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
      { key: "dashboard", label: "Dashboard", href: "/investor", icon: Gauge, keywords: ["home", "overview", "portfolio"] },
    ],
  },
  {
    label: "Portfolio",
    items: [
      { key: "investments", label: "Investments", href: "/investor/investments", icon: CircleDollarSign, keywords: ["equity", "offers", "capital"] },
      { key: "reports", label: "Reports", href: "/investor/reports", icon: BarChart3, keywords: ["analytics", "valuation", "performance"] },
      { key: "documents", label: "Documents", href: "/investor/documents", icon: FolderLock, keywords: ["files", "certificates", "agreements"] },
    ],
  },
  {
    label: "Account",
    items: [
      { key: "profile", label: "Profile", href: "/investor/profile", icon: UserRound, keywords: ["account", "security", "details"] },
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

  if (targetPath === "/investor") return currentPath === targetPath;

  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

export function InvestorPortalShell({
  active,
  children,
  model,
}: {
  active: PortalNavKey;
  children: ReactNode;
  model: InvestorPortalReadModel;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const { summary } = model;

  const unreadNotifications = useMemo(
    () => model.notifications.filter((notification) => !notification.readAt).length,
    [model.notifications],
  );

  const searchResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return allNavigationItems;

    return allNavigationItems.filter((item) =>
      [item.label, item.href, ...item.keywords]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
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
    [closeCommand, router],
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
    <main className="min-h-screen bg-[var(--app-bg)] text-[var(--text-primary)]">
      <DesktopSidebar
        pathname={pathname}
        investorName={summary.investorName}
        investorRole="Investor"
        initials={summary.investorInitials}
        equityPercent={summary.equityPercent}
      />
      <MobileSidebar
        open={mobileNavigationOpen}
        pathname={pathname}
        investorName={summary.investorName}
        investorRole="Investor"
        initials={summary.investorInitials}
        equityPercent={summary.equityPercent}
        onClose={() => setMobileNavigationOpen(false)}
      />

      <section className="min-h-screen lg:ml-[296px]">
        <header className="sticky top-0 z-30 border-b border-[var(--primary-border)] bg-[var(--navbar-bg)] backdrop-blur-xl">
          <div className="flex h-[76px] items-center justify-between gap-4 px-4 sm:px-6 xl:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavigationOpen(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] transition hover:border-[var(--primary-border)] hover:text-[var(--primary)] lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-[18px] w-[18px]" />
              </button>

              <div className="min-w-0">
                <p className="truncate text-[9px] uppercase tracking-[0.19em] text-[var(--primary)]">
                  Investor Operating System
                </p>
                <h1 className="mt-1 truncate text-[17px] font-semibold tracking-[-0.025em] text-[var(--text-primary)] sm:text-[19px]">
                  {pageTitle(active)}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                className="hidden min-w-[260px] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-left transition hover:border-[var(--primary-border)] hover:bg-[var(--primary-soft)] md:flex"
                aria-label="Search Helix investor portal"
              >
                <Search className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
                <span className="flex-1 text-[11px] text-[var(--text-tertiary)]">Search investor portal</span>
                <span className="flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1 text-[9px] text-[var(--text-tertiary)]">
                  <Command className="h-3 w-3" /> K
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] transition hover:border-[var(--primary-border)] hover:text-[var(--primary)] md:hidden"
                aria-label="Search Helix investor portal"
              >
                <Search className="h-[17px] w-[17px]" />
              </button>

              <InvestorNotificationBell notifications={model.notifications} />

              <Link
                href="/investor/profile"
                className="hidden items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] py-1.5 pl-1.5 pr-3 xl:flex"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[11px] font-semibold text-[var(--primary)]">
                  {summary.investorInitials}
                </div>
                <div className="max-w-[145px]">
                  <p className="truncate text-[11px] font-medium text-[var(--text-primary)]">{summary.investorName}</p>
                  <p className="mt-0.5 text-[9px] text-[var(--text-tertiary)]">Investor</p>
                </div>
              </Link>

              <form action={signOutInvestor} className="hidden lg:block">
                <button
                  type="submit"
                  className="rounded-[var(--button-radius)] border border-[var(--primary-border)] bg-[var(--surface)] px-4 py-2.5 text-[11px] font-semibold text-[var(--primary)] shadow-[var(--shadow-xs)] transition duration-[var(--duration-fast)] hover:border-[var(--primary)] hover:bg-[var(--primary)] hover:text-[var(--text-on-brand)]"
                >
                  Logout
                </button>
              </form>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2.5 sm:px-6 lg:hidden">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[10px] font-semibold text-[var(--primary)]">
                {summary.investorInitials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[10px] text-[var(--text-secondary)]">{summary.investorName}</p>
                <p className="text-[8px] text-[var(--text-muted)]">Investor</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[8px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)] shadow-[var(--glow-success)]" />
              Live
              {unreadNotifications > 0 && (
                <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-2 py-1 text-[var(--primary)]">
                  {unreadNotifications} unread
                </span>
              )}
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1700px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
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

function DesktopSidebar({
  pathname,
  investorName,
  investorRole,
  initials,
  equityPercent,
}: {
  pathname: string;
  investorName: string;
  investorRole: string;
  initials: string;
  equityPercent: number;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[296px] border-r border-[var(--primary-border)] bg-[var(--sidebar-bg)] lg:flex lg:flex-col">
      <SidebarContent
        pathname={pathname}
        investorName={investorName}
        investorRole={investorRole}
        initials={initials}
        equityPercent={equityPercent}
      />
    </aside>
  );
}

function MobileSidebar({
  open,
  pathname,
  investorName,
  investorRole,
  initials,
  equityPercent,
  onClose,
}: {
  open: boolean;
  pathname: string;
  investorName: string;
  investorRole: string;
  initials: string;
  equityPercent: number;
  onClose: () => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-[var(--surface-soft)] backdrop-blur-sm transition lg:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[296px] max-w-[86vw] flex-col border-r border-[var(--primary-border)] bg-[var(--sidebar-bg)] shadow-[var(--shadow-lg)] transition-transform duration-200 lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent
          pathname={pathname}
          investorName={investorName}
          investorRole={investorRole}
          initials={initials}
          equityPercent={equityPercent}
        />
      </aside>
    </>
  );
}

function SidebarContent({
  pathname,
  investorName,
  investorRole,
  initials,
  equityPercent,
}: {
  pathname: string;
  investorName: string;
  investorRole: string;
  initials: string;
  equityPercent: number;
}) {
  return (
    <>
      <div className="border-b border-[var(--border)] px-5 py-5">
        <Link href="/investor" className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)] shadow-[var(--glow-brand)]">
            △
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[20px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">Helix</span>
              <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-2 py-0.5 text-[7px] uppercase tracking-[0.16em] text-[var(--primary)]">
                Investor
              </span>
            </div>
            <p className="mt-0.5 text-[8px] uppercase tracking-[0.17em] text-[var(--text-muted)]">
              Investor operating system
            </p>
          </div>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <nav className="space-y-5">
          {navigationGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-[8px] font-medium uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isRouteActive(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-medium transition ${
                        active
                          ? "border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)] shadow-[var(--shadow-sm)]"
                          : "border border-transparent text-[var(--text-tertiary)] hover:border-[var(--border)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {active && (
                        <span className="absolute bottom-2.5 left-0 top-2.5 w-0.5 rounded-r-full bg-[var(--primary)] shadow-[var(--glow-brand)]" />
                      )}
                      <Icon
                        className={`h-[16px] w-[16px] shrink-0 transition ${
                          active ? "text-[var(--primary)]" : "text-[var(--text-tertiary)] group-hover:text-[var(--primary)]"
                        }`}
                      />
                      <span className="flex-1">{item.label}</span>
                      {active && <ChevronRight className="h-3.5 w-3.5 text-[var(--primary)]" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="space-y-3 border-t border-[var(--border)] p-4">
        <Link
          href="/investor/reports"
          className="group block rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-brand-soft)] p-3.5 transition hover:border-[var(--primary-border)]"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-[var(--text-primary)]">Investor reports</p>
              <p className="mt-1 text-[8px] leading-4 text-[var(--text-muted)]">
                Review live company performance and investor documents.
              </p>
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[10px] font-semibold text-[var(--primary)]">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-medium text-[var(--text-secondary)]">{investorName}</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
              <p className="text-[8px] text-[var(--text-muted)]">
                {investorRole} · {formatPercent(equityPercent)} equity
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function CommandPalette({
  open,
  query,
  results,
  selectedIndex,
  inputRef,
  onQueryChange,
  onKeyDown,
  onSelect,
  onClose,
}: {
  open: boolean;
  query: string;
  results: NavigationItem[];
  selectedIndex: number;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onQueryChange: (query: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onSelect: (href: string) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-[var(--surface-soft)] px-4 pt-[12vh] backdrop-blur-sm">
      <button type="button" aria-label="Close search" onClick={onClose} className="absolute inset-0" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search investor portal"
        className="relative z-10 w-full max-w-[640px] overflow-hidden rounded-2xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-modal)]"
      >
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4">
          <Search className="h-[18px] w-[18px] shrink-0 text-[var(--primary)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search investor pages and documents..."
            className="h-[62px] flex-1 bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1.5 text-[9px] text-[var(--text-tertiary)] transition hover:text-[var(--text-secondary)]"
          >
            ESC
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-2">
          {results.length > 0 ? (
            results.map((item, index) => {
              const Icon = item.icon;
              const selected = index === selectedIndex;

              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => onSelect(item.href)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                    selected
                      ? "border-[var(--primary-border)] bg-[var(--primary-soft)]"
                      : "border-transparent hover:border-[var(--border)] hover:bg-[var(--surface-subtle)]"
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--primary)]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-[var(--text-primary)]">{item.label}</p>
                    <p className="mt-1 truncate text-[8px] text-[var(--text-muted)]">{item.keywords.join(" · ")}</p>
                  </div>
                  <span className="text-[9px] text-[var(--text-muted)]">Open</span>
                </button>
              );
            })
          ) : (
            <div className="px-4 py-10 text-center">
              <FileText className="mx-auto h-7 w-7 text-[var(--text-muted)]" />
              <p className="mt-3 text-[11px] text-[var(--text-tertiary)]">No investor pages found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function pageTitle(active: PortalNavKey): string {
  if (active === "investments") return "Investments";
  if (active === "reports") return "Reports";
  if (active === "documents") return "Documents";
  if (active === "profile") return "Profile";

  return "Dashboard";
}

function formatPercent(value: number): string {
  return `${Number(value || 0).toFixed(2).replace(/\.00$/, "")}%`;
}