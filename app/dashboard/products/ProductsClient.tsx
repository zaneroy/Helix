"use client";

import { useMemo, useState, type ReactNode } from "react";
import AdminShell from "@/components/admin/AdminShell";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { createCurrencyFormatter } from "@/lib/currency/formatCurrency";
import type { Notification } from "@/types/notifications";

import { useRouter } from "next/navigation";
import ImportButton from "@/components/import-export/ImportButton";
import { downloadCsvExport } from "@/lib/import-export/parser/csvExporter";
import { inventoryImportSchema } from "@/lib/import-export/schemas";
import type { ImportHandler } from "@/lib/import-export/parser/importRunner";
import type { ImportedProductRow } from "./page";

type Product = {
  id: string;
  name: string;
  item_name: string | null;
  sku: string | null;
  supplier: string | null;
  category?: string | null;
  location?: string | null;
  status?: string | null;
  total_cost: number | string | null;
  quantity_bought: number | string | null;
  quantity_sold: number | string | null;
  quantity_on_hand: number | string | null;
  price_per_piece: number | string | null;
  selling_price: number | string | null;
  low_stock_limit: number | string | null;
  delivery_date: string | null;
  notes: string | null;
};

type Props = {
  products: Product[];
  error?: string;
  success?: string;
  addProduct: (formData: FormData) => void;
  updateProduct: (formData: FormData) => void;
  deleteProduct: (formData: FormData) => void;
  importProducts: (rows: ImportedProductRow[]) => Promise<{ imported:number; failed:number; skipped:number; }>;
  adminName: string;
  currency: string;
  notifications: Notification[];
  userId: string;
};

type StockFilter = "all" | "in_stock" | "low_stock" | "out_of_stock";

type ProductMetric = {
  product: Product;
  name: string;
  sku: string;
  supplier: string;
  unitCost: number;
  sellingPrice: number;
  bought: number;
  sold: number;
  onHand: number;
  lowLimit: number;
  inventoryValue: number;
  potentialProfit: number;
  status: Exclude<StockFilter, "all">;
};

const PANEL =
  "rounded-2xl border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]";

export default function ProductsClient({
  products,
  error,
  success,
  addProduct,
  updateProduct,
  deleteProduct,
  importProducts,
  adminName,
  currency,
  notifications,
  userId,
}: Props) {
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [page, setPage] = useState(1);


  const router = useRouter();

  const productsImportHandler: ImportHandler = async (rows) => {
    const result = await importProducts(rows as ImportedProductRow[]);
    router.refresh();
    return result;
  };


  const pageSize = 8;
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

  const metrics = useMemo<ProductMetric[]>(
    () =>
      products.map((product) => {
        const bought = Number(product.quantity_bought || 0);
        const sold = Number(product.quantity_sold || 0);
        const onHand = Number(product.quantity_on_hand || 0);
        const lowLimit = Number(product.low_stock_limit || 0);
        const unitCost = getUnitCost(product);
        const sellingPrice = Number(product.selling_price || 0);
        const status: ProductMetric["status"] =
          onHand <= 0
            ? "out_of_stock"
            : onHand <= lowLimit
              ? "low_stock"
              : "in_stock";

        return {
          product,
          name: product.item_name || product.name || "Product",
          sku: product.sku || "—",
          supplier: product.supplier || "Unspecified",
          unitCost,
          sellingPrice,
          bought,
          sold,
          onHand,
          lowLimit,
          inventoryValue: onHand * unitCost,
          potentialProfit: onHand * Math.max(sellingPrice - unitCost, 0),
          status,
        };
      }),
    [products]
  );

  const suppliers = useMemo(
    () => Array.from(new Set(metrics.map((item) => item.supplier))).sort(),
    [metrics]
  );

  const totals = useMemo(
    () => ({
      value: metrics.reduce((sum, item) => sum + item.inventoryValue, 0),
      units: metrics.reduce((sum, item) => sum + item.onHand, 0),
      profit: metrics.reduce((sum, item) => sum + item.potentialProfit, 0),
      alerts: metrics.filter((item) => item.status !== "in_stock").length,
    }),
    [metrics]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return metrics.filter((item) => {
      const matchesSearch =
        !query ||
        [item.sku, item.name, item.supplier].some((value) =>
          value.toLowerCase().includes(query)
        );
      const matchesStatus = stockFilter === "all" || item.status === stockFilter;
      const matchesSupplier = !supplierFilter || item.supplier === supplierFilter;

      return matchesSearch && matchesStatus && matchesSupplier;
    });
  }, [metrics, search, stockFilter, supplierFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleProducts = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const topSellers = useMemo(
    () => [...metrics].sort((a, b) => b.sold - a.sold).slice(0, 5),
    [metrics]
  );

  const topValue = useMemo(
    () =>
      [...metrics]
        .sort((a, b) => b.inventoryValue - a.inventoryValue)
        .slice(0, 7),
    [metrics]
  );

  const health = useMemo(
    () => ({
      healthy: metrics.filter((item) => item.status === "in_stock").length,
      low: metrics.filter((item) => item.status === "low_stock").length,
      out: metrics.filter((item) => item.status === "out_of_stock").length,
    }),
    [metrics]
  );

  function exportInventory() {
    const headers = [
      "SKU",
      "Product",
      "Supplier",
      "Unit Cost",
      "Selling Price",
      "Bought",
      "Sold",
      "On Hand",
      "Inventory Value",
      "Profit Potential",
      "Status",
    ];

    const rows = filtered.map((item) => [
      // Preserve leading zeroes when opened in Excel.
      `="${String(item.product.sku || "").replaceAll('"', '""')}"`,
      item.name,
      item.supplier,
      item.unitCost.toFixed(2),
      item.sellingPrice.toFixed(2),
      item.bought,
      item.sold,
      item.onHand,
      item.inventoryValue.toFixed(2),
      item.potentialProfit.toFixed(2),
      item.status === "in_stock"
        ? "In stock"
        : item.status === "low_stock"
          ? "Low stock"
          : "Out of stock",
    ]);

    const escapeCsvValue = (value: unknown) => {
      const stringValue = String(value ?? "");
      return `"${stringValue.replaceAll('"', '""')}"`;
    };

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `helix-inventory-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminShell
      title="Inventory"
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
                Inventory command center
              </p>
              <h1 className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.04em]">
                Products
              </h1>
              <p className="mt-3 text-[13px] text-[color:var(--text-tertiary)]">
                Control stock, suppliers, product economics and replenishment risk.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={exportInventory}
                disabled={filtered.length === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-5 text-sm font-semibold text-[color:var(--text-primary)] transition hover:border-[color:var(--border-brand)] hover:bg-[color:var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <DownloadIcon /> Export CSV
              </button>

              <ImportButton
                module="inventory"
                importer={productsImportHandler}
                label="Import Products"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-5 text-sm font-semibold text-[color:var(--text-primary)] transition hover:border-[color:var(--border-brand)] hover:bg-[color:var(--primary-soft)]"
              />

              <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary)] px-5 text-sm font-semibold text-[color:var(--text-on-brand)] transition hover:bg-[color:var(--primary)]"
            >
              <PlusIcon /> Add Product
            </button>
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

          <section className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
            <MetricCard
              label="Inventory Value"
              value={preciseMoney.format(totals.value)}
              note="Current stock valued at cost"
              tone="cyan"
              icon={<ValueIcon />}
              data={topValue.map((item) => item.inventoryValue)}
            />
            <MetricCard
              label="Products"
              value={metrics.length.toLocaleString("en-GB")}
              note={`${suppliers.length} suppliers represented`}
              tone="blue"
              icon={<ProductsIcon />}
              data={metrics.map((item) => item.onHand)}
            />
            <MetricCard
              label="Stock Alerts"
              value={totals.alerts.toLocaleString("en-GB")}
              note="Low or out-of-stock products"
              tone="orange"
              icon={<AlertIcon />}
              data={metrics.map((item) => (item.status === "in_stock" ? 0 : 1))}
            />
            <MetricCard
              label="Potential Profit"
              value={preciseMoney.format(totals.profit)}
              note="If all current stock sells"
              tone="green"
              icon={<ProfitIcon />}
              data={topValue.map((item) => item.potentialProfit)}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)_340px]">
            <InventoryValuePanel products={topValue} money={preciseMoney} />
            <TopSellersPanel products={topSellers} money={preciseMoney} />
            <StockHealthPanel health={health} total={metrics.length} units={totals.units} />
          </section>

          <section id="inventory-table" className={`${PANEL} overflow-hidden`}>
            <div className="flex flex-col gap-4 border-b border-[color:var(--border)] p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[16px] font-semibold">Inventory Register</p>
                <p className="mt-1 text-[11px] text-[color:var(--text-tertiary)]">
                  Stock levels, product economics and replenishment status.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="flex h-10 w-full min-w-[280px] items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3">
                  <SearchIcon />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search SKU, item or supplier..."
                    className="w-full bg-transparent text-xs text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
                  />
                </label>

                <select
                  value={supplierFilter}
                  onChange={(event) => {
                    setSupplierFilter(event.target.value);
                    setPage(1);
                  }}
                  className="h-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 text-xs text-[color:var(--text-secondary)] outline-none"
                >
                  <option value="">All suppliers</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier} value={supplier}>
                      {supplier}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={exportInventory}
                  disabled={filtered.length === 0}
                  className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-xs text-[color:var(--text-secondary)] transition hover:border-[color:var(--border)] hover:text-[color:var(--text-primary)] disabled:opacity-35"
                >
                  <DownloadIcon /> Export
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-6 border-b border-[color:var(--border)] px-5 py-4">
              {(
                [
                  ["all", "All"],
                  ["in_stock", "In Stock"],
                  ["low_stock", "Low Stock"],
                  ["out_of_stock", "Out of Stock"],
                ] as [StockFilter, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setStockFilter(value);
                    setPage(1);
                  }}
                  className={`relative pb-2 text-xs transition ${
                    stockFilter === value
                      ? "text-[color:var(--primary)]"
                      : "text-[color:var(--text-tertiary)] hover:text-[color:var(--text-secondary)]"
                  }`}
                >
                  {label}
                  {stockFilter === value && (
                    <span className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-[color:var(--primary)]" />
                  )}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] border-collapse text-left">
                <thead className="bg-[color:var(--surface-soft)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">
                  <tr className="border-b border-[color:var(--border)]">
                    <th className="px-5 py-4">SKU</th>
                    <th className="px-5 py-4">Product</th>
                    <th className="px-5 py-4">Supplier</th>
                    <th className="px-5 py-4">Unit Cost</th>
                    <th className="px-5 py-4">Selling Price</th>
                    <th className="px-5 py-4">Bought</th>
                    <th className="px-5 py-4">Sold</th>
                    <th className="px-5 py-4">On Hand</th>
                    <th className="px-5 py-4">Inventory Value</th>
                    <th className="px-5 py-4">Profit Potential</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.length > 0 ? (
                    visibleProducts.map((item) => (
                      <tr
                        key={item.product.id}
                        className="border-b border-[color:var(--border)] text-[12px] last:border-b-0 hover:bg-[color:var(--surface-soft)]"
                      >
                        <td className="px-5 py-4 text-[color:var(--text-tertiary)]">{item.sku}</td>
                        <td className="px-5 py-4">
                          <p className="font-medium text-[color:var(--text-primary)]">{item.name}</p>
                          <p className="mt-1 max-w-[210px] truncate text-[10px] text-[color:var(--text-muted)]">
                            {item.product.notes || "No product notes"}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-[color:var(--text-secondary)]">{item.supplier}</td>
                        <td className="px-5 py-4 text-[color:var(--text-secondary)]">
                          {preciseMoney.format(item.unitCost)}
                        </td>
                        <td className="px-5 py-4 text-[color:var(--primary)]">
                          {preciseMoney.format(item.sellingPrice)}
                        </td>
                        <td className="px-5 py-4 text-[color:var(--text-secondary)]">{item.bought}</td>
                        <td className="px-5 py-4 text-[color:var(--text-secondary)]">{item.sold}</td>
                        <td className="px-5 py-4 font-medium text-[color:var(--text-primary)]">
                          {item.onHand}
                        </td>
                        <td className="px-5 py-4 font-medium text-[color:var(--primary)]">
                          {preciseMoney.format(item.inventoryValue)}
                        </td>
                        <td className="px-5 py-4 font-medium text-[color:var(--success)]">
                          {preciseMoney.format(item.potentialProfit)}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => setEditing(item.product)}
                            className="rounded-lg border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-3 py-2 text-[10px] font-medium text-[color:var(--primary)] transition hover:bg-[color:var(--primary-soft)]"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={12} className="px-5 py-16 text-center text-sm text-[color:var(--text-tertiary)]">
                        No matching products found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-[color:var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-[color:var(--text-muted)]">
                Showing {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, filtered.length)} of {filtered.length} products
              </p>
              <div className="flex items-center gap-2">
                <PageButton
                  disabled={safePage <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeftIcon />
                </PageButton>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1).map(
                  (pageNumber) => (
                    <PageButton
                      key={pageNumber}
                      active={safePage === pageNumber}
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </PageButton>
                  )
                )}
                <PageButton
                  disabled={safePage >= totalPages}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                >
                  <ChevronRightIcon />
                </PageButton>
              </div>
            </div>
          </section>

          {adding && (
            <ProductDrawer
              title="Add Product"
              action={addProduct}
              currency={currency}
              onClose={() => setAdding(false)}
            />
          )}
          {editing && (
            <ProductDrawer
              title="Edit Product"
              product={editing}
              action={updateProduct}
              deleteAction={deleteProduct}
              currency={currency}
              onClose={() => setEditing(null)}
              onRequestDelete={(id) => setDeleteProductId(id)}
            />
          )}

          <ConfirmDialog
            open={Boolean(deleteProductId)}
            title="Delete Product"
            description="Are you sure you want to delete this product? This action cannot be undone."
            confirmText="Delete Product"
            cancelText="Cancel"
            onCancel={() => setDeleteProductId(null)}
            onConfirm={() => {
              if (!deleteProductId) return;
              const formData = new FormData();
              formData.append("id", deleteProductId);
              deleteProduct(formData);
              setDeleteProductId(null);
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
  tone,
  icon,
  data,
}: {
  label: string;
  value: string;
  note: string;
  tone: "cyan" | "blue" | "orange" | "green";
  icon: ReactNode;
  data: number[];
}) {
  const toneClass = {
    cyan: "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
    blue: "border-[color:var(--secondary-border)] bg-[color:var(--secondary-soft)] text-[color:var(--secondary)]",
    orange: "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
    green: "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
  }[tone];

  return (
    <div className={`${PANEL} min-h-[225px] p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[color:var(--text-secondary)]">{label}</p>
          <p className="mt-3 text-[25px] font-semibold tracking-[-0.04em]">{value}</p>
          <p className="mt-3 text-[11px] text-[color:var(--text-muted)]">{note}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${toneClass}`}>
          {icon}
        </div>
      </div>
      <MiniBars values={data} tone={tone} />
    </div>
  );
}

function MiniBars({ values, tone }: { values: number[]; tone: "cyan" | "blue" | "orange" | "green" }) {
  const color = {
    cyan: "var(--chart-1)",
    blue: "var(--chart-2)",
    orange: "var(--chart-4)",
    green: "var(--chart-3)",
  }[tone];
  const data = values.length > 0 ? values.slice(-8) : [0];
  const maximum = Math.max(...data, 1);

  return (
    <svg viewBox="0 0 220 72" className="mt-5 h-[72px] w-full" aria-label="Inventory metric">
      {[14, 36, 58].map((y) => (
        <line key={y} x1="0" x2="220" y1={y} y2={y} stroke="var(--chart-grid)" />
      ))}
      {data.map((value, index) => {
        const gap = 5;
        const width = (220 - gap * Math.max(data.length - 1, 0)) / data.length;
        const height = (Number(value || 0) / maximum) * 52;
        return (
          <rect
            key={index}
            x={index * (width + gap)}
            y={62 - height}
            width={width}
            height={Math.max(height, 1)}
            rx="2"
            fill={color}
            opacity="0.8"
          />
        );
      })}
    </svg>
  );
}

function InventoryValuePanel({ products, money }: { products: ProductMetric[]; money: Intl.NumberFormat }) {
  const maximum = Math.max(...products.map((item) => item.inventoryValue), 1);
  return (
    <div className={`${PANEL} p-5`}>
      <p className="text-sm font-semibold">Inventory Value Distribution</p>
      <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">Current stock value by product</p>
      <div className="mt-6 space-y-4">
        {products.map((item) => (
          <div key={item.product.id}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[11px] text-[color:var(--text-secondary)]">{item.name}</p>
                <p className="mt-1 text-[9px] text-[color:var(--text-muted)]">{item.onHand} units on hand</p>
              </div>
              <p className="text-[11px] font-medium text-[color:var(--primary)]">{money.format(item.inventoryValue)}</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color:var(--surface-soft)]">
              <div
                className="h-full rounded-full bg-[image:linear-gradient(90deg,var(--chart-1),var(--chart-2))]"
                style={{ width: `${Math.max((item.inventoryValue / maximum) * 100, 2)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopSellersPanel({ products, money }: { products: ProductMetric[]; money: Intl.NumberFormat }) {
  const maximum = Math.max(...products.map((item) => item.sold), 1);
  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Top Sellers</p>
        <span className="text-[10px] text-[color:var(--primary)]">{products.length}</span>
      </div>
      <div className="mt-6 space-y-5">
        {products.map((item, index) => (
          <div key={item.product.id} className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[11px] font-semibold text-[color:var(--primary)]">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[12px] text-[color:var(--text-secondary)]">{item.name}</p>
                  <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">{item.sold} sold · {item.sku}</p>
                </div>
                <p className="text-[11px] text-[color:var(--success)]">{money.format(item.sold * item.sellingPrice)}</p>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color:var(--surface-soft)]">
                <div
                  className="h-full rounded-full bg-[image:linear-gradient(90deg,var(--chart-3),var(--chart-1))]"
                  style={{ width: `${Math.max((item.sold / maximum) * 100, 2)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StockHealthPanel({
  health,
  total,
  units,
}: {
  health: { healthy: number; low: number; out: number };
  total: number;
  units: number;
}) {
  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Stock Health</p>
        <span className="text-[10px] text-[color:var(--primary)]">{total}</span>
      </div>
      <div className="mt-6 space-y-5">
        <HealthRow label="Healthy" value={health.healthy} total={total} color="bg-[color:var(--success)]" />
        <HealthRow label="Low Stock" value={health.low} total={total} color="bg-[color:var(--warning)]" />
        <HealthRow label="Out of Stock" value={health.out} total={total} color="bg-[color:var(--danger)]" />
      </div>
      <div className="mt-6 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">Units on hand</p>
        <p className="mt-2 text-lg font-semibold text-[color:var(--primary)]">{units.toLocaleString("en-GB")}</p>
      </div>
    </div>
  );
}

function HealthRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-[11px]">
        <span className="text-[color:var(--text-secondary)]">{label}</span>
        <span className="font-medium text-[color:var(--text-primary)]">{value}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color:var(--surface-soft)]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(percentage, value > 0 ? 3 : 0)}%` }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ProductMetric["status"] }) {
  const styles = {
    in_stock: "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
    low_stock: "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
    out_of_stock: "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
  }[status];
  const labels = {
    in_stock: "In stock",
    low_stock: "Low stock",
    out_of_stock: "Out of stock",
  }[status];
  return <span className={`rounded-full border px-3 py-1 text-[10px] ${styles}`}>{labels}</span>;
}

function ProductDrawer({
  title,
  product,
  action,
  deleteAction,
  currency,
  onClose,
  onRequestDelete,
}: {
  title: string;
  product?: Product;
  action: (formData: FormData) => void;
  deleteAction?: (formData: FormData) => void;
  currency: string;
  onClose: () => void;
  onRequestDelete?: (id: string) => void;
}) {
  const [totalCost, setTotalCost] = useState(Number(product?.total_cost || 0));
  const [quantityBought, setQuantityBought] = useState(Number(product?.quantity_bought || 1));
  const [sellingPrice, setSellingPrice] = useState(Number(product?.selling_price || 0));
  const formatter = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const unitCost = quantityBought > 0 ? totalCost / quantityBought : 0;
  const expectedRevenue = sellingPrice * quantityBought;
  const potentialProfit = Math.max(expectedRevenue - totalCost, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[color:var(--overlay-strong)] backdrop-blur-sm">
      <div className="h-full w-full max-w-md overflow-y-auto border-l border-[color:var(--border-brand)] bg-[color:var(--surface)] p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold">{title}</p>
            <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">Product economics calculate live.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--border)] text-[color:var(--text-secondary)]">
            <CloseIcon />
          </button>
        </div>

        <form action={action} className="space-y-4">
          {product && <input type="hidden" name="id" defaultValue={product.id} />}
          <Field name="sku" label="SKU" defaultValue={product?.sku || ""} required />
          <Field name="item_name" label="Item name" defaultValue={product?.item_name || product?.name || ""} required />
          <Field name="supplier" label="Supplier" defaultValue={product?.supplier || ""} />
          <ControlledNumberField name="total_cost" label="Total cost" value={totalCost} min={0} step={0.01} onChange={setTotalCost} />
          <ControlledNumberField name="quantity_bought" label="Quantity bought" value={quantityBought} min={1} step={1} onChange={setQuantityBought} />
          <ControlledNumberField name="selling_price" label="Selling price" value={sellingPrice} min={0} step={0.01} onChange={setSellingPrice} />

          <div className="grid grid-cols-3 gap-3">
            <Preview label="Unit Cost" value={formatter.format(unitCost)} tone="cyan" />
            <Preview label="Revenue" value={formatter.format(expectedRevenue)} tone="blue" />
            <Preview label="Profit" value={formatter.format(potentialProfit)} tone="green" />
          </div>

          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3">
            <p className="text-xs text-[color:var(--text-secondary)]">Quantity sold</p>
            <p className="mt-2 text-sm text-[color:var(--text-primary)]">{Number(product?.quantity_sold || 0)}</p>
            <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">Controlled automatically by Sales.</p>
          </div>

          <Field name="low_stock_limit" label="Low stock limit" type="number" min="0" defaultValue={product?.low_stock_limit || 1} />
          <Field name="delivery_date" label="Delivery date" type="date" defaultValue={product?.delivery_date || ""} />
          <label className="block text-xs text-[color:var(--text-secondary)]">
            Notes
            <textarea
              name="notes"
              defaultValue={product?.notes || ""}
              className="mt-2 min-h-24 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
            />
          </label>
          <button className="w-full rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary)] px-4 py-3 text-sm font-semibold text-[color:var(--text-on-brand)] hover:bg-[color:var(--primary)]">
            Save Product
          </button>
        </form>

        {product && deleteAction && (
          <button
            type="button"
            onClick={() => onRequestDelete?.(product.id)}
            className="mt-4 w-full rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-4 py-3 text-sm font-medium text-[color:var(--danger)]"
          >
            Delete Product
          </button>
        )}
      </div>
    </div>
  );
}

function ControlledNumberField({ name, label, value, min, step, onChange }: { name: string; label: string; value: number; min: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-xs text-[color:var(--text-secondary)]">
      {label}
      <input
        name={name}
        type="number"
        min={min}
        step={step}
        required
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
      />
    </label>
  );
}

function Preview({ label, value, tone }: { label: string; value: string; tone: "cyan" | "blue" | "green" }) {
  const color = { cyan: "text-[color:var(--primary)]", blue: "text-[color:var(--secondary)]", green: "text-[color:var(--success)]" }[tone];
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-3">
      <p className="text-[9px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{label}</p>
      <p className={`mt-2 truncate text-xs font-medium ${color}`}>{value}</p>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  required,
  min,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number;
  required?: boolean;
  min?: string;
}) {
  return (
    <label className="block text-xs text-[color:var(--text-secondary)]">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        min={min}
        step={type === "number" ? "0.01" : undefined}
        className="mt-2 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]"
      />
    </label>
  );
}

function PageButton({ children, active, disabled, onClick }: { children: ReactNode; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs transition disabled:opacity-30 ${
        active
          ? "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
          : "border-[color:var(--border)] text-[color:var(--text-tertiary)] hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--text-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

function getUnitCost(product: Product) {
  const saved = Number(product.price_per_piece || 0);
  const total = Number(product.total_cost || 0);
  const bought = Number(product.quantity_bought || 0);
  if (saved > 0) return saved;
  if (total > 0 && bought > 0) return total / bought;
  return 0;
}

function SvgIcon({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function PlusIcon() { return <SvgIcon><path d="M12 5v14M5 12h14" /></SvgIcon>; }
function ValueIcon() { return <SvgIcon size={19}><path d="M4 7h16v12H4z" /><path d="M8 11h8M8 15h4" /></SvgIcon>; }
function ProductsIcon() { return <SvgIcon size={19}><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" /><path d="m4 12 8 4.5 8-4.5M4 16.5l8 4.5 8-4.5" /></SvgIcon>; }
function AlertIcon() { return <SvgIcon size={19}><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 9v5M12 17h.01" /></SvgIcon>; }
function ProfitIcon() { return <SvgIcon size={19}><path d="M4 17 9 12l4 4 7-9" /><path d="M15 7h5v5" /></SvgIcon>; }
function SearchIcon() { return <SvgIcon size={15}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></SvgIcon>; }
function DownloadIcon() { return <SvgIcon size={15}><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></SvgIcon>; }
function ChevronLeftIcon() { return <SvgIcon size={14}><path d="m15 18-6-6 6-6" /></SvgIcon>; }
function ChevronRightIcon() { return <SvgIcon size={14}><path d="m9 18 6-6-6-6" /></SvgIcon>; }
function CloseIcon() { return <SvgIcon size={17}><path d="m6 6 12 12M18 6 6 18" /></SvgIcon>; }