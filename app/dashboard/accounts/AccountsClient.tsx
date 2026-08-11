"use client";

import { useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import type { Notification } from "@/types/notifications";
import type {
  CashAccount,
  CashCategory,
  CashTransaction,
} from "./page";

type ModalType =
  | "transaction"
  | "transfer"
  | "account"
  | "editAccount"
  | "archiveAccount"
  | null;
type TransactionFilter = "all" | "inflow" | "outflow" | "transfer";
type TransactionDirection = "inflow" | "outflow";
type AccountStatusFilter = "active" | "archived" | "all";
type DateRangeFilter =
  | "this_month"
  | "last_30_days"
  | "last_90_days"
  | "year_to_date"
  | "all_time";

type MetricChartPoint = {
  label: string;
  value: number;
};

type CashFlowPoint = {
  label: string;
  inflow: number;
  outflow: number;
  net: number;
};

type TopProductPoint = {
  name: string;
  revenue: number;
  units: number;
};

type Props = {
  companyName: string;
  adminName: string;
  currency: string;
  accounts: CashAccount[];
  categories: CashCategory[];
  transactions: CashTransaction[];
  error?: string;
  success?: string;
  addCashAccount: (formData: FormData) => void;
  updateCashAccount: (formData: FormData) => void;
  archiveCashAccount: (formData: FormData) => void;
  addCashTransaction: (formData: FormData) => void;
  transferCash: (formData: FormData) => void;
  notifications: Notification[];
  userId: string;
};

const PANEL =
  "rounded-2xl border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]";

export default function AccountsClient({
  companyName,
  adminName,
  currency,
  accounts,
  categories,
  transactions,
  error,
  success,
  addCashAccount,
  updateCashAccount,
  archiveCashAccount,
  addCashTransaction,
  transferCash,
  notifications,
  userId,
}: Props) {
  const [modal, setModal] = useState<ModalType>(null);
  const [transactionDirection, setTransactionDirection] =
    useState<TransactionDirection>("inflow");
  const [filter, setFilter] = useState<TransactionFilter>("all");
  const [accountFilter, setAccountFilter] =
    useState<AccountStatusFilter>("active");
  const [selectedAccount, setSelectedAccount] =
    useState<CashAccount | null>(null);
  const [openAccountMenuId, setOpenAccountMenuId] =
    useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] =
    useState<DateRangeFilter>("all_time");
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [accountIdFilter, setAccountIdFilter] = useState("");
  const [categoryNameFilter, setCategoryNameFilter] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTransaction, setSelectedTransaction] =
    useState<CashTransaction | null>(null);

  const transactionsPerPage = 8;

  const money = useMemo(
    () =>
      new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [currency]
  );

  const completedTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) => transaction.status === "completed"
      ),
    [transactions]
  );

  const dateRangeLabel = {
    this_month: "This month",
    last_30_days: "Last 30 days",
    last_90_days: "Last 90 days",
    year_to_date: "Year to date",
    all_time: "All time",
  }[dateRange];

  const dateRangeStart = useMemo(() => {
    const now = new Date();
    const start = new Date(now);

    if (dateRange === "this_month") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return start;
    }

    if (dateRange === "last_30_days") {
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return start;
    }

    if (dateRange === "last_90_days") {
      start.setDate(start.getDate() - 89);
      start.setHours(0, 0, 0, 0);
      return start;
    }

    if (dateRange === "year_to_date") {
      return new Date(now.getFullYear(), 0, 1);
    }

    return null;
  }, [dateRange]);

  const rangeTransactions = useMemo(() => {
    if (!dateRangeStart) return transactions;

    return transactions.filter((transaction) => {
      if (!transaction.transaction_date) return false;

      const transactionDate = new Date(transaction.transaction_date);
      return (
        !Number.isNaN(transactionDate.getTime()) &&
        transactionDate >= dateRangeStart
      );
    });
  }, [dateRangeStart, transactions]);

  const completedRangeTransactions = useMemo(
    () =>
      rangeTransactions.filter(
        (transaction) => transaction.status === "completed"
      ),
    [rangeTransactions]
  );

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.status === "active"),
    [accounts]
  );

  const archivedAccounts = useMemo(
    () => accounts.filter((account) => account.status === "archived"),
    [accounts]
  );

  const visibleAccounts = useMemo(() => {
    if (accountFilter === "all") return accounts;
    return accounts.filter((account) => account.status === accountFilter);
  }, [accountFilter, accounts]);

  const totalCash = useMemo(
    () =>
      activeAccounts.reduce(
        (sum, account) => sum + Number(account.balance || 0),
        0
      ),
    [activeAccounts]
  );

  const cashIn = useMemo(
    () =>
      completedRangeTransactions
        .filter(
          (transaction) =>
            transaction.direction === "inflow" &&
            transaction.source_type !== "transfer"
        )
        .reduce(
          (sum, transaction) => sum + Number(transaction.amount || 0),
          0
        ),
    [completedRangeTransactions]
  );

  const cashOut = useMemo(
    () =>
      completedRangeTransactions
        .filter(
          (transaction) =>
            transaction.direction === "outflow" &&
            transaction.source_type !== "transfer"
        )
        .reduce(
          (sum, transaction) => sum + Number(transaction.amount || 0),
          0
        ),
    [completedRangeTransactions]
  );

  const netCashFlow = cashIn - cashOut;

  const metricChartData = useMemo(() => {
    const daily = new Map<
      string,
      {
        date: Date;
        inflow: number;
        outflow: number;
      }
    >();

    completedRangeTransactions.forEach((transaction) => {
      if (transaction.source_type === "transfer") return;
      if (!transaction.transaction_date) return;

      const date = new Date(transaction.transaction_date);
      if (Number.isNaN(date.getTime())) return;

      const amount = Number(transaction.amount || 0);
      if (!Number.isFinite(amount)) return;

      const key = date.toISOString().slice(0, 10);
      const existing = daily.get(key) || {
        date,
        inflow: 0,
        outflow: 0,
      };

      if (transaction.direction === "inflow") {
        existing.inflow += amount;
      } else {
        existing.outflow += amount;
      }

      daily.set(key, existing);
    });

    const orderedDays = Array.from(daily.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-12);

    const periodMovement = completedRangeTransactions.reduce(
      (sum, transaction) => {
        if (transaction.source_type === "transfer") return sum;

        const amount = Number(transaction.amount || 0);
        if (!Number.isFinite(amount)) return sum;

        return transaction.direction === "inflow"
          ? sum + amount
          : sum - amount;
      },
      0
    );

    let runningBalance = totalCash - periodMovement;

    const totalCashHistory: MetricChartPoint[] = [];
    const cashInHistory: MetricChartPoint[] = [];
    const cashOutHistory: MetricChartPoint[] = [];
    const netCashHistory: MetricChartPoint[] = [];
    const cashFlowHistory: CashFlowPoint[] = [];

    orderedDays.forEach((day) => {
      const label = day.date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      });
      const dailyNet = day.inflow - day.outflow;

      runningBalance += dailyNet;

      totalCashHistory.push({ label, value: runningBalance });
      cashInHistory.push({ label, value: day.inflow });
      cashOutHistory.push({ label, value: day.outflow });
      netCashHistory.push({ label, value: dailyNet });
      cashFlowHistory.push({
        label,
        inflow: day.inflow,
        outflow: day.outflow,
        net: dailyNet,
      });
    });

    if (orderedDays.length === 0) {
      const label = new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      });

      totalCashHistory.push({ label, value: totalCash });
      cashInHistory.push({ label, value: 0 });
      cashOutHistory.push({ label, value: 0 });
      netCashHistory.push({ label, value: 0 });
      cashFlowHistory.push({
        label,
        inflow: 0,
        outflow: 0,
        net: 0,
      });
    }

    return {
      totalCashHistory,
      cashInHistory,
      cashOutHistory,
      netCashHistory,
      cashFlowHistory,
    };
  }, [completedRangeTransactions, totalCash]);

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rangeTransactions.filter((transaction) => {
      const isTransfer = transaction.source_type === "transfer";
      const matchesDirection =
        filter === "all" ||
        (filter === "transfer" && isTransfer) ||
        (filter !== "transfer" && transaction.direction === filter);

      const account = getTransactionAccount(transaction);
      const category =
        getTransactionCategory(transaction)?.name ||
        transaction.category ||
        "Other";

      const matchesAccount =
        !accountIdFilter || account?.id === accountIdFilter;
      const matchesCategory =
        !categoryNameFilter || category === categoryNameFilter;
      const matchesSource =
        !sourceTypeFilter ||
        transaction.source_type === sourceTypeFilter;

      if (
        !matchesDirection ||
        !matchesAccount ||
        !matchesCategory ||
        !matchesSource
      ) {
        return false;
      }

      if (!query) return true;

      return [
        account?.name,
        category,
        transaction.description,
        transaction.reference,
        transaction.source_type,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [
    accountIdFilter,
    categoryNameFilter,
    filter,
    rangeTransactions,
    search,
    sourceTypeFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTransactions.length / transactionsPerPage)
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedTransactions = filteredTransactions.slice(
    (safeCurrentPage - 1) * transactionsPerPage,
    safeCurrentPage * transactionsPerPage
  );

  const sourceTypes = useMemo(
    () =>
      Array.from(
        new Set(
          transactions
            .map((transaction) => transaction.source_type)
            .filter(Boolean)
        )
      ).sort(),
    [transactions]
  );

  const availableCategoryNames = useMemo(
    () =>
      Array.from(
        new Set(
          transactions.map(
            (transaction) =>
              getTransactionCategory(transaction)?.name ||
              transaction.category ||
              "Other"
          )
        )
      ).sort(),
    [transactions]
  );

  const topProducts = useMemo<TopProductPoint[]>(() => {
    const totals = new Map<string, TopProductPoint>();

    completedRangeTransactions
      .filter(
        (transaction) =>
          transaction.source_type === "sale" &&
          transaction.direction === "inflow"
      )
      .forEach((transaction) => {
        const description = String(
          transaction.description || "Product sale"
        ).trim();

        const quantityMatch = description.match(
          /^\s*(\d+(?:\.\d+)?)\s*[×xX]\s*(.+?)\s*$/
        );

        const units = quantityMatch
          ? Number(quantityMatch[1] || 0)
          : 0;
        const productName = (
          quantityMatch?.[2] ||
          description ||
          "Product"
        ).trim();

        const key = productName.toLowerCase();
        const current = totals.get(key) || {
          name: productName,
          revenue: 0,
          units: 0,
        };

        current.revenue += Number(transaction.amount || 0);
        current.units += Number.isFinite(units) ? units : 0;

        totals.set(key, current);
      });

    return Array.from(totals.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [completedRangeTransactions]);


  function exportTransactions() {
    const headers = [
      "Date",
      "Account",
      "Category",
      "Description",
      "Direction",
      "Amount",
      "Source",
      "Reference",
      "Status",
    ];

    const rows = filteredTransactions.map((transaction) => [
      formatDate(transaction.transaction_date),
      getTransactionAccount(transaction)?.name || "Unassigned",
      getTransactionCategory(transaction)?.name ||
        transaction.category ||
        "Other",
      transaction.description || "",
      transaction.direction,
      Number(transaction.amount || 0).toFixed(2),
      transaction.source_type,
      transaction.reference || "",
      transaction.status,
    ]);

    const escapeCell = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCell).join(","))
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `helix-accounts-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function resetTransactionFilters() {
    setAccountIdFilter("");
    setCategoryNameFilter("");
    setSourceTypeFilter("");
    setFilter("all");
    setSearch("");
    setCurrentPage(1);
  }

  function openTransaction(direction: TransactionDirection) {
    setTransactionDirection(direction);
    setModal("transaction");
  }

  function openEditAccount(account: CashAccount) {
    setSelectedAccount(account);
    setOpenAccountMenuId(null);
    setModal("editAccount");
  }

  function openArchiveAccount(account: CashAccount) {
    setSelectedAccount(account);
    setOpenAccountMenuId(null);
    setModal("archiveAccount");
  }

  function closeModal() {
    setModal(null);
    setSelectedAccount(null);
  }

  return (
    <AdminShell
      title="Accounts"
      adminName={adminName}
      adminRole="Founder"
      showPageHeader={false}
      notifications={notifications}
      userId={userId}
    >
      <main className="min-h-screen bg-[color:var(--app-bg)] text-[color:var(--text-primary)]">
        <div className="mx-auto w-full max-w-[1680px] space-y-6 pb-12">
          <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
            <div>
              <div className="text-[30px] font-semibold leading-none tracking-[-0.04em]">
                Accounts
              </div>
              <p className="mt-2 text-[13px] text-[color:var(--text-tertiary)]">
                Manage {companyName}&apos;s accounts, transactions and cash
                activity.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setDateMenuOpen((open) => !open);
                    setFiltersOpen(false);
                  }}
                  className="flex h-11 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-[13px] text-[color:var(--text-secondary)] transition hover:border-[color:var(--border)] hover:text-[color:var(--text-primary)]"
                >
                  <CalendarIcon />
                  {dateRangeLabel}
                  <ChevronDownIcon />
                </button>

                {dateMenuOpen && (
                  <DateRangeMenu
                    value={dateRange}
                    onChange={(nextRange) => {
                      setDateRange(nextRange);
                      setDateMenuOpen(false);
                      setCurrentPage(1);
                    }}
                  />
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setFiltersOpen(true);
                  setDateMenuOpen(false);
                }}
                className="flex h-11 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-[13px] text-[color:var(--text-secondary)] transition hover:border-[color:var(--border)] hover:text-[color:var(--text-primary)]"
              >
                <FilterIcon />
                Filters
                {(accountIdFilter ||
                  categoryNameFilter ||
                  sourceTypeFilter) && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--primary)] px-1 text-[10px] font-semibold text-[color:var(--text-on-brand)]">
                    {
                      [
                        accountIdFilter,
                        categoryNameFilter,
                        sourceTypeFilter,
                      ].filter(Boolean).length
                    }
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => openTransaction("inflow")}
                className="flex h-11 items-center gap-2 rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary)] px-5 text-[13px] font-semibold text-[color:var(--text-on-brand)] transition hover:bg-[color:var(--primary)]"
              >
                <PlusIcon />
                New Transaction
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger)]">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-4 py-3 text-sm text-[color:var(--primary)]">
              {success}
            </div>
          )}

          <section className="grid gap-5 md:grid-cols-2">
            <MetricCard
              label="Total Cash"
              value={money.format(totalCash)}
              note="Across active accounts"
              tone="cyan"
              icon={<WalletIcon />}
              chartType="line"
              chartData={metricChartData.totalCashHistory}
              valueFormatter={(chartValue) => money.format(chartValue)}
            />
            <MetricCard
              label="Cash In"
              value={money.format(cashIn)}
              note={`${dateRangeLabel} inflows`}
              tone="green"
              icon={<ArrowDownIcon />}
              chartType="bar"
              chartData={metricChartData.cashInHistory}
              valueFormatter={(chartValue) => money.format(chartValue)}
            />
            <MetricCard
              label="Cash Out"
              value={money.format(cashOut)}
              note={`${dateRangeLabel} outflows`}
              tone="red"
              icon={<ArrowUpIcon />}
              chartType="bar"
              chartData={metricChartData.cashOutHistory}
              valueFormatter={(chartValue) => money.format(chartValue)}
            />
            <MetricCard
              label="Net Cash Flow"
              value={money.format(netCashFlow)}
              note={`${dateRangeLabel} net movement`}
              tone="blue"
              icon={<PulseIcon />}
              chartType="line"
              chartData={metricChartData.netCashHistory}
              valueFormatter={(chartValue) => money.format(chartValue)}
            />
          </section>

          <section className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <SectionHeader
                  title="Financial Accounts"
                  actionLabel={`${activeAccounts.length} active · ${archivedAccounts.length} archived`}
                />

                <div className="flex w-fit rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-1">
                  {(
                    [
                      ["active", "Active"],
                      ["archived", "Archived"],
                      ["all", "All"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setAccountFilter(value);
                        setOpenAccountMenuId(null);
                      }}
                      className={`rounded-lg px-3 py-2 text-[11px] font-medium transition ${
                        accountFilter === value
                          ? "bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
                          : "text-[color:var(--text-tertiary)] hover:text-[color:var(--text-secondary)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {visibleAccounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    money={money}
                    menuOpen={openAccountMenuId === account.id}
                    onToggleMenu={() =>
                      setOpenAccountMenuId((current) =>
                        current === account.id ? null : account.id
                      )
                    }
                    onEdit={() => openEditAccount(account)}
                    onArchive={() => openArchiveAccount(account)}
                  />
                ))}

                {accountFilter !== "archived" && (
                  <button
                    type="button"
                    onClick={() => setModal("account")}
                    className="flex min-h-[190px] flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)] transition hover:border-[color:var(--border-brand)] hover:bg-[color:var(--primary-soft)]"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)]">
                      <PlusIcon large />
                    </span>
                    <span className="mt-3 text-xs font-medium">Add Account</span>
                  </button>
                )}

                {visibleAccounts.length === 0 && accountFilter === "archived" && (
                  <div className="sm:col-span-2 xl:col-span-5">
                    <EmptyState text="No archived accounts." />
                  </div>
                )}
              </div>
            </div>

            <RecentActivity
              transactions={transactions.slice(0, 5)}
              money={money}
            />
          </section>

          <section className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className={`${PANEL} overflow-hidden`}>
              <div className="flex flex-col gap-4 border-b border-[color:var(--border)] p-5 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="text-[15px] font-semibold">Transactions</div>
                  <div className="mt-4 flex flex-wrap gap-5 text-[12px]">
                    {(
                      [
                        ["all", "All"],
                        ["inflow", "Inflow"],
                        ["outflow", "Outflow"],
                        ["transfer", "Transfers"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFilter(value)}
                        className={`relative pb-2 transition ${
                          filter === value
                            ? "text-[color:var(--primary)]"
                            : "text-[color:var(--text-tertiary)] hover:text-[color:var(--text-secondary)]"
                        }`}
                      >
                        {label}
                        {filter === value && (
                          <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[color:var(--primary)]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <label className="flex h-10 min-w-[230px] items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3">
                    <SearchIcon />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search transactions..."
                      className="w-full bg-transparent text-xs text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setFiltersOpen(true)}
                    className="flex h-10 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 text-xs text-[color:var(--text-secondary)] transition hover:border-[color:var(--border)] hover:text-[color:var(--text-primary)]"
                  >
                    <FilterIcon />
                    Filters
                  </button>
                  <button
                    type="button"
                    onClick={exportTransactions}
                    disabled={filteredTransactions.length === 0}
                    className="flex h-10 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 text-xs text-[color:var(--text-secondary)] transition hover:border-[color:var(--border)] hover:text-[color:var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <DownloadIcon />
                    Export
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-left">
                  <thead className="bg-[color:var(--surface-soft)] text-[10px] uppercase tracking-[0.13em] text-[color:var(--text-tertiary)]">
                    <tr className="border-b border-[color:var(--border)]">
                      <th className="px-5 py-4">Date</th>
                      <th className="px-5 py-4">Account</th>
                      <th className="px-5 py-4">Category</th>
                      <th className="px-5 py-4">Description</th>
                      <th className="px-5 py-4">Direction</th>
                      <th className="px-5 py-4">Amount</th>
                      <th className="px-5 py-4">Source</th>
                      <th className="px-5 py-4">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedTransactions.length > 0 ? (
                      paginatedTransactions.map((transaction) => (
                        <TransactionRow
                          key={transaction.id}
                          transaction={transaction}
                          money={money}
                          onOpen={() =>
                            setSelectedTransaction(transaction)
                          }
                        />
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-5 py-20 text-center text-sm text-[color:var(--text-tertiary)]"
                        >
                          No transactions found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-[color:var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-[color:var(--text-tertiary)]">
                  Showing{" "}
                  {filteredTransactions.length === 0
                    ? 0
                    : (safeCurrentPage - 1) * transactionsPerPage + 1}
                  –
                  {Math.min(
                    safeCurrentPage * transactionsPerPage,
                    filteredTransactions.length
                  )}{" "}
                  of {filteredTransactions.length} transactions
                </p>

                <div className="flex items-center gap-2">
                  <PaginationButton
                    icon={<ChevronLeftIcon />}
                    disabled={safeCurrentPage <= 1}
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                  />

                  {Array.from(
                    { length: Math.min(totalPages, 5) },
                    (_, index) => index + 1
                  ).map((page) => (
                    <PaginationButton
                      key={page}
                      label={String(page)}
                      active={safeCurrentPage === page}
                      onClick={() => setCurrentPage(page)}
                    />
                  ))}

                  <PaginationButton
                    icon={<ChevronRightIcon />}
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.min(totalPages, page + 1)
                      )
                    }
                  />
                </div>
              </div>
            </div>

            <aside className="space-y-5">
              <NotificationPanel notifications={notifications.slice(0, 4)} />
              <QuickActions
                onInflow={() => openTransaction("inflow")}
                onOutflow={() => openTransaction("outflow")}
                onTransfer={() => setModal("transfer")}
                onAccount={() => setModal("account")}
              />
            </aside>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)_320px]">
            <CashFlowChart
              data={metricChartData.cashFlowHistory}
              money={money}
              periodLabel={dateRangeLabel}
            />
            <TopProductsChart
              products={topProducts}
              money={money}
            />
            <AccountBalances accounts={activeAccounts} money={money} />
          </section>

          <p className="text-center text-[11px] text-[color:var(--text-muted)]">
            All amounts are shown in {currency}
          </p>
        </div>

        {modal === "transaction" && (
          <Modal
            title={
              transactionDirection === "inflow"
                ? "Add Cash Inflow"
                : "Add Cash Outflow"
            }
            onClose={closeModal}
          >
            <form action={addCashTransaction} className="space-y-4">
              <input
                type="hidden"
                name="direction"
                value={transactionDirection}
              />

              <AccountSelect accounts={activeAccounts} name="account_id" />
              <CategorySelect
                categories={categories}
                name="category_id"
                direction={transactionDirection}
              />
              <Input
                label="Amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
              />
              <Input
                label="Transaction date"
                name="transaction_date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
              <Input label="Reference" name="reference" />
              <TextArea label="Description" name="description" />
              <SubmitButton>
                {transactionDirection === "inflow"
                  ? "Record Inflow"
                  : "Record Outflow"}
              </SubmitButton>
            </form>
          </Modal>
        )}

        {modal === "transfer" && (
          <Modal title="Transfer Funds" onClose={closeModal}>
            <form action={transferCash} className="space-y-4">
              <AccountSelect
                accounts={activeAccounts}
                name="from_account_id"
                label="From account"
              />
              <AccountSelect
                accounts={activeAccounts}
                name="to_account_id"
                label="To account"
              />
              <Input
                label="Amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
              />
              <Input
                label="Transfer date"
                name="transaction_date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
              <TextArea label="Description" name="description" />
              <SubmitButton>Transfer Funds</SubmitButton>
            </form>
          </Modal>
        )}

        {modal === "account" && (
          <Modal title="Add Financial Account" onClose={closeModal}>
            <form action={addCashAccount} className="space-y-4">
              <Input
                label="Account name"
                name="name"
                placeholder="Business Current Account"
                required
              />
              <Select
                label="Account type"
                name="account_type"
                options={[
                  ["bank", "Bank account"],
                  ["cash", "Cash"],
                  ["petty_cash", "Petty cash"],
                  ["payment_processor", "Payment processor"],
                  ["credit_card", "Credit card"],
                  ["loan", "Loan account"],
                  ["other", "Other"],
                ]}
              />
              <Input
                label="Currency"
                name="currency"
                defaultValue={currency}
                maxLength={3}
                required
              />
              <Input
                label="Opening balance"
                name="opening_balance"
                type="number"
                step="0.01"
                defaultValue="0"
                required
              />
              <TextArea label="Notes" name="notes" />
              <SubmitButton>Add Account</SubmitButton>
            </form>
          </Modal>
        )}

        {modal === "editAccount" && selectedAccount && (
          <Modal title="Edit Financial Account" onClose={closeModal}>
            <form action={updateCashAccount} className="space-y-4">
              <input
                type="hidden"
                name="account_id"
                value={selectedAccount.id}
              />

              <Input
                label="Account name"
                name="name"
                defaultValue={selectedAccount.name}
                required
              />

              <ReadOnlyField
                label="Account type"
                value={selectedAccount.account_type.replaceAll("_", " ")}
              />
              <ReadOnlyField
                label="Currency"
                value={selectedAccount.currency}
              />
              <ReadOnlyField
                label="Opening balance"
                value={money.format(Number(selectedAccount.opening_balance || 0))}
              />

              <TextArea
                label="Notes"
                name="notes"
                defaultValue={selectedAccount.notes || ""}
              />

              <p className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-[11px] leading-5 text-[color:var(--text-tertiary)]">
                Account type, currency and opening balance are locked to protect
                the financial audit history.
              </p>

              <SubmitButton>Save Account Changes</SubmitButton>
            </form>
          </Modal>
        )}

        {modal === "archiveAccount" && selectedAccount && (
          <Modal title="Archive Financial Account" onClose={closeModal}>
            <form action={archiveCashAccount} className="space-y-4">
              <input
                type="hidden"
                name="account_id"
                value={selectedAccount.id}
              />

              <div className="rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] p-4">
                <p className="text-sm font-semibold text-[color:var(--warning)]">
                  Archive {selectedAccount.name}?
                </p>
                <p className="mt-2 text-xs leading-5 text-[color:var(--text-tertiary)]">
                  The account will stop appearing in new transaction and transfer
                  forms. Its ledger history will remain available for reporting
                  and audit purposes.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <ReadOnlyField
                  label="Current balance"
                  value={money.format(Number(selectedAccount.balance || 0))}
                />
                <ReadOnlyField
                  label="Status"
                  value={selectedAccount.status}
                />
              </div>

              {Math.round(Number(selectedAccount.balance || 0) * 100) !== 0 && (
                <p className="rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-4 py-3 text-xs leading-5 text-[color:var(--danger)]">
                  This account cannot be archived until its balance is zero.
                  Transfer or adjust the remaining balance first.
                </p>
              )}

              <button
                type="submit"
                disabled={
                  Math.round(Number(selectedAccount.balance || 0) * 100) !== 0
                }
                className="w-full rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--warning)] transition hover:bg-[color:var(--warning-soft)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Archive Account
              </button>
            </form>
          </Modal>
        )}

        {filtersOpen && (
          <Modal
            title="Transaction Filters"
            onClose={() => setFiltersOpen(false)}
          >
            <div className="space-y-4">
              <label className="block text-xs text-[color:var(--text-secondary)]">
                Account
                <select
                  value={accountIdFilter}
                  onChange={(event) => {
                    setAccountIdFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
                >
                  <option value="">All accounts</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs text-[color:var(--text-secondary)]">
                Category
                <select
                  value={categoryNameFilter}
                  onChange={(event) => {
                    setCategoryNameFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
                >
                  <option value="">All categories</option>
                  {availableCategoryNames.map((categoryName) => (
                    <option key={categoryName} value={categoryName}>
                      {categoryName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs text-[color:var(--text-secondary)]">
                Source
                <select
                  value={sourceTypeFilter}
                  onChange={(event) => {
                    setSourceTypeFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm capitalize text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
                >
                  <option value="">All sources</option>
                  {sourceTypes.map((sourceType) => (
                    <option key={sourceType} value={sourceType}>
                      {sourceType.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetTransactionFilters}
                  className="rounded-xl border border-[color:var(--border)] px-4 py-3 text-sm text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--text-primary)]"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary)] px-4 py-3 text-sm font-semibold text-[color:var(--text-on-brand)] transition hover:bg-[color:var(--primary)]"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </Modal>
        )}

        {selectedTransaction && (
          <Modal
            title="Transaction Details"
            onClose={() => setSelectedTransaction(null)}
          >
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <ReadOnlyField
                  label="Date"
                  value={formatDate(
                    selectedTransaction.transaction_date
                  )}
                />
                <ReadOnlyField
                  label="Amount"
                  value={money.format(
                    Number(selectedTransaction.amount || 0)
                  )}
                />
                <ReadOnlyField
                  label="Account"
                  value={
                    getTransactionAccount(selectedTransaction)?.name ||
                    "Unassigned"
                  }
                />
                <ReadOnlyField
                  label="Direction"
                  value={selectedTransaction.direction}
                />
                <ReadOnlyField
                  label="Category"
                  value={
                    getTransactionCategory(selectedTransaction)?.name ||
                    selectedTransaction.category ||
                    "Other"
                  }
                />
                <ReadOnlyField
                  label="Source"
                  value={selectedTransaction.source_type.replaceAll(
                    "_",
                    " "
                  )}
                />
                <ReadOnlyField
                  label="Status"
                  value={selectedTransaction.status}
                />
                <ReadOnlyField
                  label="Reference"
                  value={selectedTransaction.reference || "—"}
                />
              </div>

              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
                  Description
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--text-secondary)]">
                  {selectedTransaction.description ||
                    "No description provided."}
                </p>
              </div>
            </div>
          </Modal>
        )}

      </main>
    </AdminShell>
  );
}

function MetricCard({
  label,
  value,
  note,
  tone,
  icon,
  chartType,
  chartData,
  valueFormatter,
}: {
  label: string;
  value: string;
  note: string;
  tone: "cyan" | "green" | "red" | "blue";
  icon: React.ReactNode;
  chartType: "line" | "bar";
  chartData: MetricChartPoint[];
  valueFormatter: (value: number) => string;
}) {
  const toneClasses = {
    cyan: "text-[color:var(--primary)] bg-[color:var(--primary-soft)] border-[color:var(--border-brand)]",
    green:
      "text-[color:var(--success)] bg-[color:var(--success-soft)] border-[color:var(--success-border)]",
    red: "text-[color:var(--danger)] bg-[color:var(--danger-soft)] border-[color:var(--danger-border)]",
    blue: "text-[color:var(--secondary)] bg-[color:var(--secondary-soft)] border-[color:var(--secondary-border)]",
  }[tone];

  return (
    <div className={`${PANEL} min-h-[248px] p-6`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-[color:var(--text-secondary)]">{label}</p>
          <p className="mt-4 text-[30px] font-semibold tracking-[-0.045em]">
            {value}
          </p>
          <p className="mt-4 text-[12px] text-[color:var(--text-muted)]">{note}</p>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${toneClasses}`}
        >
          {icon}
        </div>
      </div>

      <ProfessionalMetricChart
        tone={tone}
        type={chartType}
        data={chartData}
        valueFormatter={valueFormatter}
      />
    </div>
  );
}

function ProfessionalMetricChart({
  tone,
  type,
  data,
  valueFormatter,
}: {
  tone: "cyan" | "green" | "red" | "blue";
  type: "line" | "bar";
  data: MetricChartPoint[];
  valueFormatter: (value: number) => string;
}) {
  const color = {
    cyan: "var(--chart-1)",
    green: "var(--chart-3)",
    red: "var(--chart-6)",
    blue: "var(--chart-2)",
  }[tone];

  const width = 620;
  const height = 118;
  const left = 48;
  const right = 12;
  const top = 8;
  const bottom = 23;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const visibleData =
    data.length > 0 ? data : [{ label: "—", value: 0 }];
  const values = visibleData.map((point) => Number(point.value || 0));
  const rawMin = Math.min(...values, 0);
  const rawMax = Math.max(...values, 0);
  const baseRange = Math.max(rawMax - rawMin, Math.abs(rawMax), 1);
  const minimum = rawMin - baseRange * 0.08;
  const maximum = rawMax + baseRange * 0.08;
  const range = Math.max(maximum - minimum, 1);

  const valueToY = (value: number) =>
    top + plotHeight - ((value - minimum) / range) * plotHeight;

  const points = visibleData.map((point, index) => ({
    ...point,
    x:
      visibleData.length === 1
        ? left + plotWidth / 2
        : left + (index / (visibleData.length - 1)) * plotWidth,
    y: valueToY(Number(point.value || 0)),
  }));

  const linePath = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(
          2
        )} ${point.y.toFixed(2)}`
    )
    .join(" ");

  const zeroY =
    minimum <= 0 && maximum >= 0
      ? valueToY(0)
      : top + plotHeight;

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(
          2
        )} ${zeroY.toFixed(2)} L ${points[0].x.toFixed(
          2
        )} ${zeroY.toFixed(2)} Z`
      : "";

  const barGap = 7;
  const barWidth = Math.max(
    7,
    (plotWidth - barGap * Math.max(visibleData.length - 1, 0)) /
      Math.max(visibleData.length, 1)
  );

  const yTicks = [maximum, (maximum + minimum) / 2, minimum];
  const firstLabel = visibleData[0]?.label || "—";
  const middleLabel =
    visibleData[Math.floor((visibleData.length - 1) / 2)]?.label ||
    "—";
  const lastLabel =
    visibleData[visibleData.length - 1]?.label || "—";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-5 h-[118px] w-full overflow-visible"
      role="img"
      aria-label="Live financial metric chart"
    >
      {yTicks.map((tick, index) => {
        const y = top + (index / (yTicks.length - 1)) * plotHeight;

        return (
          <g key={`${tick}-${index}`}>
            <line
              x1={left}
              x2={width - right}
              y1={y}
              y2={y}
              stroke="var(--chart-grid)"
            />
            <text
              x={left - 8}
              y={y + 3}
              textAnchor="end"
              fill="var(--chart-label)"
              fontSize="8"
            >
              {formatCompactMetricValue(tick)}
            </text>
          </g>
        );
      })}

      {minimum < 0 && maximum > 0 && (
        <line
          x1={left}
          x2={width - right}
          y1={zeroY}
          y2={zeroY}
          stroke="var(--chart-grid)"
          strokeDasharray="4 4"
        />
      )}

      {type === "bar" ? (
        visibleData.map((point, index) => {
          const value = Number(point.value || 0);
          const valueY = valueToY(value);
          const x = left + index * (barWidth + barGap);
          const y = value >= 0 ? valueY : zeroY;
          const barHeight = Math.max(Math.abs(zeroY - valueY), 1);

          return (
            <rect
              key={`${point.label}-${index}`}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx="2.5"
              fill={color}
              opacity="0.84"
            >
            </rect>
          );
        })
      ) : (
        <>
          <defs>
            <linearGradient
              id={`metric-area-${tone}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={areaPath}
            fill={`url(#metric-area-${tone})`}
          />
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((point, index) => (
            <circle
              key={`${point.label}-${index}`}
              cx={point.x}
              cy={point.y}
              r="2.8"
              fill="var(--surface)"
              stroke={color}
              strokeWidth="2"
            >
            </circle>
          ))}
        </>
      )}

      <text
        x={left}
        y={height - 3}
        textAnchor="start"
        fill="var(--chart-label)"
        fontSize="8"
      >
        {firstLabel}
      </text>
      <text
        x={left + plotWidth / 2}
        y={height - 3}
        textAnchor="middle"
        fill="var(--chart-label)"
        fontSize="8"
      >
        {middleLabel}
      </text>
      <text
        x={width - right}
        y={height - 3}
        textAnchor="end"
        fill="var(--chart-label)"
        fontSize="8"
      >
        {lastLabel}
      </text>
    </svg>
  );
}

function formatCompactMetricValue(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absolute >= 1_000_000) {
    return `${sign}${(absolute / 1_000_000).toFixed(1)}m`;
  }

  if (absolute >= 1_000) {
    return `${sign}${(absolute / 1_000).toFixed(
      absolute >= 10_000 ? 0 : 1
    )}k`;
  }

  if (absolute >= 100) {
    return `${sign}${Math.round(absolute).toLocaleString("en-GB")}`;
  }

  if (absolute >= 10) {
    return `${sign}${absolute.toFixed(0)}`;
  }

  return `${sign}${absolute.toFixed(
    absolute % 1 === 0 ? 0 : 1
  )}`;
}

function DateRangeMenu({
  value,
  onChange,
}: {
  value: DateRangeFilter;
  onChange: (value: DateRangeFilter) => void;
}) {
  const ranges: [DateRangeFilter, string][] = [
    ["this_month", "This month"],
    ["last_30_days", "Last 30 days"],
    ["last_90_days", "Last 90 days"],
    ["year_to_date", "Year to date"],
    ["all_time", "All time"],
  ];

  return (
    <div className="absolute right-0 top-12 z-40 w-48 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-1 shadow-2xl shadow-[var(--shadow-card)]">
      {ranges.map(([rangeValue, label]) => (
        <button
          key={rangeValue}
          type="button"
          onClick={() => onChange(rangeValue)}
          className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs transition ${
            value === rangeValue
              ? "bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
              : "text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--text-primary)]"
          }`}
        >
          {label}
          {value === rangeValue && <CheckIcon />}
        </button>
      ))}
    </div>
  );
}

function SectionHeader({
  title,
  actionLabel,
}: {
  title: string;
  actionLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <div className="text-[16px] font-semibold">{title}</div>
      {actionLabel && (
        <span className="text-[11px] font-medium text-[color:var(--primary)]">
          {actionLabel}
        </span>
      )}
    </div>
  );
}

function AccountCard({
  account,
  money,
  menuOpen,
  onToggleMenu,
  onEdit,
  onArchive,
}: {
  account: CashAccount;
  money: Intl.NumberFormat;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const archived = account.status === "archived";

  return (
    <div
      className={`${PANEL} relative min-h-[190px] p-4 ${
        archived ? "opacity-65" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
            archived
              ? "border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-tertiary)]"
              : "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
          }`}
        >
          <AccountTypeIcon type={account.account_type} />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={onToggleMenu}
            aria-label={`Manage ${account.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--text-tertiary)] transition hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--text-primary)]"
          >
            <MoreIcon />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-1 shadow-2xl shadow-[var(--shadow-card)]">
              <button
                type="button"
                onClick={onEdit}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--text-primary)]"
              >
                <EditIcon />
                Edit account
              </button>

              {!archived && (
                <button
                  type="button"
                  onClick={onArchive}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs text-[color:var(--warning)] transition hover:bg-[color:var(--warning-soft)] hover:text-[color:var(--warning)]"
                >
                  <ArchiveIcon />
                  Archive account
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 truncate text-sm font-semibold">{account.name}</p>
      <p className="mt-1 text-[11px] capitalize text-[color:var(--text-tertiary)]">
        {account.account_type.replaceAll("_", " ")} · {account.currency}
      </p>
      <p className="mt-5 text-lg font-semibold">
        {money.format(Number(account.balance || 0))}
      </p>
      <p className="mt-1 text-[11px] text-[color:var(--text-tertiary)]">Available balance</p>

      <span
        className={`mt-4 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium ${
          archived
            ? "border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-tertiary)]"
            : "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
        }`}
      >
        {archived ? "Archived" : "Active"}
      </span>
    </div>
  );
}

function TransactionRow({
  transaction,
  money,
  onOpen,
}: {
  transaction: CashTransaction;
  money: Intl.NumberFormat;
  onOpen: () => void;
}) {
  const inflow = transaction.direction === "inflow";

  return (
    <tr className="border-b border-[color:var(--border)] text-[12px] last:border-b-0 hover:bg-[color:var(--surface-soft)]">
      <td className="whitespace-nowrap px-5 py-4 text-[color:var(--text-secondary)]">
        {formatDate(transaction.transaction_date)}
      </td>
      <td className="px-5 py-4 text-[color:var(--text-secondary)]">
        {getTransactionAccount(transaction)?.name || "Unassigned"}
      </td>
      <td className="px-5 py-4">
        <CategoryBadge
          name={
            getTransactionCategory(transaction)?.name ||
            transaction.category ||
            "Other"
          }
        />
      </td>
      <td className="max-w-[230px] truncate px-5 py-4 text-[color:var(--text-secondary)]">
        {transaction.description || "—"}
      </td>
      <td
        className={`px-5 py-4 ${
          inflow ? "text-[color:var(--success)]" : "text-[color:var(--danger)]"
        }`}
      >
        <span className="inline-flex items-center gap-1.5">
          {inflow ? "Inflow" : "Outflow"}
          {inflow ? <ArrowDownIcon small /> : <ArrowUpIcon small />}
        </span>
      </td>
      <td className="whitespace-nowrap px-5 py-4 font-medium text-[color:var(--text-primary)]">
        {money.format(Number(transaction.amount || 0))}
      </td>
      <td className="px-5 py-4 capitalize text-[color:var(--text-tertiary)]">
        {transaction.source_type.replaceAll("_", " ")}
      </td>
      <td className="px-5 py-4">
        <button
          type="button"
          onClick={onOpen}
          aria-label="View transaction details"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--text-tertiary)] transition hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--text-secondary)]"
        >
          <MoreIcon />
        </button>
      </td>
    </tr>
  );
}

function CategoryBadge({ name }: { name: string }) {
  const normalized = name.toLowerCase();
  let className = "border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)]";

  if (normalized.includes("sale")) {
    className = "border-[color:var(--secondary-border)] bg-[color:var(--secondary-soft)] text-[color:var(--secondary)]";
  } else if (
    normalized.includes("expense") ||
    normalized.includes("withdraw")
  ) {
    className = "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]";
  } else if (
    normalized.includes("investment") ||
    normalized.includes("income")
  ) {
    className =
      "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]";
  } else if (normalized.includes("transfer")) {
    className =
      "border-[color:var(--violet-border)] bg-[color:var(--violet-soft)] text-[color:var(--chart-5)]";
  }

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-medium ${className}`}
    >
      {name}
    </span>
  );
}

function RecentActivity({
  transactions,
  money,
}: {
  transactions: CashTransaction[];
  money: Intl.NumberFormat;
}) {
  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">Recent Activity</div>
        <span className="text-[10px] text-[color:var(--primary)]">Latest</span>
      </div>

      <div className="mt-5 space-y-4">
        {transactions.length > 0 ? (
          transactions.map((transaction) => (
            <div key={transaction.id} className="flex gap-3">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  transaction.direction === "inflow"
                    ? "bg-[color:var(--success-soft)] text-[color:var(--success)]"
                    : "bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
                }`}
              >
                {transaction.direction === "inflow" ? (
                  <ArrowDownIcon small />
                ) : (
                  <ArrowUpIcon small />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[color:var(--text-primary)]">
                  {transaction.description ||
                    transaction.category ||
                    "Transaction recorded"}
                </p>
                <p className="mt-1 truncate text-[10px] text-[color:var(--text-tertiary)]">
                  {money.format(Number(transaction.amount || 0))} ·{" "}
                  {getTransactionAccount(transaction)?.name || "Account"}
                </p>
              </div>
            </div>
          ))
        ) : (
          <EmptyState text="No financial activity yet." />
        )}
      </div>
    </div>
  );
}

function NotificationPanel({
  notifications,
}: {
  notifications: Notification[];
}) {
  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">Notifications</div>
        <span className="text-[10px] text-[color:var(--primary)]">
          {notifications.length} shown
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <div key={notification.id} className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
                <BellIcon />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[color:var(--text-primary)]">
                  {notification.title}
                </p>
                <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[color:var(--text-tertiary)]">
                  {notification.message}
                </p>
              </div>
            </div>
          ))
        ) : (
          <EmptyState text="No notifications." />
        )}
      </div>
    </div>
  );
}

function QuickActions({
  onInflow,
  onOutflow,
  onTransfer,
  onAccount,
}: {
  onInflow: () => void;
  onOutflow: () => void;
  onTransfer: () => void;
  onAccount: () => void;
}) {
  const actions = [
    {
      title: "Add Inflow",
      note: "Record money received",
      icon: <ArrowDownIcon small />,
      className: "bg-[color:var(--success-soft)] text-[color:var(--success)]",
      onClick: onInflow,
    },
    {
      title: "Add Outflow",
      note: "Record money paid",
      icon: <ArrowUpIcon small />,
      className: "bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
      onClick: onOutflow,
    },
    {
      title: "Transfer Funds",
      note: "Move money between accounts",
      icon: <TransferIcon />,
      className: "bg-[color:var(--violet-soft)] text-[color:var(--chart-5)]",
      onClick: onTransfer,
    },
    {
      title: "Add Account",
      note: "Create a financial account",
      icon: <BankIcon />,
      className: "bg-[color:var(--secondary-soft)] text-[color:var(--secondary)]",
      onClick: onAccount,
    },
  ];

  return (
    <div className={`${PANEL} p-5`}>
      <div className="text-sm font-semibold">Quick Actions</div>
      <div className="mt-4 divide-y divide-[color:var(--divider)]">
        {actions.map((action) => (
          <button
            key={action.title}
            type="button"
            onClick={action.onClick}
            className="flex w-full items-center gap-3 py-3 text-left"
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${action.className}`}
            >
              {action.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[color:var(--text-primary)]">
                {action.title}
              </p>
              <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">
                {action.note}
              </p>
            </div>
            <ChevronRightIcon />
          </button>
        ))}
      </div>
    </div>
  );
}

function CashFlowChart({
  data,
  money,
  periodLabel,
}: {
  data: CashFlowPoint[];
  money: Intl.NumberFormat;
  periodLabel: string;
}) {
  const totals = data.reduce(
    (result, point) => ({
      inflow: result.inflow + point.inflow,
      outflow: result.outflow + point.outflow,
      net: result.net + point.net,
    }),
    { inflow: 0, outflow: 0, net: 0 }
  );

  const width = 680;
  const height = 230;
  const left = 46;
  const right = 18;
  const top = 26;
  const bottom = 34;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const allValues = data.flatMap((point) => [
    point.inflow,
    point.outflow,
    point.net,
  ]);
  const minimum = Math.min(...allValues, 0);
  const maximum = Math.max(...allValues, 1);
  const range = Math.max(maximum - minimum, 1);

  const buildPath = (
    selector: (point: CashFlowPoint) => number
  ) =>
    data
      .map((point, index) => {
        const x =
          data.length === 1
            ? left + plotWidth / 2
            : left + (index / (data.length - 1)) * plotWidth;
        const y =
          top +
          plotHeight -
          ((selector(point) - minimum) / range) * plotHeight;

        return `${index === 0 ? "M" : "L"} ${x.toFixed(
          2
        )} ${y.toFixed(2)}`;
      })
      .join(" ");

  const firstLabel = data[0]?.label || "—";
  const middleLabel =
    data[Math.floor((data.length - 1) / 2)]?.label || "—";
  const lastLabel = data[data.length - 1]?.label || "—";

  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">Cash Flow Overview</div>
          <div className="mt-4 flex flex-wrap gap-5 text-[10px] text-[color:var(--text-tertiary)]">
            <LegendDot color="bg-[color:var(--success)]" label="Cash In" />
            <LegendDot color="bg-[color:var(--danger)]" label="Cash Out" />
            <LegendDot color="bg-[color:var(--secondary)]" label="Net Flow" />
          </div>
        </div>
        <span className="rounded-lg border border-[color:var(--border)] px-3 py-2 text-[10px] text-[color:var(--text-tertiary)]">
          {periodLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-6 h-[220px] w-full"
        aria-label="Cash flow chart"
      >
        {[top, top + plotHeight / 4, top + plotHeight / 2, top + (plotHeight * 3) / 4, top + plotHeight].map(
          (y) => (
            <line
              key={y}
              x1={left}
              y1={y}
              x2={width - right}
              y2={y}
              stroke="var(--chart-grid)"
              strokeWidth="1"
            />
          )
        )}

        <path
          d={buildPath((point) => point.inflow)}
          fill="none"
          stroke="var(--chart-3)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={buildPath((point) => point.outflow)}
          fill="none"
          stroke="var(--chart-6)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={buildPath((point) => point.net)}
          fill="none"
          stroke="var(--chart-2)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <text
          x={left}
          y={height - 8}
          textAnchor="start"
          fill="var(--chart-label)"
          fontSize="9"
        >
          {firstLabel}
        </text>
        <text
          x={left + plotWidth / 2}
          y={height - 8}
          textAnchor="middle"
          fill="var(--chart-label)"
          fontSize="9"
        >
          {middleLabel}
        </text>
        <text
          x={width - right}
          y={height - 8}
          textAnchor="end"
          fill="var(--chart-label)"
          fontSize="9"
        >
          {lastLabel}
        </text>
      </svg>

      <div className="flex flex-wrap justify-between gap-3 text-[10px] text-[color:var(--text-muted)]">
        <span>Cash in: {money.format(totals.inflow)}</span>
        <span>Cash out: {money.format(totals.outflow)}</span>
        <span>Net: {money.format(totals.net)}</span>
      </div>
    </div>
  );
}

function TopProductsChart({
  products,
  money,
}: {
  products: TopProductPoint[];
  money: Intl.NumberFormat;
}) {
  const maximumRevenue = Math.max(
    ...products.map((product) => product.revenue),
    1
  );

  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Top Products</div>
          <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">
            Best-selling products by recorded revenue
          </p>
        </div>
        <span className="text-[10px] text-[color:var(--primary)]">
          {products.length}
        </span>
      </div>

      <div className="mt-6 space-y-5">
        {products.length > 0 ? (
          products.map((product, index) => {
            const share =
              (product.revenue / maximumRevenue) * 100;

            return (
              <div key={product.name}>
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[11px] font-semibold text-[color:var(--primary)]">
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium text-[color:var(--text-secondary)]">
                          {product.name}
                        </p>
                        <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">
                          {product.units > 0
                            ? `${product.units.toLocaleString(
                                "en-GB"
                              )} units sold`
                            : "Units unavailable"}
                        </p>
                      </div>

                      <p className="shrink-0 text-[12px] font-medium text-[color:var(--primary)]">
                        {money.format(product.revenue)}
                      </p>
                    </div>

                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color:var(--surface-soft)]">
                      <div
                        className="h-full rounded-full bg-[image:linear-gradient(90deg,var(--chart-1),var(--chart-3))]"
                        style={{
                          width: `${Math.max(share, 2)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState text="No product sales are recorded for this period." />
        )}
      </div>
    </div>
  );
}

function AccountBalances({
  accounts,
  money,
}: {
  accounts: CashAccount[];
  money: Intl.NumberFormat;
}) {
  const total = accounts.reduce(
    (sum, account) => sum + Number(account.balance || 0),
    0
  );

  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">Account Balances</div>
        <span className="text-[10px] text-[color:var(--primary)]">{accounts.length}</span>
      </div>

      <div className="mt-5 divide-y divide-[color:var(--divider)]">
        {accounts.length > 0 ? (
          accounts.slice(0, 5).map((account) => (
            <div key={account.id} className="flex items-center gap-3 py-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
                <BankIcon />
              </div>
              <p className="min-w-0 flex-1 truncate text-[11px] text-[color:var(--text-secondary)]">
                {account.name}
              </p>
              <p className="text-[11px] font-medium text-[color:var(--text-primary)]">
                {money.format(Number(account.balance || 0))}
              </p>
            </div>
          ))
        ) : (
          <EmptyState text="No accounts yet." />
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[color:var(--border)] pt-4">
        <p className="text-sm font-semibold text-[color:var(--primary)]">Total</p>
        <p className="text-sm font-semibold text-[color:var(--primary)]">
          {money.format(total)}
        </p>
      </div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[color:var(--overlay-strong)] p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[color:var(--border-brand)] bg-[color:var(--surface)] p-6 shadow-2xl shadow-[var(--shadow-card)]">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="text-lg font-semibold">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--border)] text-[color:var(--text-tertiary)] transition hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--text-primary)]"
          >
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Input({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block text-xs text-[color:var(--text-secondary)]">
      {label}
      <input
        {...props}
        className="mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--border-brand)]"
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <label className="block text-xs text-[color:var(--text-secondary)]">
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue}
        className="mt-2 min-h-24 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--border-brand)]"
      />
    </label>
  );
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
        {label}
      </p>
      <p className="mt-1 break-words text-sm capitalize text-[color:var(--text-secondary)]">
        {value}
      </p>
    </div>
  );
}

function Select({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: [string, string][];
}) {
  return (
    <label className="block text-xs text-[color:var(--text-secondary)]">
      {label}
      <select
        name={name}
        className="mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function AccountSelect({
  accounts,
  name,
  label = "Account",
}: {
  accounts: CashAccount[];
  name: string;
  label?: string;
}) {
  return (
    <label className="block text-xs text-[color:var(--text-secondary)]">
      {label}
      <select
        name={name}
        required
        className="mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
      >
        <option value="">Select account</option>
        {accounts
          .filter((account) => account.status === "active")
          .map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
      </select>
    </label>
  );
}

function CategorySelect({
  categories,
  name,
  direction,
}: {
  categories: CashCategory[];
  name: string;
  direction: TransactionDirection;
}) {
  const filtered = categories.filter((category) => {
    if (direction === "inflow") {
      return ["income", "investment", "loan", "refund", "other"].includes(
        category.category_type
      );
    }

    return ["expense", "withdrawal", "refund", "other"].includes(
      category.category_type
    );
  });

  return (
    <label className="block text-xs text-[color:var(--text-secondary)]">
      Category
      <select
        name={name}
        className="mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
      >
        <option value="">Select category</option>
        {filtered.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="w-full rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary)] px-4 py-3 text-sm font-semibold text-[color:var(--text-on-brand)] transition hover:bg-[color:var(--primary)]">
      {children}
    </button>
  );
}

function ToolbarButton({
  icon,
  label,
  small,
}: {
  icon: React.ReactNode;
  label: string;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)] transition hover:border-[color:var(--border)] hover:text-[color:var(--text-primary)] ${
        small ? "h-10 px-3 text-xs" : "h-11 px-4 text-[13px]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function PaginationButton({
  label,
  icon,
  active,
  disabled,
  onClick,
}: {
  label?: string;
  icon?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs transition disabled:cursor-not-allowed disabled:opacity-30 ${
        active
          ? "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
          : "border-[color:var(--border)] text-[color:var(--text-tertiary)] hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--text-primary)]"
      }`}
    >
      {icon || label}
    </button>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <i className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-6 text-center text-xs text-[color:var(--text-muted)]">
      {text}
    </div>
  );
}

function getTransactionAccount(transaction: CashTransaction) {
  if (Array.isArray(transaction.account)) {
    return transaction.account[0] || null;
  }

  return transaction.account || null;
}

function getTransactionCategory(transaction: CashTransaction) {
  if (Array.isArray(transaction.cash_category)) {
    return transaction.cash_category[0] || null;
  }

  return transaction.cash_category || null;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function SvgIcon({
  children,
  size = 16,
  viewBox = "0 0 24 24",
}: {
  children: React.ReactNode;
  size?: number;
  viewBox?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function WalletIcon() {
  return (
    <SvgIcon size={19}>
      <path d="M4 7.5h14.5A1.5 1.5 0 0 1 20 9v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11" />
      <path d="M16 12h4v4h-4a2 2 0 0 1 0-4Z" />
    </SvgIcon>
  );
}

function ArrowDownIcon({ small }: { small?: boolean }) {
  return (
    <SvgIcon size={small ? 13 : 18}>
      <path d="M12 4v16" />
      <path d="m6 14 6 6 6-6" />
    </SvgIcon>
  );
}

function ArrowUpIcon({ small }: { small?: boolean }) {
  return (
    <SvgIcon size={small ? 13 : 18}>
      <path d="M12 20V4" />
      <path d="m6 10 6-6 6 6" />
    </SvgIcon>
  );
}

function PulseIcon() {
  return (
    <SvgIcon size={19}>
      <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
    </SvgIcon>
  );
}

function CalendarIcon() {
  return (
    <SvgIcon>
      <path d="M7 3v3M17 3v3M4 9h16" />
      <rect x="4" y="5" width="16" height="15" rx="2" />
    </SvgIcon>
  );
}

function FilterIcon() {
  return (
    <SvgIcon>
      <path d="M4 5h16M7 12h10M10 19h4" />
    </SvgIcon>
  );
}

function DownloadIcon() {
  return (
    <SvgIcon>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 21h16" />
    </SvgIcon>
  );
}

function PlusIcon({ large }: { large?: boolean }) {
  return (
    <SvgIcon size={large ? 22 : 16}>
      <path d="M12 5v14M5 12h14" />
    </SvgIcon>
  );
}

function SearchIcon() {
  return (
    <SvgIcon size={15}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </SvgIcon>
  );
}

function ChevronDownIcon() {
  return (
    <SvgIcon size={13}>
      <path d="m7 10 5 5 5-5" />
    </SvgIcon>
  );
}

function CheckIcon() {
  return (
    <SvgIcon size={13}>
      <path d="m5 12 4 4 10-10" />
    </SvgIcon>
  );
}

function ChevronLeftIcon() {
  return (
    <SvgIcon size={14}>
      <path d="m15 18-6-6 6-6" />
    </SvgIcon>
  );
}

function ChevronRightIcon() {
  return (
    <SvgIcon size={14}>
      <path d="m9 18 6-6-6-6" />
    </SvgIcon>
  );
}

function MoreIcon() {
  return (
    <SvgIcon size={16}>
      <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </SvgIcon>
  );
}

function BellIcon() {
  return (
    <SvgIcon size={14}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </SvgIcon>
  );
}

function TransferIcon() {
  return (
    <SvgIcon size={15}>
      <path d="M7 7h11l-3-3M17 17H6l3 3" />
    </SvgIcon>
  );
}

function BankIcon() {
  return (
    <SvgIcon size={14}>
      <path d="m3 9 9-5 9 5" />
      <path d="M5 10v7M9 10v7M15 10v7M19 10v7M3 20h18" />
    </SvgIcon>
  );
}

function CloseIcon() {
  return (
    <SvgIcon size={17}>
      <path d="m6 6 12 12M18 6 6 18" />
    </SvgIcon>
  );
}

function EditIcon() {
  return (
    <SvgIcon size={14}>
      <path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </SvgIcon>
  );
}

function ArchiveIcon() {
  return (
    <SvgIcon size={14}>
      <rect x="3" y="5" width="18" height="4" rx="1" />
      <path d="M5 9v10h14V9M9 13h6" />
    </SvgIcon>
  );
}

function AccountTypeIcon({ type }: { type: string }) {
  if (type === "cash" || type === "petty_cash") {
    return (
      <SvgIcon size={18}>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M7 9h.01M17 15h.01" />
      </SvgIcon>
    );
  }

  if (type === "payment_processor" || type === "credit_card") {
    return (
      <SvgIcon size={18}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18M7 15h4" />
      </SvgIcon>
    );
  }

  return <BankIcon />;
}