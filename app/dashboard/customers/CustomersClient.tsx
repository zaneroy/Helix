"use client";

import {
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { Customer } from "./page";

type Props = {
  companyName: string;
  currency: string;
  customers: Customer[];
  error?: string;
  success?: string;
  addCustomer: (formData: FormData) => void;
  updateCustomer: (formData: FormData) => void;
  deleteCustomer: (formData: FormData) => void;
};

type FilterMode = "all" | "active" | "inactive";

const PANEL =
  "rounded-2xl border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]";

export default function CustomersClient({
  companyName,
  currency,
  customers,
  error,
  success,
  addCustomer,
  updateCustomer,
  deleteCustomer,
}: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const pageSize = 8;

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

  const totalRevenue = useMemo(
    () =>
      customers.reduce(
        (sum, customer) => sum + Number(customer.revenue || 0),
        0
      ),
    [customers]
  );

  const activeCustomers = useMemo(
    () =>
      customers.filter(
        (customer) =>
          Number(customer.transactions || 0) > 0 ||
          Number(customer.revenue || 0) > 0
      ),
    [customers]
  );

  const topCustomer = useMemo(
    () =>
      [...customers].sort(
        (a, b) => Number(b.revenue || 0) - Number(a.revenue || 0)
      )[0] || null,
    [customers]
  );

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return customers.filter((customer) => {
      const isActive =
        Number(customer.transactions || 0) > 0 ||
        Number(customer.revenue || 0) > 0;

      const matchesFilter =
        filter === "all" ||
        (filter === "active" && isActive) ||
        (filter === "inactive" && !isActive);

      const matchesSearch =
        !query ||
        [
          customer.name,
          customer.company_name,
          customer.email,
          customer.phone,
          customer.address,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query)
        );

      return matchesFilter && matchesSearch;
    });
  }, [customers, search, filter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCustomers.length / pageSize)
  );
  const safePage = Math.min(page, totalPages);
  const paginatedCustomers = filteredCustomers.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const recentCustomers = useMemo(
    () =>
      [...customers]
        .sort(
          (a, b) =>
            new Date(
              b.last_activity || b.created_at || 0
            ).getTime() -
            new Date(
              a.last_activity || a.created_at || 0
            ).getTime()
        )
        .slice(0, 5),
    [customers]
  );

  const activityData = useMemo(
    () =>
      [...customers]
        .sort(
          (a, b) =>
            new Date(a.created_at || 0).getTime() -
            new Date(b.created_at || 0).getTime()
        )
        .map((customer, index, array) => ({
          label: shortDate(customer.created_at),
          value: array
            .slice(0, index + 1)
            .reduce((sum, row) => sum + Number(row.revenue || 0), 0),
        }))
        .slice(-8),
    [customers]
  );

  function exportCustomers() {
    const headers = [
      "Name",
      "Company",
      "Email",
      "Phone",
      "Revenue",
      "Transactions",
      "Last Activity",
      "Address",
      "Notes",
    ];

    const rows = filteredCustomers.map((customer) => [
      customer.name,
      customer.company_name || "",
      customer.email || "",
      customer.phone || "",
      Number(customer.revenue || 0).toFixed(2),
      Number(customer.transactions || 0),
      customer.last_activity || "",
      customer.address || "",
      customer.notes || "",
    ]);

    const escape = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;

    const csv = [headers, ...rows]
      .map((row) => row.map(escape).join(","))
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `helix-customers-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[color:var(--app-bg)] text-[color:var(--text-primary)]">
      <div className="mx-auto w-full max-w-[1680px] space-y-6 pb-12">
        <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--primary)]">
              CRM command center
            </p>
            <h1 className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.04em]">
              Customers
            </h1>
            <p className="mt-3 text-[13px] text-[color:var(--text-tertiary)]">
              Manage relationships, customer value and future receivables for{" "}
              {companyName}.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary)] px-5 text-sm font-semibold text-[color:var(--text-on-brand)] transition hover:bg-[color:var(--primary)]"
          >
            <PlusIcon />
            Add Customer
          </button>
        </header>

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

        <section className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
          <MetricCard
            label="Total Customers"
            value={customers.length.toLocaleString("en-GB")}
            note="Relationship records"
            tone="cyan"
            icon={<UsersIcon />}
            values={customers.map((_, index) => index + 1)}
          />
          <MetricCard
            label="Active Customers"
            value={activeCustomers.length.toLocaleString("en-GB")}
            note="Customers with recorded activity"
            tone="green"
            icon={<ActivityIcon />}
            values={activeCustomers.map((row) => row.transactions)}
          />
          <MetricCard
            label="Customer Revenue"
            value={money.format(totalRevenue)}
            note="Revenue linked to customers"
            tone="blue"
            icon={<RevenueIcon />}
            values={customers.map((row) => row.revenue)}
          />
          <MetricCard
            label="Top Customer"
            value={topCustomer?.name || "No data"}
            note={
              topCustomer
                ? money.format(Number(topCustomer.revenue || 0))
                : "No customer revenue yet"
            }
            tone="violet"
            icon={<CrownIcon />}
            values={customers
              .sort(
                (a, b) =>
                  Number(a.revenue || 0) - Number(b.revenue || 0)
              )
              .map((row) => row.revenue)}
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
          <CustomerRevenueChart
            data={activityData}
            currency={currency}
          />
          <CustomerHealthPanel
            total={customers.length}
            active={activeCustomers.length}
            inactive={customers.length - activeCustomers.length}
            revenue={totalRevenue}
            currency={currency}
          />
        </section>

        <section className={`${PANEL} p-5`}>
          <div className="text-sm font-semibold">Quick Actions</div>

          <div className="mt-4 divide-y divide-[color:var(--divider)]">
            <QuickAction
              icon={<PlusIcon />}
              tone="cyan"
              title="Add Customer"
              description="Create a new customer profile"
              onClick={() => setAdding(true)}
            />
            <QuickAction
              icon={<UsersIcon />}
              tone="blue"
              title="View Active Customers"
              description={`${activeCustomers.length} active relationships`}
              onClick={() => {
                setFilter("active");
                setPage(1);
                document
                  .getElementById("customer-register")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            />
            <QuickAction
              icon={<DownloadIcon />}
              tone="violet"
              title="Export Customers"
              description="Download the filtered customer register"
              onClick={exportCustomers}
            />
          </div>
        </section>

        <section
          id="customer-register"
          className={`${PANEL} overflow-hidden`}
        >
          <div className="flex flex-col gap-4 border-b border-[color:var(--border)] p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[16px] font-semibold">
                Customer Register
              </p>
              <p className="mt-1 text-[11px] text-[color:var(--text-tertiary)]">
                Contact details, customer value and engagement history.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="flex h-10 w-full min-w-[310px] items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3">
                <SearchIcon />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search name, company, email or phone..."
                  className="w-full bg-transparent text-xs text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
                />
              </label>

              <button
                type="button"
                onClick={exportCustomers}
                disabled={filteredCustomers.length === 0}
                className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-xs text-[color:var(--text-secondary)] transition hover:border-[color:var(--border)] hover:text-[color:var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <DownloadIcon />
                Export
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 border-b border-[color:var(--border)] px-5 py-4">
            {(
              [
                ["all", "All"],
                ["active", "Active"],
                ["inactive", "No Activity"],
              ] as [FilterMode, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setFilter(value);
                  setPage(1);
                }}
                className={`relative pb-2 text-xs transition ${
                  filter === value
                    ? "text-[color:var(--primary)]"
                    : "text-[color:var(--text-tertiary)] hover:text-[color:var(--text-secondary)]"
                }`}
              >
                {label}
                {filter === value && (
                  <span className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-[color:var(--primary)]" />
                )}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] border-collapse text-left">
              <thead className="bg-[color:var(--surface-soft)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">
                <tr className="border-b border-[color:var(--border)]">
                  <th className="px-5 py-4">Customer</th>
                  <th className="px-5 py-4">Company</th>
                  <th className="px-5 py-4">Contact</th>
                  <th className="px-5 py-4">Revenue</th>
                  <th className="px-5 py-4">Transactions</th>
                  <th className="px-5 py-4">Last Activity</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>

              <tbody>
                {paginatedCustomers.length > 0 ? (
                  paginatedCustomers.map((customer) => {
                    const isActive =
                      Number(customer.transactions || 0) > 0 ||
                      Number(customer.revenue || 0) > 0;

                    return (
                      <tr
                        key={customer.id}
                        className="border-b border-[color:var(--border)] text-[12px] last:border-b-0 hover:bg-[color:var(--surface-soft)]"
                      >
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => setViewing(customer)}
                            className="flex items-center gap-3 text-left"
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-xs font-semibold text-[color:var(--primary)]">
                              {initials(customer.name)}
                            </span>

                            <span className="min-w-0">
                              <span className="block truncate font-medium text-[color:var(--text-primary)]">
                                {customer.name}
                              </span>
                              <span className="mt-1 block truncate text-[10px] text-[color:var(--text-muted)]">
                                {customer.email || "No email"}
                              </span>
                            </span>
                          </button>
                        </td>

                        <td className="px-5 py-4 text-[color:var(--text-secondary)]">
                          {customer.company_name || "Individual"}
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-[color:var(--text-secondary)]">
                            {customer.phone || "No phone"}
                          </p>
                          <p className="mt-1 max-w-[220px] truncate text-[10px] text-[color:var(--text-muted)]">
                            {customer.address || "No address"}
                          </p>
                        </td>

                        <td className="px-5 py-4 font-medium text-[color:var(--primary)]">
                          {money.format(Number(customer.revenue || 0))}
                        </td>

                        <td className="px-5 py-4 text-[color:var(--text-secondary)]">
                          {Number(
                            customer.transactions || 0
                          ).toLocaleString("en-GB")}
                        </td>

                        <td className="px-5 py-4 text-[color:var(--text-secondary)]">
                          {formatDate(customer.last_activity)}
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge active={isActive} />
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setViewing(customer)}
                              className="rounded-lg border border-[color:var(--border)] px-3 py-2 text-[10px] text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
                            >
                              View
                            </button>

                            <button
                              type="button"
                              onClick={() => setEditing(customer)}
                              className="rounded-lg border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-3 py-2 text-[10px] font-medium text-[color:var(--primary)] transition hover:bg-[color:var(--primary-soft)]"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-16 text-center text-sm text-[color:var(--text-tertiary)]"
                    >
                      No matching customers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-[color:var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-[color:var(--text-muted)]">
              Showing{" "}
              {filteredCustomers.length === 0
                ? 0
                : (safePage - 1) * pageSize + 1}
              –
              {Math.min(
                safePage * pageSize,
                filteredCustomers.length
              )}{" "}
              of {filteredCustomers.length} customers
            </p>

            <div className="flex items-center gap-2">
              <PageButton
                disabled={safePage <= 1}
                onClick={() =>
                  setPage((current) => Math.max(1, current - 1))
                }
              >
                <ChevronLeftIcon />
              </PageButton>

              {Array.from(
                { length: Math.min(totalPages, 5) },
                (_, index) => index + 1
              ).map((number) => (
                <PageButton
                  key={number}
                  active={safePage === number}
                  onClick={() => setPage(number)}
                >
                  {number}
                </PageButton>
              ))}

              <PageButton
                disabled={safePage >= totalPages}
                onClick={() =>
                  setPage((current) =>
                    Math.min(totalPages, current + 1)
                  )
                }
              >
                <ChevronRightIcon />
              </PageButton>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <RecentCustomersPanel
            customers={recentCustomers}
            currency={currency}
          />
          <CustomerInsights
            customers={customers}
            activeCount={activeCustomers.length}
            totalRevenue={totalRevenue}
            topCustomer={topCustomer}
            currency={currency}
          />
        </section>
      </div>

      {adding && (
        <CustomerDrawer
          title="Add Customer"
          action={addCustomer}
          onClose={() => setAdding(false)}
        />
      )}

      {editing && (
        <CustomerDrawer
          title="Edit Customer"
          customer={editing}
          action={updateCustomer}
          onClose={() => setEditing(null)}
          onRequestDelete={(id) => setDeleteId(id)}
        />
      )}

      {viewing && (
        <CustomerProfileDrawer
          customer={viewing}
          currency={currency}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewing);
            setViewing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete Customer"
        description="Are you sure you want to delete this customer? This cannot be undone."
        confirmText="Delete Customer"
        cancelText="Cancel"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return;

          const formData = new FormData();
          formData.append("id", deleteId);

          deleteCustomer(formData);
          setDeleteId(null);
        }}
      />
    </main>
  );
}

function MetricCard({
  label,
  value,
  note,
  tone,
  icon,
  values,
}: {
  label: string;
  value: string;
  note: string;
  tone: "cyan" | "green" | "blue" | "violet";
  icon: ReactNode;
  values: number[];
}) {
  const toneClass = {
    cyan: "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
    green:
      "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
    blue: "border-[color:var(--secondary-border)] bg-[color:var(--secondary-soft)] text-[color:var(--secondary)]",
    violet:
      "border-[color:var(--violet-border)] bg-[color:var(--violet-soft)] text-[color:var(--chart-5)]",
  }[tone];

  return (
    <div className={`${PANEL} min-h-[230px] p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[color:var(--text-secondary)]">{label}</p>
          <p className="mt-3 truncate text-[25px] font-semibold tracking-[-0.04em]">
            {value}
          </p>
          <p className="mt-3 text-[11px] text-[color:var(--text-muted)]">{note}</p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${toneClass}`}
        >
          {icon}
        </div>
      </div>

      <MetricBars values={values} tone={tone} />
    </div>
  );
}

function MetricBars({
  values,
  tone,
}: {
  values: number[];
  tone: "cyan" | "green" | "blue" | "violet";
}) {
  const color = {
    cyan: "var(--chart-1)",
    green: "var(--chart-3)",
    blue: "var(--chart-2)",
    violet: "var(--chart-5)",
  }[tone];

  const data = values.length > 0 ? values.slice(-8) : [0];
  const maximum = Math.max(...data.map(Number), 1);

  return (
    <svg
      viewBox="0 0 220 72"
      className="mt-5 h-[72px] w-full"
      aria-label="Customer metric chart"
    >
      {[14, 36, 58].map((y) => (
        <line
          key={y}
          x1="0"
          x2="220"
          y1={y}
          y2={y}
          stroke="var(--chart-grid)"
        />
      ))}

      {data.map((value, index) => {
        const gap = 5;
        const barWidth =
          (220 - gap * Math.max(data.length - 1, 0)) / data.length;
        const height = (Number(value || 0) / maximum) * 52;
        const x = index * (barWidth + gap);
        const y = 62 - height;

        return (
          <rect
            key={`${index}-${value}`}
            x={x}
            y={y}
            width={barWidth}
            height={Math.max(height, 1)}
            rx="2"
            fill={color}
            opacity="0.82"
          />
        );
      })}
    </svg>
  );
}

function CustomerRevenueChart({
  data,
  currency,
}: {
  data: { label: string; value: number }[];
  currency: string;
}) {
  const width = 900;
  const height = 280;
  const left = 60;
  const right = 20;
  const top = 24;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maximum = Math.max(...data.map((row) => row.value), 1);

  const path = data
    .map((point, index) => {
      const x =
        data.length === 1
          ? left + plotWidth / 2
          : left + (index / (data.length - 1)) * plotWidth;
      const y =
        top + plotHeight - (point.value / maximum) * plotHeight;

      return `${index === 0 ? "M" : "L"} ${x.toFixed(
        2
      )} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Customer Value Trend</p>
          <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">
            Cumulative customer-linked revenue
          </p>
        </div>

        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-right">
          <p className="text-[9px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
            Latest
          </p>
          <p className="mt-1 text-xs font-semibold text-[color:var(--primary)]">
            {formatMoney(data.at(-1)?.value || 0, currency)}
          </p>
        </div>
      </div>

      {data.length > 0 ? (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mt-4 h-[280px] w-full"
          aria-label="Customer revenue trend"
        >
          {[0, 1, 2, 3, 4].map((index) => {
            const y = top + (index / 4) * plotHeight;
            const value = maximum - (index / 4) * maximum;

            return (
              <g key={index}>
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
                  fontSize="9"
                >
                  {compactMoney(value, currency)}
                </text>
              </g>
            );
          })}

          <path
            d={path}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {data.map((point, index) => {
            const x =
              data.length === 1
                ? left + plotWidth / 2
                : left + (index / (data.length - 1)) * plotWidth;
            const y =
              top + plotHeight - (point.value / maximum) * plotHeight;

            return (
              <g key={`${point.label}-${index}`}>
                <circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill="var(--app-bg)"
                  stroke="var(--chart-1)"
                  strokeWidth="2.5"
                />
                <text
                  x={x}
                  y={height - 12}
                  textAnchor="middle"
                  fill="var(--chart-label)"
                  fontSize="9"
                >
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        <EmptyState text="Customer activity will appear here." />
      )}
    </div>
  );
}

function CustomerHealthPanel({
  total,
  active,
  inactive,
  revenue,
  currency,
}: {
  total: number;
  active: number;
  inactive: number;
  revenue: number;
  currency: string;
}) {
  const activeRate = total > 0 ? (active / total) * 100 : 0;
  const inactiveRate = total > 0 ? (inactive / total) * 100 : 0;

  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Customer Health</p>
          <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">
            Relationship engagement summary
          </p>
        </div>

        <span className="text-[10px] text-[color:var(--primary)]">{total}</span>
      </div>

      <div className="mt-7 space-y-5">
        <HealthRow
          label="Active Customers"
          value={active}
          percentage={activeRate}
          color="bg-[color:var(--success)]"
        />
        <HealthRow
          label="No Activity"
          value={inactive}
          percentage={inactiveRate}
          color="bg-[color:var(--warning)]"
        />
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <MiniSummary
          label="Average Revenue"
          value={formatMoney(total > 0 ? revenue / total : 0, currency)}
        />
        <MiniSummary
          label="Active Rate"
          value={`${activeRate.toFixed(1)}%`}
        />
      </div>
    </div>
  );
}

function HealthRow({
  label,
  value,
  percentage,
  color,
}: {
  label: string;
  value: number;
  percentage: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[color:var(--text-secondary)]">{label}</span>
        <span className="font-medium text-[color:var(--text-primary)]">{value}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color:var(--surface-soft)]">
        <div
          className={`h-full rounded-full ${color}`}
          style={{
            width: `${Math.max(percentage, value > 0 ? 3 : 0)}%`,
          }}
        />
      </div>
    </div>
  );
}

function MiniSummary({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3">
      <p className="text-[9px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-[color:var(--primary)]">
        {value}
      </p>
    </div>
  );
}

function QuickAction({
  icon,
  tone,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  tone: "cyan" | "blue" | "violet";
  title: string;
  description: string;
  onClick: () => void;
}) {
  const toneClass = {
    cyan: "bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
    blue: "bg-[color:var(--secondary-soft)] text-[color:var(--secondary)]",
    violet: "bg-[color:var(--violet-soft)] text-[color:var(--chart-5)]",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 py-4 text-left transition hover:bg-[color:var(--surface-soft)]"
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClass}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-[color:var(--text-secondary)]">
          {title}
        </span>
        <span className="mt-1 block text-[10px] text-[color:var(--text-muted)]">
          {description}
        </span>
      </span>
      <ChevronRightIcon />
    </button>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="rounded-full border border-[color:var(--success-border)] bg-[color:var(--success-soft)] px-3 py-1 text-[10px] text-[color:var(--success)]">
      Active
    </span>
  ) : (
    <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-1 text-[10px] text-[color:var(--text-tertiary)]">
      No activity
    </span>
  );
}

function RecentCustomersPanel({
  customers,
  currency,
}: {
  customers: Customer[];
  currency: string;
}) {
  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Recent Customers</p>
          <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">
            Latest relationship activity
          </p>
        </div>
        <span className="text-[10px] text-[color:var(--primary)]">
          {customers.length}
        </span>
      </div>

      <div className="mt-5 divide-y divide-[color:var(--divider)]">
        {customers.length > 0 ? (
          customers.map((customer) => (
            <div
              key={customer.id}
              className="flex items-center gap-3 py-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-xs font-semibold text-[color:var(--primary)]">
                {initials(customer.name)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-[color:var(--text-secondary)]">
                  {customer.name}
                </p>
                <p className="mt-1 truncate text-[9px] text-[color:var(--text-muted)]">
                  {customer.company_name || "Individual"} ·{" "}
                  {formatDate(
                    customer.last_activity || customer.created_at
                  )}
                </p>
              </div>

              <p className="shrink-0 text-[12px] font-semibold text-[color:var(--primary)]">
                {formatMoney(customer.revenue, currency)}
              </p>
            </div>
          ))
        ) : (
          <EmptyState text="No customer activity yet." />
        )}
      </div>
    </div>
  );
}

function CustomerInsights({
  customers,
  activeCount,
  totalRevenue,
  topCustomer,
  currency,
}: {
  customers: Customer[];
  activeCount: number;
  totalRevenue: number;
  topCustomer: Customer | null;
  currency: string;
}) {
  const withEmail = customers.filter((row) => row.email).length;
  const insights = [
    topCustomer
      ? `${topCustomer.name} is currently the highest-value customer at ${formatMoney(
          topCustomer.revenue,
          currency
        )}.`
      : "No top customer is available yet.",
    `${activeCount} of ${customers.length} customers have recorded financial activity.`,
    `${withEmail} customer profiles have an email address ready for future invoice delivery.`,
    `Average customer revenue is ${formatMoney(
      customers.length > 0 ? totalRevenue / customers.length : 0,
      currency
    )}.`,
  ];

  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Customer Insights</p>
          <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">
            Live relationship intelligence
          </p>
        </div>
        <span className="text-[10px] text-[color:var(--primary)]">Live</span>
      </div>

      <div className="mt-5 space-y-4">
        {insights.map((insight, index) => (
          <div key={insight} className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color:var(--primary-soft)] text-[10px] font-semibold text-[color:var(--primary)]">
              {index + 1}
            </span>
            <p className="text-[11px] leading-5 text-[color:var(--text-secondary)]">
              {insight}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomerDrawer({
  title,
  customer,
  action,
  onClose,
  onRequestDelete,
}: {
  title: string;
  customer?: Customer;
  action: (formData: FormData) => void;
  onClose: () => void;
  onRequestDelete?: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[color:var(--overlay-strong)] backdrop-blur-sm">
      <div className="h-full w-full max-w-md overflow-y-auto border-l border-[color:var(--border-brand)] bg-[color:var(--surface)] p-6 shadow-2xl shadow-[var(--shadow-card)]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">{title}</div>
            <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
              Store customer details for sales, invoicing and receivables.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--border)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--text-primary)]"
          >
            <CloseIcon />
          </button>
        </div>

        <form action={action} className="space-y-4">
          {customer && (
            <input type="hidden" name="id" defaultValue={customer.id} />
          )}

          <Field
            name="name"
            label="Customer name"
            defaultValue={customer?.name || ""}
            required
          />

          <Field
            name="company_name"
            label="Company name"
            defaultValue={customer?.company_name || ""}
          />

          <Field
            name="email"
            label="Email address"
            type="email"
            defaultValue={customer?.email || ""}
          />

          <Field
            name="phone"
            label="Phone"
            defaultValue={customer?.phone || ""}
          />

          <label className="block text-xs text-[color:var(--text-secondary)]">
            Address
            <textarea
              name="address"
              defaultValue={customer?.address || ""}
              className="mt-2 min-h-24 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
            />
          </label>

          <label className="block text-xs text-[color:var(--text-secondary)]">
            Internal notes
            <textarea
              name="notes"
              defaultValue={customer?.notes || ""}
              className="mt-2 min-h-28 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
            />
          </label>

          <button className="w-full rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary)] px-4 py-3 text-sm font-semibold text-[color:var(--text-on-brand)] transition hover:bg-[color:var(--primary)]">
            {customer ? "Save Changes" : "Add Customer"}
          </button>
        </form>

        {customer && onRequestDelete && (
          <button
            type="button"
            onClick={() => onRequestDelete(customer.id)}
            className="mt-4 w-full rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-4 py-3 text-sm font-medium text-[color:var(--danger)]"
          >
            Delete Customer
          </button>
        )}
      </div>
    </div>
  );
}

function CustomerProfileDrawer({
  customer,
  currency,
  onClose,
  onEdit,
}: {
  customer: Customer;
  currency: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[color:var(--overlay-strong)] backdrop-blur-sm">
      <div className="h-full w-full max-w-lg overflow-y-auto border-l border-[color:var(--border-brand)] bg-[color:var(--surface)] p-6 shadow-2xl shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-lg font-semibold text-[color:var(--primary)]">
              {initials(customer.name)}
            </span>

            <div>
              <h2 className="text-xl font-semibold">{customer.name}</h2>
              <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
                {customer.company_name || "Individual customer"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--border)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--text-primary)]"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <ProfileMetric
            label="Lifetime Revenue"
            value={formatMoney(customer.revenue, currency)}
            tone="cyan"
          />
          <ProfileMetric
            label="Transactions"
            value={Number(customer.transactions).toLocaleString("en-GB")}
            tone="blue"
          />
          <ProfileMetric
            label="Last Activity"
            value={formatDate(customer.last_activity)}
            tone="green"
          />
          <ProfileMetric
            label="Status"
            value={
              customer.transactions > 0 || customer.revenue > 0
                ? "Active"
                : "No activity"
            }
            tone="violet"
          />
        </div>

        <div className={`${PANEL} mt-6 p-5`}>
          <p className="text-sm font-semibold">Contact Details</p>

          <div className="mt-5 space-y-4">
            <DetailRow label="Email" value={customer.email || "Not provided"} />
            <DetailRow label="Phone" value={customer.phone || "Not provided"} />
            <DetailRow
              label="Address"
              value={customer.address || "Not provided"}
            />
            <DetailRow
              label="Customer since"
              value={formatDate(customer.created_at)}
            />
          </div>
        </div>

        <div className={`${PANEL} mt-6 p-5`}>
          <p className="text-sm font-semibold">Internal Notes</p>
          <p className="mt-4 whitespace-pre-wrap text-[11px] leading-5 text-[color:var(--text-tertiary)]">
            {customer.notes || "No internal notes have been added."}
          </p>
        </div>

        <div className={`${PANEL} mt-6 p-5`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Invoice Activity</p>
              <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">
                Ready for the upcoming invoicing module
              </p>
            </div>
            <span className="rounded-full border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-3 py-1 text-[10px] text-[color:var(--primary)]">
              Coming next
            </span>
          </div>

          <EmptyState text="Invoices, payments and receivables will appear here." />
        </div>

        <button
          type="button"
          onClick={onEdit}
          className="mt-6 w-full rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-4 py-3 text-sm font-medium text-[color:var(--primary)] transition hover:bg-[color:var(--primary-soft)]"
        >
          Edit Customer
        </button>
      </div>
    </div>
  );
}

function ProfileMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "cyan" | "blue" | "green" | "violet";
}) {
  const toneClass = {
    cyan: "text-[color:var(--primary)]",
    blue: "text-[color:var(--secondary)]",
    green: "text-[color:var(--success)]",
    violet: "text-[color:var(--chart-5)]",
  }[tone];

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-4">
      <p className="text-[9px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
        {label}
      </p>
      <p className={`mt-2 text-sm font-semibold ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border)] pb-4 last:border-b-0 last:pb-0">
      <span className="text-[11px] text-[color:var(--text-tertiary)]">{label}</span>
      <span className="max-w-[65%] text-right text-[11px] text-[color:var(--text-secondary)]">
        {value}
      </span>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs text-[color:var(--text-secondary)]">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
      />
    </label>
  );
}

function PageButton({
  children,
  active,
  disabled,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
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
      {children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-5 rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-6 text-center text-xs text-[color:var(--text-muted)]">
      {text}
    </div>
  );
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatDate(value?: string | null) {
  if (!value) return "No activity";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "No activity";

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function shortDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function compactMoney(value: number, currency: string) {
  const symbol = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .formatToParts(0)
    .find((part) => part.type === "currency")?.value;

  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absolute >= 1_000_000) {
    return `${sign}${symbol}${(absolute / 1_000_000).toFixed(1)}m`;
  }

  if (absolute >= 1_000) {
    return `${sign}${symbol}${(absolute / 1_000).toFixed(1)}k`;
  }

  return `${sign}${symbol}${Math.round(absolute)}`;
}

function SvgIcon({
  children,
  size = 16,
}: {
  children: ReactNode;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
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

function PlusIcon() {
  return (
    <SvgIcon>
      <path d="M12 5v14M5 12h14" />
    </SvgIcon>
  );
}

function UsersIcon() {
  return (
    <SvgIcon size={18}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </SvgIcon>
  );
}

function ActivityIcon() {
  return (
    <SvgIcon size={18}>
      <path d="M3 12h4l2-6 4 12 2-6h6" />
    </SvgIcon>
  );
}

function RevenueIcon() {
  return (
    <SvgIcon size={18}>
      <path d="M4 17 9 12l4 4 7-9" />
      <path d="M15 7h5v5" />
    </SvgIcon>
  );
}

function CrownIcon() {
  return (
    <SvgIcon size={18}>
      <path d="m3 7 4 4 5-7 5 7 4-4-2 11H5L3 7Z" />
      <path d="M5 21h14" />
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

function DownloadIcon() {
  return (
    <SvgIcon size={15}>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
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

function CloseIcon() {
  return (
    <SvgIcon size={17}>
      <path d="m6 6 12 12M18 6 6 18" />
    </SvgIcon>
  );
}