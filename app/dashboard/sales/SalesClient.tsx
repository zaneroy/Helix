"use client";

import {
  useMemo,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import AdminShell from "@/components/admin/AdminShell";
import { createCurrencyFormatter } from "@/lib/currency/formatCurrency";
import type { Notification } from "@/types/notifications";
import { useRouter } from "next/navigation";
import ImportButton from "@/components/import-export/ImportButton";
import type { ImportHandler } from "@/lib/import-export/parser/importRunner";
import type {
  ImportedSaleRow,
  SalesCashAccount,
} from "./page";

type Product = {
  id: string;
  item_name: string | null;
  name: string;
  sku: string | null;
  quantity_sold: number | string | null;
  quantity_on_hand: number | string | null;
  quantity_bought: number | string | null;
  price_per_piece: number | string | null;
  selling_price: number | string | null;
};

type SaleProduct = {
  item_name: string | null;
  name: string;
  sku: string | null;
};

export type Sale = {
  id: string;
  quantity: number;
  sale_price: number | string | null;
  unit_cost: number | string | null;
  total_amount: number | string | null;
  profit_amount: number | string | null;
  sold_at: string | null;
  created_by?: string | null;
  recorded_by_name?: string | null;
  recorded_by_role?: string | null;
  notes?: string | null;
  products?: SaleProduct | SaleProduct[] | null;
};

type Props = {
  products: Product[];
  sales: Sale[];
  accounts: SalesCashAccount[];
  error?: string;
  success?: string;
  recordSale: (formData: FormData) => void;
  importSales: (
    rows: ImportedSaleRow[]
  ) => Promise<{
    imported: number;
    failed: number;
    skipped: number;
  }>;
  updateSale: (formData: FormData) => void;
  deleteSale: (formData: FormData) => void;
  adminName: string;
  currency: string;
  notifications: Notification[];
  userId: string;
};

type ProductPerformance = {
  name: string;
  sku: string;
  revenue: number;
  profit: number;
  units: number;
};

type DailyRevenue = {
  label: string;
  revenue: number;
  profit: number;
  units: number;
  averageSale: number;
};

const PANEL =
  "rounded-2xl border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]";

function getSaleProduct(sale: Sale): SaleProduct | null {
  if (!sale.products) return null;
  return Array.isArray(sale.products)
    ? sale.products[0] ?? null
    : sale.products;
}

function getProductDisplayName(product?: SaleProduct | null) {
  return product?.item_name || product?.name || product?.sku || "Product";
}

export default function SalesClient({
  products,
  sales,
  accounts,
  error,
  success,
  recordSale,
  importSales,
  updateSale,
  deleteSale,
  adminName,
  currency,
  notifications,
  userId,
}: Props) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [deleteSaleId, setDeleteSaleId] = useState<string | null>(null);
  const [search, setSearch] = useState("");


  const router = useRouter();

  const salesImportHandler: ImportHandler = async (rows) => {
    const result = await importSales(
      rows as ImportedSaleRow[]
    );

    router.refresh();

    return result;
  };

  const money = createCurrencyFormatter(currency);

  const preciseMoney = useMemo(
    () =>
      new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [currency]
  );

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.status === "active"),
    [accounts]
  );

  const selectedAccount = useMemo(
    () =>
      activeAccounts.find(
        (account) => account.id === selectedAccountId
      ) || null,
    [activeAccounts, selectedAccountId]
  );

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId),
    [products, selectedProductId]
  );

  const quantityOnHand = Number(selectedProduct?.quantity_on_hand || 0);
  const unitCost = selectedProduct ? getUnitCost(selectedProduct) : 0;
  const safeQuantity = Number.isFinite(quantity) ? quantity : 1;
  const total = sellingPrice * safeQuantity;
  const profit = (sellingPrice - unitCost) * safeQuantity;
  const isOutOfStock = selectedProduct ? quantityOnHand <= 0 : false;
  const isOverselling = selectedProduct
    ? safeQuantity > quantityOnHand
    : false;

  const canSubmit =
    Boolean(selectedProduct) &&
    Boolean(selectedAccount) &&
    safeQuantity > 0 &&
    sellingPrice > 0 &&
    !isOutOfStock &&
    !isOverselling;

  const totalRevenue = useMemo(
    () =>
      sales.reduce(
        (sum, sale) => sum + Number(sale.total_amount || 0),
        0
      ),
    [sales]
  );

  const grossProfit = useMemo(
    () =>
      sales.reduce(
        (sum, sale) => sum + Number(sale.profit_amount || 0),
        0
      ),
    [sales]
  );

  const unitsSold = useMemo(
    () =>
      sales.reduce(
        (sum, sale) => sum + Number(sale.quantity || 0),
        0
      ),
    [sales]
  );

  const averageSale = sales.length > 0 ? totalRevenue / sales.length : 0;
  const grossMargin =
    totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return sales;

    return sales.filter((sale) => {
      const product = getSaleProduct(sale);

      return [
        getProductDisplayName(product),
        product?.sku,
        sale.quantity,
        sale.sale_price,
        sale.total_amount,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [sales, search]);

  const productPerformance = useMemo<ProductPerformance[]>(() => {
    const totals = new Map<string, ProductPerformance>();

    for (const sale of sales) {
      const product = getSaleProduct(sale);
      const name = getProductDisplayName(product);
      const key = `${name}:${product?.sku || ""}`;
      const current = totals.get(key) || {
        name,
        sku: product?.sku || "—",
        revenue: 0,
        profit: 0,
        units: 0,
      };

      current.revenue += Number(sale.total_amount || 0);
      current.profit += Number(sale.profit_amount || 0);
      current.units += Number(sale.quantity || 0);
      totals.set(key, current);
    }

    return Array.from(totals.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [sales]);

  const dailyRevenue = useMemo<DailyRevenue[]>(() => {
    const days = new Map<
      string,
      {
        revenue: number;
        profit: number;
        units: number;
        saleCount: number;
        date: Date;
      }
    >();

    for (const sale of sales) {
      const date = sale.sold_at ? new Date(sale.sold_at) : new Date();
      if (Number.isNaN(date.getTime())) continue;
      const key = date.toISOString().slice(0, 10);
      const current = days.get(key) || {
        revenue: 0, profit: 0, units: 0, saleCount: 0, date,
      };
      current.revenue += Number(sale.total_amount || 0);
      current.profit += Number(sale.profit_amount || 0);
      current.units += Number(sale.quantity || 0);
      current.saleCount += 1;
      days.set(key, current);
    }

    return Array.from(days.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-12)
      .map((day) => ({
        label: day.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        revenue: day.revenue,
        profit: day.profit,
        units: day.units,
        averageSale: day.saleCount > 0 ? day.revenue / day.saleCount : 0,
      }));
  }, [sales]);


  function exportSales() {
    const headers = [
      "Product",
      "SKU",
      "Quantity",
      "Sale Price",
      "Revenue",
      "Profit",
      "Margin",
      "Date",
    ];

    const rows = filteredSales.map((sale) => {
      const product = getSaleProduct(sale);
      const revenue = Number(sale.total_amount || 0);
      const profit = Number(sale.profit_amount || 0);
      const margin =
        revenue > 0 ? (profit / revenue) * 100 : 0;

      return [
        getProductDisplayName(product),
        `="${String(product?.sku || "").replaceAll(
          '"',
          '""'
        )}"`,
        Number(sale.quantity || 0),
        Number(sale.sale_price || 0).toFixed(2),
        revenue.toFixed(2),
        profit.toFixed(2),
        `${margin.toFixed(1)}%`,
        formatDate(sale.sold_at),
      ];
    });

    const escapeCsvValue = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;

    const csv = [headers, ...rows]
      .map((row) =>
        row.map(escapeCsvValue).join(",")
      )
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `helix-sales-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }


  return (
    <AdminShell
      title="Sales"
      adminName={adminName}
      adminRole="Founder"
      showPageHeader={false}
      notifications={notifications}
      userId={userId}
    >
      <main className="min-h-screen bg-[color:var(--app-bg)] text-[color:var(--text-primary)]">
        <div className="mx-auto w-full max-w-[1680px] space-y-6 pb-12">
          <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--primary)]">
                Revenue command center
              </p>
              <h1 className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.04em]">
                Sales
              </h1>
              <p className="mt-3 text-[13px] text-[color:var(--text-tertiary)]">
                Record revenue, reduce inventory and direct cash into the
                correct financial account.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={exportSales}
                disabled={filteredSales.length === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-5 text-sm font-semibold text-[color:var(--text-primary)] transition hover:border-[color:var(--border-brand)] hover:bg-[color:var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <DownloadIcon />
                Export CSV
              </button>

              <ImportButton
                module="sales"
                importer={salesImportHandler}
                label="Import Sales"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-5 text-sm font-semibold text-[color:var(--text-primary)] transition hover:border-[color:var(--border-brand)] hover:bg-[color:var(--primary-soft)]"
              />

              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
                  Gross margin
                </p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--primary)]">
                  {grossMargin.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
                  Active accounts
                </p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--primary)]">
                  {activeAccounts.length}
                </p>
              </div>
            </div>
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

          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <MetricCard
              label="Total Revenue"
              value={preciseMoney.format(totalRevenue)}
              note={`${sales.length} recorded sales`}
              icon={<RevenueIcon />}
              tone="cyan"
              chartType="bar"
              chartData={dailyRevenue.map((day) => ({ label: day.label, value: day.revenue }))}
              valueFormatter={(value) => preciseMoney.format(value)}
            />
            <MetricCard
              label="Gross Profit"
              value={preciseMoney.format(grossProfit)}
              note={`${grossMargin.toFixed(1)}% gross margin`}
              icon={<ProfitIcon />}
              tone="green"
              chartType="bar"
              chartData={dailyRevenue.map((day) => ({ label: day.label, value: day.profit }))}
              valueFormatter={(value) => preciseMoney.format(value)}
            />
            <MetricCard
              label="Units Sold"
              value={unitsSold.toLocaleString("en-GB")}
              note={`${productPerformance.length} products generating revenue`}
              icon={<UnitsIcon />}
              tone="blue"
              chartType="bar"
              chartData={dailyRevenue.map((day) => ({ label: day.label, value: day.units }))}
              valueFormatter={(value) => Math.round(value).toLocaleString("en-GB")}
            />
            <MetricCard
              label="Average Sale"
              value={preciseMoney.format(averageSale)}
              note="Average transaction value"
              icon={<AverageIcon />}
              tone="violet"
              chartType="line"
              chartData={dailyRevenue.map((day) => ({ label: day.label, value: day.averageSale }))}
              valueFormatter={(value) => preciseMoney.format(value)}
            />
          </section>

          <section className="grid gap-5 2xl:grid-cols-[minmax(0,1.45fr)_360px]">
            <div className={`${PANEL} p-6`}>
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                <div>
                  <p className="text-[16px] font-semibold">Record Sale</p>
                  <p className="mt-1 text-[11px] text-[color:var(--text-tertiary)]">
                    Inventory, revenue, profit and Accounts update together.
                  </p>
                </div>

                {selectedAccount && (
                  <div className="rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
                      Receiving account
                    </p>
                    <p className="mt-1 text-xs font-medium text-[color:var(--primary)]">
                      {selectedAccount.name}
                    </p>
                  </div>
                )}
              </div>

              <form action={recordSale} className="mt-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <ProductSelect
                    products={products}
                    value={selectedProductId}
                    onChange={(productId) => {
                      setSelectedProductId(productId);
                      setQuantity(1);

                      const product = products.find(
                        (item) => item.id === productId
                      );

                      setSellingPrice(
                        Number(product?.selling_price || 0)
                      );
                    }}
                  />

                  <AccountSelect
                    accounts={activeAccounts}
                    value={selectedAccountId}
                    onChange={setSelectedAccountId}
                    money={money}
                    name="account_id"
                    label="Receive into account"
                  />

                  <NumberField
                    label="Quantity sold"
                    name="quantity"
                    min="1"
                    max={
                      selectedProduct
                        ? String(quantityOnHand)
                        : undefined
                    }
                    step="1"
                    value={quantity}
                    onChange={setQuantity}
                  />

                  <NumberField
                    label="Selling price per unit"
                    name="selling_price"
                    min="0.01"
                    step="0.01"
                    value={sellingPrice}
                    onChange={setSellingPrice}
                  />
                </div>

                {(isOverselling || isOutOfStock) && (
                  <div className="mt-4 rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger)]">
                    {isOutOfStock
                      ? "This product is out of stock and cannot be sold."
                      : `Not enough inventory. Available: ${quantityOnHand}. Requested: ${safeQuantity}.`}
                  </div>
                )}

                {activeAccounts.length === 0 && (
                  <div className="mt-4 rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger)]">
                    Create an active account on the Accounts page before
                    recording a sale.
                  </div>
                )}

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <Preview
                    label="Available stock"
                    value={
                      selectedProduct
                        ? quantityOnHand.toLocaleString("en-GB")
                        : "Select product"
                    }
                  />
                  <Preview
                    label="Stock after sale"
                    value={
                      selectedProduct
                        ? Math.max(
                            quantityOnHand - safeQuantity,
                            0
                          ).toLocaleString("en-GB")
                        : "Select product"
                    }
                  />
                  <Preview
                    label="Unit cost"
                    value={preciseMoney.format(unitCost)}
                  />
                  <Preview
                    label="Sale total"
                    value={preciseMoney.format(Number(total || 0))}
                    accent
                  />
                  <Preview
                    label="Gross profit"
                    value={preciseMoney.format(Number(profit || 0))}
                    positive={profit >= 0}
                    negative={profit < 0}
                  />
                </div>

                <button
                  disabled={!canSubmit}
                  className="mt-5 inline-flex min-w-40 items-center justify-center gap-2 rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary)] px-5 py-3 text-sm font-semibold text-[color:var(--text-on-brand)] transition hover:bg-[color:var(--primary)] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <PlusIcon />
                  Record Sale
                </button>
              </form>
            </div>

            <RecentSales sales={sales.slice(0, 5)} money={money} />
          </section>

          <section className={`${PANEL} overflow-hidden`}>
            <div className="flex flex-col gap-4 border-b border-[color:var(--border)] p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[16px] font-semibold">
                  Sales Transactions
                </p>
                <p className="mt-1 text-[11px] text-[color:var(--text-tertiary)]">
                  Revenue, profit and inventory history.
                </p>
              </div>

              <label className="flex h-10 w-full max-w-sm items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3">
                <SearchIcon />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search sales..."
                  className="w-full bg-transparent text-xs text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
                />
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead className="bg-[color:var(--surface-soft)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">
                  <tr className="border-b border-[color:var(--border)]">
                    <th className="px-5 py-4">Product</th>
                    <th className="px-5 py-4">SKU / By</th>
                    <th className="px-5 py-4">Quantity</th>
                    <th className="px-5 py-4">Sale / Cost</th>
                    <th className="px-5 py-4">Revenue</th>
                    <th className="px-5 py-4">Profit</th>
                    <th className="px-5 py-4">Margin</th>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSales.length > 0 ? (
                    filteredSales.map((sale) => (
                      <SaleRow
                        key={sale.id}
                        sale={sale}
                        money={preciseMoney}
                        onEdit={() => setEditingSale(sale)}
                      />
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-5 py-16 text-center text-sm text-[color:var(--text-tertiary)]"
                      >
                        No matching sales found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 border-t border-[color:var(--border)] px-5 py-4 text-[11px] text-[color:var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {filteredSales.length} of {sales.length} sales
              </span>
              <span>
                Revenue shown in {currency}
              </span>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)_340px]">
            <RevenueTrend data={dailyRevenue} money={preciseMoney} />
            <TopProducts
              products={productPerformance}
              totalRevenue={totalRevenue}
              money={preciseMoney}
            />
            <ReceivingAccounts
              accounts={activeAccounts}
              money={preciseMoney}
            />
          </section>

          {editingSale && (
            <SaleEditDrawer
              sale={editingSale}
              accounts={activeAccounts}
              money={money}
              updateSale={updateSale}
              onClose={() => setEditingSale(null)}
              onRequestDelete={(id) => setDeleteSaleId(id)}
            />
          )}

          <ConfirmDialog
            open={Boolean(deleteSaleId)}
            title="Delete Sale"
            description="Delete this sale? Inventory will be restored and the linked Accounts entry will be reversed for audit history."
            confirmText="Delete Sale"
            cancelText="Cancel"
            onCancel={() => setDeleteSaleId(null)}
            onConfirm={() => {
              if (!deleteSaleId) return;

              const formData = new FormData();
              formData.append("id", deleteSaleId);
              deleteSale(formData);
              setDeleteSaleId(null);
            }}
          />
        </div>
      </main>
    </AdminShell>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon,
  tone,
  chartType,
  chartData,
  valueFormatter,
}: {
  label: string;
  value: string;
  note: string;
  icon: ReactNode;
  tone: "cyan" | "green" | "blue" | "violet";
  chartType: "bar" | "line";
  chartData: Array<{ label: string; value: number }>;
  valueFormatter: (value: number) => string;
}) {
  const toneClass = {
    cyan: "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
    green: "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
    blue: "border-[color:var(--secondary-border)] bg-[color:var(--secondary-soft)] text-[color:var(--secondary)]",
    violet: "border-[color:var(--violet-border)] bg-[color:var(--violet-soft)] text-[color:var(--chart-5)]",
  }[tone];

  return (
    <div className={`${PANEL} min-h-[250px] p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[color:var(--text-secondary)]">{label}</p>
          <p className="mt-3 text-[25px] font-semibold tracking-[-0.04em]">{value}</p>
          <p className="mt-3 text-[11px] text-[color:var(--text-muted)]">{note}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${toneClass}`}>{icon}</div>
      </div>
      <CompactMetricChart data={chartData} tone={tone} type={chartType} valueFormatter={valueFormatter} />
    </div>
  );
}

function CompactMetricChart({ data, tone, type, valueFormatter }: {
  data: Array<{ label: string; value: number }>;
  tone: "cyan" | "green" | "blue" | "violet";
  type: "bar" | "line";
  valueFormatter: (value: number) => string;
}) {
  const width = 360, height = 118, left = 36, right = 8, top = 8, bottom = 22;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const visibleData = data.length ? data : [{label:"—",value:0},{label:"—",value:0},{label:"—",value:0}];
  const maximum = Math.max(...visibleData.map((item) => Number(item.value || 0)), 1);
  const chartColor = { cyan: "var(--chart-1)", green: "var(--chart-3)", blue: "var(--chart-2)", violet: "var(--chart-5)" }[tone];
  const yTicks = [maximum, maximum * 0.5, 0];
  const barGap = 5;
  const barWidth = Math.max(5, (plotWidth - barGap * (visibleData.length - 1)) / visibleData.length);
  const linePoints = visibleData.map((item, index) => {
    const x = visibleData.length === 1 ? left + plotWidth / 2 : left + (index / (visibleData.length - 1)) * plotWidth;
    const y = top + plotHeight - (Math.max(Number(item.value || 0), 0) / maximum) * plotHeight;
    return { x, y };
  });
  const linePath = linePoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const firstLabel = visibleData[0]?.label || "—";
  const middleLabel = visibleData[Math.floor((visibleData.length - 1) / 2)]?.label || "—";
  const lastLabel = visibleData[visibleData.length - 1]?.label || "—";

  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[118px] w-full overflow-visible" role="img" aria-label="Metric history chart">
        {yTicks.map((tick, index) => {
          const y = top + (index / (yTicks.length - 1)) * plotHeight;
          return <g key={`${tick}-${index}`}>
            <line x1={left} x2={width-right} y1={y} y2={y} stroke="var(--chart-grid)" />
            <text x={left-6} y={y+3} textAnchor="end" fill="var(--chart-label)" fontSize="8">{formatCompactChartValue(tick)}</text>
          </g>;
        })}
        {type === "bar" ? visibleData.map((item,index) => {
          const value=Math.max(Number(item.value||0),0);
          const barHeight=(value/maximum)*plotHeight;
          const x=left+index*(barWidth+barGap);
          const y=top+plotHeight-barHeight;
          return <rect key={`${item.label}-${index}`} x={x} y={y} width={barWidth} height={Math.max(barHeight,1)} rx="2" fill={chartColor} opacity={0.78}><title>{`${item.label}: ${valueFormatter(value)}`}</title></rect>;
        }) : <>
          <path d={linePath} fill="none" stroke={chartColor} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          {linePoints.map((point,index)=><circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="2.6" fill={chartColor}><title>{`${visibleData[index].label}: ${valueFormatter(visibleData[index].value)}`}</title></circle>)}
        </>}
        <text x={left} y={height-4} textAnchor="start" fill="var(--chart-label)" fontSize="8">{firstLabel}</text>
        <text x={left+plotWidth/2} y={height-4} textAnchor="middle" fill="var(--chart-label)" fontSize="8">{middleLabel}</text>
        <text x={width-right} y={height-4} textAnchor="end" fill="var(--chart-label)" fontSize="8">{lastLabel}</text>
      </svg>
    </div>
  );
}

function formatCompactChartValue(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${(value/1_000_000).toFixed(1)}m`;
  if (absolute >= 1_000) return `${(value/1_000).toFixed(absolute >= 10_000 ? 0 : 1)}k`;
  if (absolute >= 100) return Math.round(value).toLocaleString("en-GB");
  if (absolute >= 10) return value.toFixed(0);
  return value.toFixed(value % 1 === 0 ? 0 : 1);
}

function ProductSelect({
  products,
  value,
  onChange,
}: {
  products: Product[];
  value: string;
  onChange: (productId: string) => void;
}) {
  return (
    <label className="text-xs text-[color:var(--text-secondary)]">
      Product
      <select
        name="product_id"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
      >
        <option value="">Select product</option>
        {products.map((product) => {
          const available = Number(product.quantity_on_hand || 0);
          const disabled = available <= 0;

          return (
            <option key={product.id} value={product.id} disabled={disabled}>
              {product.sku || "No SKU"} ·{" "}
              {product.item_name || product.name} ·{" "}
              {disabled ? "OUT OF STOCK" : `${available} available`}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function AccountSelect({
  accounts,
  money,
  name,
  label,
  value,
  onChange,
}: {
  accounts: SalesCashAccount[];
  money: ReturnType<typeof createCurrencyFormatter>;
  name: string;
  label: string;
  value?: string;
  onChange?: (accountId: string) => void;
}) {
  const controlled = value !== undefined;

  return (
    <label className="text-xs text-[color:var(--text-secondary)]">
      {label}
      <select
        name={name}
        required
        value={controlled ? value : undefined}
        defaultValue={controlled ? undefined : ""}
        onChange={
          onChange
            ? (event) => onChange(event.target.value)
            : undefined
        }
        className="mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
      >
        <option value="">Select account</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name} · {money(account.balance)}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  name,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  name: string;
  min: string;
  max?: string;
  step: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-xs text-[color:var(--text-secondary)]">
      {label}
      <input
        name={name}
        type="number"
        min={min}
        max={max}
        step={step}
        required
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
      />
    </label>
  );
}

function Preview({
  label,
  value,
  accent,
  positive,
  negative,
}: {
  label: string;
  value: string;
  accent?: boolean;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
        {label}
      </p>
      <p
        className={`mt-2 truncate text-sm font-medium ${
          negative
            ? "text-[color:var(--danger)]"
            : positive
              ? "text-[color:var(--success)]"
              : accent
                ? "text-[color:var(--primary)]"
                : "text-[color:var(--text-primary)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function RecentSales({
  sales,
  money,
}: {
  sales: Sale[];
  money: ReturnType<typeof createCurrencyFormatter>;
}) {
  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Recent Sales</p>
        <span className="text-[10px] text-[color:var(--primary)]">Latest</span>
      </div>

      <div className="mt-5 space-y-4">
        {sales.length > 0 ? (
          sales.map((sale) => {
            const product = getSaleProduct(sale);

            return (
              <div key={sale.id} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--success-soft)] text-[color:var(--success)]">
                  <ArrowDownIcon />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-[color:var(--text-primary)]">
                    {sale.quantity} × {getProductDisplayName(product)}
                  </p>
                  <p className="mt-1 text-[10px] text-[color:var(--text-tertiary)]">
                    {money(Number(sale.total_amount || 0))} revenue ·{" "}
                    {money(Number(sale.profit_amount || 0))} profit
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState text="No sales activity yet." />
        )}
      </div>
    </div>
  );
}

function SaleRow({
  sale,
  money,
  onEdit,
}: {
  sale: Sale;
  money: Intl.NumberFormat;
  onEdit: () => void;
}) {
  const product = getSaleProduct(sale);
  const revenue = Number(sale.total_amount || 0);
  const profit = Number(sale.profit_amount || 0);
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  return (
    <tr className="border-b border-[color:var(--border)] text-[12px] last:border-b-0 hover:bg-[color:var(--surface-soft)]">
      <td className="px-5 py-4">
        <div className="min-w-0">
          <p className="truncate font-medium text-[color:var(--text-primary)]">
            {getProductDisplayName(product)}
          </p>
          {sale.notes?.trim() ? (
            <p className="mt-1 line-clamp-1 text-xs text-[color:var(--primary)]" title={sale.notes.trim()}>
              Note: {sale.notes.trim()}
            </p>
          ) : null}
        </div>
      </td>
      <td className="px-5 py-4">
        <p className="text-[color:var(--text-tertiary)]">{product?.sku || "—"}</p>
        <p className="mt-1 truncate text-xs text-[color:var(--text-muted)]">
          {getSaleRecorderDisplay(sale)}
        </p>
      </td>
      <td className="px-5 py-4 text-[color:var(--text-secondary)]">
        {Number(sale.quantity || 0).toLocaleString("en-GB")}
      </td>
      <td className="px-5 py-4">
        <p className="text-[color:var(--text-secondary)]">{money.format(Number(sale.sale_price || 0))}</p>
        <p className="mt-1 text-xs text-[color:var(--text-muted)]">
          Cost {money.format(Number(sale.unit_cost || 0))}
        </p>
      </td>
      <td className="px-5 py-4 font-medium text-[color:var(--primary)]">
        {money.format(revenue)}
      </td>
      <td
        className={`px-5 py-4 font-medium ${
          profit >= 0 ? "text-[color:var(--success)]" : "text-[color:var(--danger)]"
        }`}
      >
        {money.format(profit)}
      </td>
      <td
        className={`px-5 py-4 ${
          margin >= 0 ? "text-[color:var(--text-secondary)]" : "text-[color:var(--danger)]"
        }`}
      >
        {margin.toFixed(1)}%
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-[color:var(--text-tertiary)]">
        {formatDate(sale.sold_at)}
      </td>
      <td className="px-5 py-4">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-3 py-2 text-[11px] font-medium text-[color:var(--primary)] transition hover:bg-[color:var(--primary-soft)]"
        >
          Edit
        </button>
      </td>
    </tr>
  );
}

function saleDetailNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

function saleDetailDate(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getSaleRecorderDisplay(sale: Sale): string {
  if (sale.recorded_by_name) return sale.recorded_by_name;

  if (sale.created_by) return "Team member";

  return "System/Admin";
}

function getSaleRoleDisplay(sale: Sale): string {
  if (sale.recorded_by_role) {
    return sale.recorded_by_role.replaceAll("_", " ");
  }

  if (sale.created_by) return "Employee / team";

  return "Manual sale";
}


function AdminSaleDetailReview({
  sales,
  currency,
}: {
  sales: Sale[];
  currency: string;
}) {
  const money = createCurrencyFormatter(currency);
  const latestSales = sales.slice(0, 5);
  const notedSales = latestSales.filter((sale) => sale.notes?.trim()).length;
  const reviewRevenue = latestSales.reduce(
    (sum, sale) => sum + saleDetailNumber(sale.total_amount),
    0
  );
  const reviewProfit = latestSales.reduce(
    (sum, sale) => sum + saleDetailNumber(sale.profit_amount),
    0
  );

  return (
    <section className={`${PANEL} overflow-hidden`}>
      <div className="border-b border-[color:var(--border)] px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--primary)]">
              Employee sale review
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
              Employee sale notes
            </h2>
            <p className="mt-2 text-xs leading-5 text-[color:var(--text-tertiary)]">
              Compact admin view of employee notes, SKU, quantity, sale price, cost and profit.
            </p>
          </div>

          <span className="shrink-0 rounded-full border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-3 py-2 text-center text-[11px] leading-4 text-[color:var(--primary)]">
            {latestSales.length}
            <br />
            latest
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
              Notes
            </p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">{notedSales}</p>
          </div>
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
              Revenue
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-[color:var(--primary)]">
              {money(reviewRevenue)}
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
              Profit
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-[color:var(--success)]">
              {money(reviewProfit)}
            </p>
          </div>
        </div>
      </div>

      {latestSales.length > 0 ? (
        <div className="divide-y divide-[color:var(--divider)]">
          {latestSales.map((sale) => {
            const product = getSaleProduct(sale);
            const salePrice = saleDetailNumber(sale.sale_price);
            const unitCost = saleDetailNumber(sale.unit_cost);
            const profit = saleDetailNumber(sale.profit_amount);
            const note = sale.notes?.trim();

            return (
              <article
                key={`compact-sale-review-${sale.id}`}
                className="px-5 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                      {getProductDisplayName(product)}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-[color:var(--text-tertiary)]">
                      SKU {product?.sku || "-"} - Qty {sale.quantity} - {saleDetailDate(sale.sold_at)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-[color:var(--primary)]">
                      {money(salePrice)}
                    </p>
                    <p className={profit >= 0 ? "mt-1 text-[11px] text-[color:var(--success)]" : "mt-1 text-[11px] text-[color:var(--danger)]"}>
                      {money(profit)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2.5 py-2">
                    <p className="text-[color:var(--text-muted)]">Recorded by</p>
                    <p className="mt-1 truncate text-[color:var(--text-secondary)]">
                      {getSaleRecorderDisplay(sale)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2.5 py-2">
                    <p className="text-[color:var(--text-muted)]">Cost</p>
                    <p className="mt-1 text-[color:var(--text-secondary)]">{money(unitCost)}</p>
                  </div>
                </div>

                <div className="mt-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
                    Employee note
                  </p>
                  {note ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--text-secondary)]" title={note}>
                      {note}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-[color:var(--text-muted)]">No note</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="px-5 py-8">
          <EmptyState text="No sales have been recorded yet." />
        </div>
      )}
    </section>
  );
}



function RevenueTrend({
  data,
  money,
}: {
  data: DailyRevenue[];
  money: Intl.NumberFormat;
}) {
  const revenueValues = data.map((item) => item.revenue);
  const profitValues = data.map((item) => item.profit);
  const revenuePath = buildChartPath(revenueValues, 640, 180);
  const profitPath = buildChartPath(profitValues, 640, 180);
  const latest = data.at(-1);

  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-semibold">Revenue Trend</p>
          <div className="mt-3 flex gap-5 text-[10px] text-[color:var(--text-tertiary)]">
            <LegendDot color="bg-[color:var(--primary)]" label="Revenue" />
            <LegendDot color="bg-[color:var(--success)]" label="Profit" />
          </div>
        </div>

        {latest && (
          <div className="rounded-lg border border-[color:var(--border)] px-3 py-2 text-right">
            <p className="text-[9px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
              Latest period
            </p>
            <p className="mt-1 text-xs text-[color:var(--primary)]">
              {money.format(latest.revenue)}
            </p>
          </div>
        )}
      </div>

      {data.length > 0 ? (
        <>
          <svg
            viewBox="0 0 680 220"
            className="mt-5 h-[220px] w-full"
            aria-label="Revenue and profit trend"
          >
            {[40, 80, 120, 160, 200].map((y) => (
              <line
                key={y}
                x1="20"
                x2="660"
                y1={y}
                y2={y}
                stroke="var(--chart-grid)"
              />
            ))}
            <path
              d={revenuePath}
              fill="none"
              stroke="var(--chart-1)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={profitPath}
              fill="none"
              stroke="var(--chart-3)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <div className="flex justify-between gap-2 overflow-hidden text-[9px] text-[color:var(--text-muted)]">
            {data.map((item) => (
              <span key={item.label} className="truncate">
                {item.label}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-5">
          <EmptyState text="Record sales to build the revenue trend." />
        </div>
      )}
    </div>
  );
}

function TopProducts({
  products,
  totalRevenue,
  money,
}: {
  products: ProductPerformance[];
  totalRevenue: number;
  money: Intl.NumberFormat;
}) {
  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Top Products</p>
        <span className="text-[10px] text-[color:var(--primary)]">
          {products.length}
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {products.length > 0 ? (
          products.map((product, index) => {
            const share =
              totalRevenue > 0
                ? (product.revenue / totalRevenue) * 100
                : 0;

            return (
              <div key={`${product.name}-${product.sku}`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color:var(--primary-soft)] text-[10px] font-semibold text-[color:var(--primary)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-[color:var(--text-primary)]">
                          {product.name}
                        </p>
                        <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">
                          {product.units.toLocaleString("en-GB")} units ·{" "}
                          {product.sku}
                        </p>
                      </div>
                      <p className="shrink-0 text-xs font-medium text-[color:var(--primary)]">
                        {money.format(product.revenue)}
                      </p>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:var(--surface-soft)]">
                      <div
                        className="h-full rounded-full bg-[color:var(--primary)]"
                        style={{ width: `${Math.max(share, 2)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState text="No product performance yet." />
        )}
      </div>
    </div>
  );
}

function ReceivingAccounts({
  accounts,
  money,
}: {
  accounts: SalesCashAccount[];
  money: Intl.NumberFormat;
}) {
  const total = accounts.reduce(
    (sum, account) => sum + Number(account.balance || 0),
    0
  );

  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Receiving Accounts</p>
        <span className="text-[10px] text-[color:var(--primary)]">{accounts.length}</span>
      </div>

      <div className="mt-5 divide-y divide-[color:var(--divider)]">
        {accounts.length > 0 ? (
          accounts.slice(0, 6).map((account) => (
            <div key={account.id} className="flex items-center gap-3 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
                <BankIcon />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] text-[color:var(--text-secondary)]">
                  {account.name}
                </p>
                <p className="mt-1 text-[9px] capitalize text-[color:var(--text-muted)]">
                  {account.account_type.replaceAll("_", " ")}
                </p>
              </div>
              <p className="text-[11px] font-medium text-[color:var(--text-primary)]">
                {money.format(Number(account.balance || 0))}
              </p>
            </div>
          ))
        ) : (
          <EmptyState text="No active receiving accounts." />
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[color:var(--border)] pt-4">
        <p className="text-sm font-semibold text-[color:var(--primary)]">Total cash</p>
        <p className="text-sm font-semibold text-[color:var(--primary)]">
          {money.format(total)}
        </p>
      </div>
    </div>
  );
}

function SaleEditDrawer({
  sale,
  accounts,
  money,
  updateSale,
  onClose,
  onRequestDelete,
}: {
  sale: Sale;
  accounts: SalesCashAccount[];
  money: ReturnType<typeof createCurrencyFormatter>;
  updateSale: (formData: FormData) => void;
  onClose: () => void;
  onRequestDelete: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-[color:var(--overlay-strong)] backdrop-blur-sm">
      <div className="h-full w-full max-w-md overflow-y-auto border-l border-[color:var(--border-brand)] bg-[color:var(--surface)] p-6 shadow-2xl shadow-[var(--shadow-card)]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold">Edit Sale</p>
            <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
              Changes update inventory and the linked Accounts entry.
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

        <form action={updateSale} className="space-y-4">
          <input type="hidden" name="id" defaultValue={sale.id} />

          <AccountSelect
            accounts={accounts}
            money={money}
            name="account_id"
            label="Receiving account"
          />

          <Field
            name="quantity"
            label="Quantity sold"
            type="number"
            min="1"
            step="1"
            defaultValue={sale.quantity}
            required
          />

          <Field
            name="selling_price"
            label="Selling price per unit"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={Number(sale.sale_price || 0)}
            required
          />

          <button className="w-full rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary)] px-4 py-3 text-sm font-semibold text-[color:var(--text-on-brand)] transition hover:bg-[color:var(--primary)]">
            Save Sale Changes
          </button>
        </form>

        <button
          type="button"
          onClick={() => onRequestDelete(sale.id)}
          className="mt-4 w-full rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-4 py-3 text-sm font-medium text-[color:var(--danger)]"
        >
          Delete Sale
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  step,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  step?: string;
}) {
  return (
    <label className="block text-xs text-[color:var(--text-secondary)]">
      {label}
      <input
        {...props}
        step={step}
        className="mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
      />
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-6 text-center text-xs text-[color:var(--text-muted)]">
      {text}
    </div>
  );
}

function LegendDot({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <i className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function buildChartPath(
  values: number[],
  width: number,
  height: number
) {
  if (values.length === 0) return "";

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const left = 20;
  const top = 20;
  const usableWidth = width - 40;
  const usableHeight = height - 30;

  const points = values.map((value, index) => {
    const x =
      values.length === 1
        ? left + usableWidth / 2
        : left + (index / (values.length - 1)) * usableWidth;
    const y =
      top + usableHeight - ((value - min) / range) * usableHeight;

    return { x, y };
  });

  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(
          2
        )} ${point.y.toFixed(2)}`
    )
    .join(" ");
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getUnitCost(product: Product) {
  return Number(product.price_per_piece || 0);
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

function RevenueIcon() {
  return (
    <SvgIcon size={19}>
      <path d="M4 17 9 12l4 4 7-9" />
      <path d="M15 7h5v5" />
    </SvgIcon>
  );
}

function ProfitIcon() {
  return (
    <SvgIcon size={19}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8M12 8v8" />
    </SvgIcon>
  );
}

function UnitsIcon() {
  return (
    <SvgIcon size={19}>
      <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" />
      <path d="m4 12 8 4.5 8-4.5M4 16.5l8 4.5 8-4.5" />
    </SvgIcon>
  );
}

function AverageIcon() {
  return (
    <SvgIcon size={19}>
      <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
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
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </SvgIcon>
  );
}

function PlusIcon() {
  return (
    <SvgIcon>
      <path d="M12 5v14M5 12h14" />
    </SvgIcon>
  );
}

function ArrowDownIcon() {
  return (
    <SvgIcon size={14}>
      <path d="M12 4v16" />
      <path d="m6 14 6 6 6-6" />
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