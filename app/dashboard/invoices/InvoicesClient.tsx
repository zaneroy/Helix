"use client";

import {
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import ImportButton from "@/components/import-export/ImportButton";
import type { ImportHandler } from "@/lib/import-export/parser/importRunner";
import type {
  Invoice,
  InvoiceAccount,
  InvoiceCustomer,
  InvoiceProduct,
  ImportedInvoiceRow,
} from "./page";

type ServerAction = (formData: FormData) => void;

type Props = {
  companyName: string;
  currency: string;
  customers: InvoiceCustomer[];
  products: InvoiceProduct[];
  accounts: InvoiceAccount[];
  invoices: Invoice[];
  error?: string;
  success?: string;
  createInvoice: ServerAction;
  importInvoices: (
    rows: ImportedInvoiceRow[]
  ) => Promise<{
    imported: number;
    failed: number;
    skipped: number;
  }>;
  updateInvoice: ServerAction;
  markInvoiceSent: ServerAction;
  cancelInvoice: ServerAction;
  restoreInvoice: ServerAction;
  deleteInvoice: ServerAction;
  duplicateInvoice: ServerAction;
  recordPayment: ServerAction;
};

type Filter =
  | "all"
  | "draft"
  | "sent"
  | "viewed"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";

type EditableLine = {
  key: string;
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRate: number;
};

const PANEL =
  "rounded-2xl border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]";
const INPUT =
  "h-11 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 text-sm text-[color:var(--text-primary)] outline-none transition placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--border-brand)] focus:bg-[color:var(--surface-soft)]";
const TEXTAREA =
  "min-h-24 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-3 text-sm text-[color:var(--text-primary)] outline-none transition placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--border-brand)] focus:bg-[color:var(--surface-soft)]";
const PRIMARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary)] px-5 text-sm font-semibold text-[color:var(--text-on-brand)] transition hover:bg-[color:var(--primary)] disabled:cursor-not-allowed disabled:opacity-40";
const SECONDARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-xs text-[color:var(--text-secondary)] transition hover:border-[color:var(--border)] hover:text-[color:var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-35";

export default function InvoicesClient({
  companyName,
  currency,
  customers,
  products,
  accounts,
  invoices,
  error,
  success,
  createInvoice,
  importInvoices,
  updateInvoice,
  markInvoiceSent,
  cancelInvoice,
  restoreInvoice,
  deleteInvoice,
  duplicateInvoice,
  recordPayment,
}: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    action: ServerAction;
    invoiceId: string;
    confirmText: string;
    danger?: boolean;
  } | null>(null);

  const router = useRouter();

  const invoicesImportHandler: ImportHandler = async (rows) => {
    const result = await importInvoices(
      rows as ImportedInvoiceRow[]
    );

    router.refresh();

    return result;
  };

  const pageSize = 8;
  const today = startOfDay(new Date());

  const summary = useMemo(() => {
    const active = invoices.filter(
      (invoice) => invoice.status !== "cancelled"
    );
    const totalValue = active.reduce(
      (sum, invoice) => sum + invoice.totalAmount,
      0
    );
    const outstanding = active.reduce(
      (sum, invoice) => sum + invoice.balanceDue,
      0
    );
    const paid = active.reduce(
      (sum, invoice) => sum + invoice.paidAmount,
      0
    );
    const overdue = active
      .filter(
        (invoice) =>
          invoice.balanceDue > 0 &&
          (invoice.status === "overdue" ||
            startOfDay(new Date(invoice.dueDate)) < today)
      )
      .reduce((sum, invoice) => sum + invoice.balanceDue, 0);

    return {
      count: active.length,
      totalValue,
      outstanding,
      paid,
      overdue,
    };
  }, [invoices, today]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const matchesFilter =
        filter === "all" || invoice.status === filter;
      const matchesSearch =
        !query ||
        [
          invoice.invoiceNumber,
          invoice.customerName,
          invoice.customerCompany,
          invoice.customerEmail,
          invoice.status,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query)
        );

      return matchesFilter && matchesSearch;
    });
  }, [invoices, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleInvoices = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const trend = useMemo(() => buildTrend(invoices), [invoices]);

  const topCustomers = useMemo(() => {
    const totals = new Map<
      string,
      { name: string; count: number; total: number; balance: number }
    >();

    for (const invoice of invoices) {
      if (invoice.status === "cancelled") continue;
      const current = totals.get(invoice.customerId) || {
        name: invoice.customerName,
        count: 0,
        total: 0,
        balance: 0,
      };
      current.count += 1;
      current.total += invoice.totalAmount;
      current.balance += invoice.balanceDue;
      totals.set(invoice.customerId, current);
    }

    return Array.from(totals.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [invoices]);

  function exportInvoices() {
    const rows = filtered.map((invoice) => [
      invoice.invoiceNumber,
      invoice.customerName,
      invoice.customerCompany || "",
      invoice.issueDate,
      invoice.dueDate,
      invoice.status,
      invoice.currency,
      invoice.subtotal.toFixed(2),
      invoice.taxAmount.toFixed(2),
      invoice.discountAmount.toFixed(2),
      invoice.totalAmount.toFixed(2),
      invoice.paidAmount.toFixed(2),
      invoice.balanceDue.toFixed(2),
    ]);

    downloadCsv(
      `helix-invoices-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Invoice Number",
        "Customer",
        "Company",
        "Issue Date",
        "Due Date",
        "Status",
        "Currency",
        "Subtotal",
        "Tax",
        "Discount",
        "Total",
        "Paid",
        "Balance",
      ],
      rows
    );
  }

  return (
    <main className="min-h-screen bg-[color:var(--app-bg)] text-[color:var(--text-primary)]">
      <div className="mx-auto w-full max-w-[1680px] space-y-6 pb-14">
        <header className="space-y-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-[color:var(--primary)]">
              Revenue & receivables
            </p>
            <h1 className="mt-2 text-[32px] font-semibold leading-none tracking-[-0.045em]">
              Invoices
            </h1>
            <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[color:var(--text-tertiary)]">
              Control billing, collections and customer balances for{" "}
              {companyName}. Every payment posts into the selected financial
              account and cash ledger.
            </p>
          </div>

          <div className="flex w-full items-center justify-end gap-3 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={exportInvoices}
              className="inline-flex h-11 w-[132px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-sm font-semibold text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-brand)] hover:text-[color:var(--text-primary)]"
            >
              <DownloadIcon />
              Export
            </button>

            <div className="w-[190px] shrink-0 [&>button]:h-11 [&>button]:w-full [&>button]:justify-center [&>button]:whitespace-nowrap [&>button]:px-4 [&>button]:text-sm [&>button]:font-semibold">
              <ImportButton
                module="invoices"
                importer={invoicesImportHandler}
              />
            </div>

            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex h-11 w-[170px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary)] px-4 text-sm font-semibold text-[color:var(--text-on-brand)] transition hover:bg-[color:var(--primary)]"
            >
              <PlusIcon />
              New Invoice
            </button>
          </div>
        </header>

        {error && <Alert tone="error">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        {customers.length === 0 && (
          <Alert tone="warning">
            Add at least one customer before creating an invoice.
          </Alert>
        )}

        <section className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
          <MetricCard
            label="Total Invoiced"
            value={formatMoney(summary.totalValue, currency)}
            note={`${summary.count} active invoices`}
            tone="cyan"
            icon={<InvoiceIcon />}
            data={invoices.map((invoice) => invoice.totalAmount)}
          />
          <MetricCard
            label="Outstanding"
            value={formatMoney(summary.outstanding, currency)}
            note="Open receivables"
            tone="amber"
            icon={<ClockIcon />}
            data={invoices.map((invoice) => invoice.balanceDue)}
          />
          <MetricCard
            label="Collected"
            value={formatMoney(summary.paid, currency)}
            note="Payments recorded"
            tone="green"
            icon={<CheckIcon />}
            data={invoices.map((invoice) => invoice.paidAmount)}
          />
          <MetricCard
            label="Overdue"
            value={formatMoney(summary.overdue, currency)}
            note={
              summary.overdue > 0
                ? "Requires collection attention"
                : "No overdue balance"
            }
            tone="red"
            icon={<AlertIcon />}
            data={invoices
              .filter((invoice) => invoice.status === "overdue")
              .map((invoice) => invoice.balanceDue)}
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.55fr)]">
          <ReceivablesChart
            trend={trend}
            currency={currency}
          />
          <CollectionHealth
            invoices={invoices}
            currency={currency}
          />
        </section>

        <section className={`${PANEL} p-5`}>
          <div className="text-sm font-semibold">Invoice Actions</div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <ActionTile
              title="Create Invoice"
              description="Bill a customer with products or custom line items"
              icon={<PlusIcon />}
              tone="cyan"
              onClick={() => setCreateOpen(true)}
            />
            <ActionTile
              title="Collect Outstanding"
              description={`${formatMoney(
                summary.outstanding,
                currency
              )} awaiting payment`}
              icon={<WalletIcon />}
              tone="green"
              onClick={() => {
                setFilter("sent");
                setPage(1);
                document
                  .getElementById("invoice-register")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            />
            <ActionTile
              title="Review Overdue"
              description={`${formatMoney(
                summary.overdue,
                currency
              )} overdue`}
              icon={<AlertIcon />}
              tone="red"
              onClick={() => {
                setFilter("overdue");
                setPage(1);
                document
                  .getElementById("invoice-register")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            />
          </div>
        </section>

        <section
          id="invoice-register"
          className={`${PANEL} overflow-hidden`}
        >
          <div className="flex flex-col gap-4 border-b border-[color:var(--border)] p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[16px] font-semibold">Invoice Register</p>
              <p className="mt-1 text-[11px] text-[color:var(--text-tertiary)]">
                Complete billing history, status and collection progress.
              </p>
            </div>

            <label className="flex h-10 w-full items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 lg:max-w-[390px]">
              <SearchIcon />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search invoice, customer or status..."
                className="w-full bg-transparent text-xs text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
              />
            </label>
          </div>

          <div className="flex gap-6 overflow-x-auto border-b border-[color:var(--border)] px-5 py-4">
            {(
              [
                ["all", "All"],
                ["draft", "Draft"],
                ["sent", "Sent"],
                ["viewed", "Viewed"],
                ["partially_paid", "Partial"],
                ["paid", "Paid"],
                ["overdue", "Overdue"],
                ["cancelled", "Cancelled"],
              ] as [Filter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setFilter(value);
                  setPage(1);
                }}
                className={`relative shrink-0 pb-2 text-xs transition ${
                  filter === value
                    ? "text-[color:var(--primary)]"
                    : "text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)]"
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
            <table className="w-full min-w-[1320px] border-collapse text-left">
              <thead className="bg-[color:var(--surface-soft)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">
                <tr className="border-b border-[color:var(--border)]">
                  <th className="px-5 py-4">Invoice</th>
                  <th className="px-5 py-4">Customer</th>
                  <th className="px-5 py-4">Issued</th>
                  <th className="px-5 py-4">Due</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Total</th>
                  <th className="px-5 py-4">Paid</th>
                  <th className="px-5 py-4">Balance</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleInvoices.length > 0 ? (
                  visibleInvoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b border-[color:var(--border)] text-[12px] last:border-b-0 hover:bg-[color:var(--surface-soft)]"
                    >
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => setViewing(invoice)}
                          className="font-semibold text-[color:var(--primary)] hover:text-[color:var(--primary)]"
                        >
                          {invoice.invoiceNumber}
                        </button>
                        <p className="mt-1 text-[9px] text-[color:var(--text-muted)]">
                          {invoice.items.length} line item
                          {invoice.items.length === 1 ? "" : "s"}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-[color:var(--text-primary)]">
                          {invoice.customerName}
                        </p>
                        <p className="mt-1 max-w-[210px] truncate text-[9px] text-[color:var(--text-muted)]">
                          {invoice.customerCompany ||
                            invoice.customerEmail ||
                            "Customer"}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-[color:var(--text-secondary)]">
                        {formatDate(invoice.issueDate)}
                      </td>
                      <td className="px-5 py-4">
                        <DueDate invoice={invoice} />
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill status={invoice.status} />
                      </td>
                      <td className="px-5 py-4 font-medium text-[color:var(--text-primary)]">
                        {formatMoney(
                          invoice.totalAmount,
                          invoice.currency
                        )}
                      </td>
                      <td className="px-5 py-4 text-[color:var(--success)]">
                        {formatMoney(
                          invoice.paidAmount,
                          invoice.currency
                        )}
                      </td>
                      <td className="px-5 py-4 font-semibold text-[color:var(--warning)]">
                        {formatMoney(
                          invoice.balanceDue,
                          invoice.currency
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setViewing(invoice)}
                            className={smallButton()}
                          >
                            View
                          </button>
                          {invoice.balanceDue > 0 &&
                            !["draft", "cancelled"].includes(
                              invoice.status
                            ) && (
                              <button
                                type="button"
                                onClick={() => setPaying(invoice)}
                                className={smallButton("green")}
                              >
                                Pay
                              </button>
                            )}
                          <button
                            type="button"
                            onClick={() =>
                              setEditing(invoice)
                            }
                            disabled={
                              invoice.paidAmount > 0 ||
                              ["paid", "cancelled"].includes(
                                invoice.status
                              )
                            }
                            className={smallButton("cyan")}
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-20 text-center"
                    >
                      <p className="text-sm text-[color:var(--text-tertiary)]">
                        No matching invoices found.
                      </p>
                      <button
                        type="button"
                        onClick={() => setCreateOpen(true)}
                        className="mt-4 text-xs font-medium text-[color:var(--primary)] hover:text-[color:var(--primary)]"
                      >
                        Create the first invoice
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-[color:var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-[color:var(--text-muted)]">
              Showing{" "}
              {filtered.length === 0
                ? 0
                : (safePage - 1) * pageSize + 1}
              –{Math.min(safePage * pageSize, filtered.length)} of{" "}
              {filtered.length} invoices
            </p>
            <div className="flex items-center gap-2">
              <PageButton
                disabled={safePage === 1}
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
                disabled={safePage === totalPages}
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

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <TopCustomers
            customers={topCustomers}
            currency={currency}
          />
          <AccountCollectionPanel
            accounts={accounts}
            currency={currency}
          />
        </section>
      </div>

      {createOpen && (
        <InvoiceEditor
          title="Create Invoice"
          customers={customers}
          products={products}
          currency={currency}
          action={createInvoice}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {editing && (
        <InvoiceEditor
          title={`Edit ${editing.invoiceNumber}`}
          customers={customers}
          products={products}
          currency={editing.currency}
          invoice={editing}
          action={updateInvoice}
          onClose={() => setEditing(null)}
        />
      )}

      {viewing && (
        <InvoiceDetail
          invoice={viewing}
          companyName={companyName}
          accounts={accounts}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewing);
            setViewing(null);
          }}
          onPayment={() => {
            setPaying(viewing);
            setViewing(null);
          }}
          onMarkSent={() =>
            submitAction(markInvoiceSent, viewing.id)
          }
          onDuplicate={() =>
            submitAction(duplicateInvoice, viewing.id)
          }
          onCancel={() => {
            setConfirm({
              title: "Cancel Invoice",
              description: `Cancel ${viewing.invoiceNumber}? It will no longer be collectible.`,
              action: cancelInvoice,
              invoiceId: viewing.id,
              confirmText: "Cancel Invoice",
              danger: true,
            });
            setViewing(null);
          }}
          onRestore={() =>
            submitAction(restoreInvoice, viewing.id)
          }
          onDelete={() => {
            setConfirm({
              title: "Delete Invoice",
              description: `Permanently delete ${viewing.invoiceNumber}? This action cannot be undone.`,
              action: deleteInvoice,
              invoiceId: viewing.id,
              confirmText: "Delete Invoice",
              danger: true,
            });
            setViewing(null);
          }}
        />
      )}

      {paying && (
        <PaymentDrawer
          invoice={paying}
          accounts={accounts}
          action={recordPayment}
          onClose={() => setPaying(null)}
        />
      )}

      {confirm && (
        <ConfirmationModal
          {...confirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </main>
  );
}

function InvoiceEditor({
  title,
  customers,
  products,
  currency,
  invoice,
  action,
  onClose,
}: {
  title: string;
  customers: InvoiceCustomer[];
  products: InvoiceProduct[];
  currency: string;
  invoice?: Invoice;
  action: ServerAction;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<EditableLine[]>(
    invoice?.items.length
      ? invoice.items.map((item) => ({
          key: item.id,
          productId: item.productId || "",
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
          taxRate: item.taxRate,
        }))
      : [newLine()]
  );
  const [discount, setDiscount] = useState(
    invoice?.discountAmount || 0
  );

  const totals = useMemo(() => calculateTotals(lines, discount), [
    lines,
    discount,
  ]);

  function updateLine(
    key: string,
    patch: Partial<EditableLine>
  ) {
    setLines((current) =>
      current.map((line) =>
        line.key === key ? { ...line, ...patch } : line
      )
    );
  }

  function selectProduct(key: string, productId: string) {
    const product = products.find((row) => row.id === productId);
    updateLine(key, {
      productId,
      description: product?.name || "",
      unitPrice: product?.sellingPrice || 0,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[color:var(--overlay-strong)] backdrop-blur-sm">
      <div className="h-full w-full max-w-5xl overflow-y-auto border-l border-[color:var(--border-brand)] bg-[color:var(--surface)] shadow-2xl shadow-[var(--shadow-card)]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[color:var(--border)] bg-[color:var(--surface-soft)] px-6 py-5 backdrop-blur-xl">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
              Build a professional invoice with live tax, discount and
              balance calculations.
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

        <form action={action} className="space-y-6 p-6">
          {invoice && (
            <input
              type="hidden"
              name="invoice_id"
              value={invoice.id}
            />
          )}
          <input
            type="hidden"
            name="currency"
            value={currency}
          />
          <input
            type="hidden"
            name="items_json"
            value={JSON.stringify(
              lines.map((line) => ({
                productId: line.productId || null,
                description: line.description,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                discountAmount: line.discountAmount,
                taxRate: line.taxRate,
              }))
            )}
          />

          <section className={`${PANEL} p-5`}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FormSelect
                name="customer_id"
                label="Customer"
                defaultValue={invoice?.customerId || ""}
                required
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.companyName
                      ? ` · ${customer.companyName}`
                      : ""}
                  </option>
                ))}
              </FormSelect>

              <FormInput
                name="issue_date"
                label="Issue date"
                type="date"
                defaultValue={
                  invoice?.issueDate ||
                  new Date().toISOString().slice(0, 10)
                }
                required
              />

              <FormInput
                name="due_date"
                label="Due date"
                type="date"
                defaultValue={
                  invoice?.dueDate || addDaysIso(30)
                }
                required
              />

              <FormSelect
                name="payment_terms"
                label="Payment terms"
                defaultValue={invoice?.paymentTerms || "Net 30"}
              >
                <option value="Due on receipt">
                  Due on receipt
                </option>
                <option value="Net 7">Net 7</option>
                <option value="Net 14">Net 14</option>
                <option value="Net 30">Net 30</option>
                <option value="Net 45">Net 45</option>
                <option value="Net 60">Net 60</option>
              </FormSelect>
            </div>
          </section>

          <section className={`${PANEL} overflow-hidden`}>
            <div className="flex items-center justify-between gap-4 border-b border-[color:var(--border)] px-5 py-4">
              <div>
                <p className="text-sm font-semibold">Line Items</p>
                <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">
                  Products or custom services
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setLines((current) => [...current, newLine()])
                }
                className={SECONDARY}
              >
                <PlusIcon />
                Add Line
              </button>
            </div>

            <div className="space-y-4 p-5">
              {lines.map((line, index) => {
                const lineTotals = calculateLine(line);

                return (
                  <div
                    key={line.key}
                    className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
                        Line {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setLines((current) =>
                            current.length === 1
                              ? current
                              : current.filter(
                                  (row) => row.key !== line.key
                                )
                          )
                        }
                        disabled={lines.length === 1}
                        className="text-[10px] text-[color:var(--danger)] hover:text-[color:var(--danger)] disabled:opacity-25"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1.15fr_1.55fr_0.55fr_0.75fr_0.65fr_0.55fr_0.75fr]">
                      <EditorField label="Product">
                        <select
                          value={line.productId}
                          onChange={(event) =>
                            selectProduct(
                              line.key,
                              event.target.value
                            )
                          }
                          className={INPUT}
                        >
                          <option value="">Custom item</option>
                          {products.map((product) => (
                            <option
                              key={product.id}
                              value={product.id}
                            >
                              {product.name} ·{" "}
                              {formatMoney(
                                product.sellingPrice,
                                currency
                              )}{" "}
                              · {product.availableStock} available
                            </option>
                          ))}
                        </select>
                      </EditorField>

                      <EditorField label="Description">
                        <input
                          value={line.description}
                          onChange={(event) =>
                            updateLine(line.key, {
                              description: event.target.value,
                            })
                          }
                          placeholder="Product or service"
                          className={INPUT}
                        />
                      </EditorField>

                      <EditorField label="Qty">
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={line.quantity}
                          onChange={(event) =>
                            updateLine(line.key, {
                              quantity: numberValue(
                                event.target.value,
                                1
                              ),
                            })
                          }
                          className={INPUT}
                        />
                      </EditorField>

                      <EditorField label="Unit price">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(event) =>
                            updateLine(line.key, {
                              unitPrice: numberValue(
                                event.target.value
                              ),
                            })
                          }
                          className={INPUT}
                        />
                      </EditorField>

                      <EditorField label="Discount">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.discountAmount}
                          onChange={(event) =>
                            updateLine(line.key, {
                              discountAmount: numberValue(
                                event.target.value
                              ),
                            })
                          }
                          className={INPUT}
                        />
                      </EditorField>

                      <EditorField label="Tax %">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.taxRate}
                          onChange={(event) =>
                            updateLine(line.key, {
                              taxRate: numberValue(
                                event.target.value
                              ),
                            })
                          }
                          className={INPUT}
                        />
                      </EditorField>

                      <div>
                        <p className="mb-2 text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
                          Total
                        </p>
                        <div className="flex h-11 items-center rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-3 text-sm font-semibold text-[color:var(--primary)]">
                          {formatMoney(lineTotals.total, currency)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className={`${PANEL} p-5`}>
              <p className="text-sm font-semibold">Invoice Notes</p>
              <div className="mt-4 grid gap-4">
                <FormTextarea
                  name="notes"
                  label="Customer notes"
                  defaultValue={invoice?.notes || ""}
                  placeholder="Thank you for your business..."
                />
                <FormTextarea
                  name="footer_note"
                  label="Footer"
                  defaultValue={invoice?.footerNote || ""}
                  placeholder="Payment details or legal information"
                />
              </div>
            </div>

            <div className={`${PANEL} p-5`}>
              <p className="text-sm font-semibold">Invoice Summary</p>

              <div className="mt-5 space-y-4">
                <SummaryRow
                  label="Line subtotal"
                  value={formatMoney(totals.subtotal, currency)}
                />
                <SummaryRow
                  label="Line discounts"
                  value={`-${formatMoney(
                    totals.lineDiscount,
                    currency
                  )}`}
                />
                <SummaryRow
                  label="Tax"
                  value={formatMoney(totals.tax, currency)}
                />

                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
                    Invoice discount
                  </span>
                  <input
                    name="discount_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(event) =>
                      setDiscount(
                        numberValue(event.target.value)
                      )
                    }
                    className={`${INPUT} mt-2`}
                  />
                </label>

                <div className="border-t border-[color:var(--border)] pt-4">
                  <SummaryRow
                    label="Total"
                    value={formatMoney(totals.total, currency)}
                    strong
                  />
                </div>
              </div>
            </div>
          </section>

          <div className="sticky bottom-0 -mx-6 flex flex-col gap-3 border-t border-[color:var(--border)] bg-[color:var(--surface-soft)] px-6 py-4 backdrop-blur-xl sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className={SECONDARY}
            >
              Cancel
            </button>

            {!invoice && (
              <button
                name="status"
                value="draft"
                disabled={
                  customers.length === 0 ||
                  lines.some(
                    (line) =>
                      !line.description.trim() ||
                      line.quantity <= 0
                  )
                }
                className={SECONDARY}
              >
                Save Draft
              </button>
            )}

            <button
              name={invoice ? undefined : "status"}
              value={invoice ? undefined : "sent"}
              disabled={
                customers.length === 0 ||
                lines.some(
                  (line) =>
                    !line.description.trim() ||
                    line.quantity <= 0
                )
              }
              className={PRIMARY}
            >
              {invoice ? "Save Changes" : "Create & Mark Sent"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InvoiceDetail({
  invoice,
  companyName,
  accounts,
  onClose,
  onEdit,
  onPayment,
  onMarkSent,
  onDuplicate,
  onCancel,
  onRestore,
  onDelete,
}: {
  invoice: Invoice;
  companyName: string;
  accounts: InvoiceAccount[];
  onClose: () => void;
  onEdit: () => void;
  onPayment: () => void;
  onMarkSent: () => void;
  onDuplicate: () => void;
  onCancel: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  function printInvoice() {
    window.print();
  }

  const editable =
    invoice.paidAmount === 0 &&
    !["paid", "cancelled"].includes(invoice.status);
  const canPay =
    invoice.balanceDue > 0 &&
    !["draft", "cancelled"].includes(invoice.status);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[color:var(--overlay-strong)] backdrop-blur-sm">
      <div className="h-full w-full max-w-4xl overflow-y-auto border-l border-[color:var(--border-brand)] bg-[color:var(--surface)] shadow-2xl shadow-[var(--shadow-card)]">
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface-soft)] px-6 py-4 backdrop-blur-xl print:hidden">
          <div>
            <p className="text-lg font-semibold">
              {invoice.invoiceNumber}
            </p>
            <div className="mt-1">
              <StatusPill status={invoice.status} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={printInvoice}
              className={SECONDARY}
            >
              <PrintIcon />
              Print / PDF
            </button>
            <button
              type="button"
              onClick={onDuplicate}
              className={SECONDARY}
            >
              <CopyIcon />
              Duplicate
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--text-primary)]"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <article
          id={`invoice-${invoice.id}`}
          className="m-6 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-7 print:m-0 print:min-h-screen print:rounded-none print:border-0 print:bg-[color:var(--surface)] print:text-[color:var(--text-primary)]"
        >
          <div className="flex flex-col justify-between gap-8 sm:flex-row">
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-[color:var(--primary)] print:text-[color:var(--text-primary)]">
                {companyName}
              </p>
              <h2 className="mt-3 text-4xl font-semibold tracking-[-0.05em]">
                Invoice
              </h2>
              <p className="mt-2 text-sm text-[color:var(--text-tertiary)] print:text-[color:var(--text-primary)]">
                {invoice.invoiceNumber}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <span className="text-[color:var(--text-tertiary)] print:text-[color:var(--text-primary)]">
                Issue date
              </span>
              <span className="text-right">
                {formatDate(invoice.issueDate)}
              </span>
              <span className="text-[color:var(--text-tertiary)] print:text-[color:var(--text-primary)]">
                Due date
              </span>
              <span className="text-right">
                {formatDate(invoice.dueDate)}
              </span>
              <span className="text-[color:var(--text-tertiary)] print:text-[color:var(--text-primary)]">
                Terms
              </span>
              <span className="text-right">
                {invoice.paymentTerms || "—"}
              </span>
            </div>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <InvoiceAddress
              label="Bill to"
              title={invoice.customerName}
              lines={[
                invoice.customerCompany,
                invoice.customerEmail,
              ]}
            />
            <InvoiceAddress
              label="Payment status"
              title={statusLabel(invoice.status)}
              lines={[
                `${formatMoney(
                  invoice.paidAmount,
                  invoice.currency
                )} collected`,
                `${formatMoney(
                  invoice.balanceDue,
                  invoice.currency
                )} outstanding`,
              ]}
            />
          </div>

          <div className="mt-9 overflow-hidden rounded-2xl border border-[color:var(--border)] print:border-[color:var(--border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[color:var(--surface-soft)] text-[10px] uppercase tracking-[0.13em] text-[color:var(--text-tertiary)] print:bg-[color:var(--surface-soft)] print:text-[color:var(--text-primary)]">
                <tr>
                  <th className="px-4 py-4">Description</th>
                  <th className="px-4 py-4 text-right">Qty</th>
                  <th className="px-4 py-4 text-right">Rate</th>
                  <th className="px-4 py-4 text-right">Tax</th>
                  <th className="px-4 py-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-[color:var(--border)] print:border-[color:var(--border)]"
                  >
                    <td className="px-4 py-4">
                      <p className="font-medium">
                        {item.description}
                      </p>
                      {item.discountAmount > 0 && (
                        <p className="mt-1 text-[10px] text-[color:var(--text-tertiary)] print:text-[color:var(--text-primary)]">
                          Discount{" "}
                          {formatMoney(
                            item.discountAmount,
                            invoice.currency
                          )}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {formatMoney(
                        item.unitPrice,
                        invoice.currency
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {item.taxRate.toFixed(2)}%
                    </td>
                    <td className="px-4 py-4 text-right font-medium">
                      {formatMoney(
                        item.lineTotal,
                        invoice.currency
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex justify-end">
            <div className="w-full max-w-sm space-y-3">
              <SummaryRow
                label="Subtotal"
                value={formatMoney(
                  invoice.subtotal,
                  invoice.currency
                )}
              />
              <SummaryRow
                label="Tax"
                value={formatMoney(
                  invoice.taxAmount,
                  invoice.currency
                )}
              />
              <SummaryRow
                label="Discount"
                value={`-${formatMoney(
                  invoice.discountAmount,
                  invoice.currency
                )}`}
              />
              <div className="border-t border-[color:var(--border)] pt-3 print:border-[color:var(--border)]">
                <SummaryRow
                  label="Invoice Total"
                  value={formatMoney(
                    invoice.totalAmount,
                    invoice.currency
                  )}
                  strong
                />
              </div>
              <SummaryRow
                label="Paid"
                value={formatMoney(
                  invoice.paidAmount,
                  invoice.currency
                )}
              />
              <div className="rounded-xl bg-[color:var(--primary-soft)] px-4 py-4 print:border print:border-[color:var(--border)] print:bg-transparent">
                <SummaryRow
                  label="Balance Due"
                  value={formatMoney(
                    invoice.balanceDue,
                    invoice.currency
                  )}
                  strong
                />
              </div>
            </div>
          </div>

          {(invoice.notes || invoice.footerNote) && (
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {invoice.notes && (
                <InvoiceNote
                  label="Notes"
                  text={invoice.notes}
                />
              )}
              {invoice.footerNote && (
                <InvoiceNote
                  label="Payment information"
                  text={invoice.footerNote}
                />
              )}
            </div>
          )}
        </article>

        <div className="space-y-5 px-6 pb-8 print:hidden">
          {invoice.payments.length > 0 && (
            <div className={`${PANEL} p-5`}>
              <p className="text-sm font-semibold">Payment History</p>
              <div className="mt-4 divide-y divide-[color:var(--divider)]">
                {invoice.payments.map((payment) => {
                  const account = accounts.find(
                    (row) => row.id === payment.accountId
                  );
                  return (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between gap-4 py-4"
                    >
                      <div>
                        <p className="text-xs font-medium text-[color:var(--text-secondary)]">
                          {account?.name || "Financial account"}
                        </p>
                        <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">
                          {formatDateTime(payment.paymentDate)}
                          {payment.reference
                            ? ` · ${payment.reference}`
                            : ""}
                        </p>
                      </div>
                      <p className="font-semibold text-[color:var(--success)]">
                        {formatMoney(
                          payment.amount,
                          invoice.currency
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className={`${PANEL} p-5`}>
            <p className="text-sm font-semibold">Actions</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {invoice.status === "draft" && (
                <ActionButton
                  label="Mark Sent"
                  icon={<SendIcon />}
                  onClick={onMarkSent}
                  tone="cyan"
                />
              )}
              {canPay && (
                <ActionButton
                  label="Record Payment"
                  icon={<WalletIcon />}
                  onClick={onPayment}
                  tone="green"
                />
              )}
              {editable && (
                <ActionButton
                  label="Edit Invoice"
                  icon={<EditIcon />}
                  onClick={onEdit}
                  tone="blue"
                />
              )}
              <ActionButton
                label="Duplicate"
                icon={<CopyIcon />}
                onClick={onDuplicate}
                tone="violet"
              />
              {invoice.status === "cancelled" ? (
                <ActionButton
                  label="Restore"
                  icon={<RestoreIcon />}
                  onClick={onRestore}
                  tone="green"
                />
              ) : (
                invoice.paidAmount === 0 &&
                invoice.status !== "paid" && (
                  <ActionButton
                    label="Cancel"
                    icon={<CloseIcon />}
                    onClick={onCancel}
                    tone="red"
                  />
                )
              )}
              {["draft", "cancelled"].includes(invoice.status) &&
                invoice.paidAmount === 0 && (
                  <ActionButton
                    label="Delete"
                    icon={<TrashIcon />}
                    onClick={onDelete}
                    tone="red"
                  />
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentDrawer({
  invoice,
  accounts,
  action,
  onClose,
}: {
  invoice: Invoice;
  accounts: InvoiceAccount[];
  action: ServerAction;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(invoice.balanceDue);
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-[color:var(--overlay-strong)] backdrop-blur-sm">
      <div className="h-full w-full max-w-md overflow-y-auto border-l border-[color:var(--border-brand)] bg-[color:var(--surface)] p-6 shadow-2xl shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-semibold">Record Payment</p>
            <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
              {invoice.invoiceNumber} ·{" "}
              {formatMoney(
                invoice.balanceDue,
                invoice.currency
              )}{" "}
              outstanding
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--border)] text-[color:var(--text-secondary)]"
          >
            <CloseIcon />
          </button>
        </div>

        <form action={action} className="mt-7 space-y-5">
          <input
            type="hidden"
            name="invoice_id"
            value={invoice.id}
          />

          <FormSelect
            name="account_id"
            label="Receiving account"
            value={accountId}
            onChange={(value) => setAccountId(value)}
            required
          >
            <option value="">Select account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ·{" "}
                {formatMoney(account.balance, account.currency)}
              </option>
            ))}
          </FormSelect>

          <label className="block">
            <span className="text-xs text-[color:var(--text-secondary)]">
              Payment amount
            </span>
            <input
              name="amount"
              type="number"
              min="0.01"
              max={invoice.balanceDue}
              step="0.01"
              value={amount}
              onChange={(event) =>
                setAmount(numberValue(event.target.value))
              }
              className={`${INPUT} mt-2`}
              required
            />
          </label>

          <FormInput
            name="payment_date"
            label="Payment date"
            type="datetime-local"
            defaultValue={toLocalDateTime(new Date())}
            required
          />

          <FormSelect
            name="payment_method"
            label="Payment method"
            defaultValue="Bank Transfer"
          >
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="Cheque">Cheque</option>
            <option value="Direct Debit">Direct Debit</option>
            <option value="Other">Other</option>
          </FormSelect>

          <FormInput
            name="reference"
            label="Reference"
            placeholder="Payment reference"
          />

          <FormTextarea
            name="notes"
            label="Notes"
            placeholder="Internal payment notes"
          />

          <div className={`${PANEL} p-4`}>
            <SummaryRow
              label="Balance before"
              value={formatMoney(
                invoice.balanceDue,
                invoice.currency
              )}
            />
            <div className="mt-3">
              <SummaryRow
                label="Balance after"
                value={formatMoney(
                  Math.max(invoice.balanceDue - amount, 0),
                  invoice.currency
                )}
                strong
              />
            </div>
          </div>

          <button
            disabled={
              !accountId ||
              amount <= 0 ||
              amount > invoice.balanceDue
            }
            className={`${PRIMARY} w-full`}
          >
            <WalletIcon />
            Record Payment
          </button>
        </form>
      </div>
    </div>
  );
}

function ConfirmationModal({
  title,
  description,
  action,
  invoiceId,
  confirmText,
  danger,
  onClose,
}: {
  title: string;
  description: string;
  action: ServerAction;
  invoiceId: string;
  confirmText: string;
  danger?: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[color:var(--overlay-strong)] p-4 backdrop-blur-sm">
      <div className={`${PANEL} w-full max-w-md p-6`}>
        <p className="text-lg font-semibold">{title}</p>
        <p className="mt-3 text-sm leading-6 text-[color:var(--text-tertiary)]">
          {description}
        </p>

        <form action={action} className="mt-6 flex justify-end gap-3">
          <input
            type="hidden"
            name="invoice_id"
            value={invoiceId}
          />
          <button
            type="button"
            onClick={onClose}
            className={SECONDARY}
          >
            Keep Invoice
          </button>
          <button
            className={`inline-flex h-10 items-center justify-center rounded-xl border px-4 text-xs font-semibold ${
              danger
                ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)] hover:bg-[color:var(--danger-soft)]"
                : "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
            }`}
          >
            {confirmText}
          </button>
        </form>
      </div>
    </div>
  );
}

function ReceivablesChart({
  trend,
  currency,
}: {
  trend: {
    label: string;
    invoiced: number;
    collected: number;
    outstanding: number;
  }[];
  currency: string;
}) {
  const width = 900;
  const height = 300;
  const left = 58;
  const right = 18;
  const top = 25;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const max = Math.max(
    ...trend.flatMap((row) => [
      row.invoiced,
      row.collected,
      row.outstanding,
    ]),
    1
  );

  const path = (key: "invoiced" | "collected" | "outstanding") =>
    trend
      .map((row, index) => {
        const x =
          trend.length === 1
            ? left + plotWidth / 2
            : left + (index / (trend.length - 1)) * plotWidth;
        const y =
          top + plotHeight - (row[key] / max) * plotHeight;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(
          1
        )} ${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-semibold">
            Receivables Performance
          </p>
          <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">
            Invoiced, collected and outstanding value
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-[10px] text-[color:var(--text-tertiary)]">
          <Legend color="var(--chart-1)" label="Invoiced" />
          <Legend color="var(--chart-3)" label="Collected" />
          <Legend color="var(--chart-4)" label="Outstanding" />
        </div>
      </div>

      {trend.length ? (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mt-5 h-[300px] w-full"
        >
          {[0, 1, 2, 3, 4].map((index) => {
            const y = top + (index / 4) * plotHeight;
            const value = max - (index / 4) * max;
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
            d={path("invoiced")}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={path("collected")}
            fill="none"
            stroke="var(--chart-3)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={path("outstanding")}
            fill="none"
            stroke="var(--chart-4)"
            strokeWidth="2.5"
            strokeDasharray="7 7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {trend.map((row, index) => {
            const x =
              trend.length === 1
                ? left + plotWidth / 2
                : left + (index / (trend.length - 1)) * plotWidth;
            return (
              <text
                key={`${row.label}-${index}`}
                x={x}
                y={height - 12}
                textAnchor="middle"
                fill="var(--chart-label)"
                fontSize="9"
              >
                {row.label}
              </text>
            );
          })}
        </svg>
      ) : (
        <EmptyState text="Invoice activity will appear here." />
      )}
    </div>
  );
}

function CollectionHealth({
  invoices,
  currency,
}: {
  invoices: Invoice[];
  currency: string;
}) {
  const collectible = invoices.filter(
    (invoice) => invoice.status !== "cancelled"
  );
  const total = collectible.reduce(
    (sum, invoice) => sum + invoice.totalAmount,
    0
  );
  const paid = collectible.reduce(
    (sum, invoice) => sum + invoice.paidAmount,
    0
  );
  const rate = total > 0 ? (paid / total) * 100 : 0;
  const overdueCount = collectible.filter(
    (invoice) =>
      invoice.status === "overdue" && invoice.balanceDue > 0
  ).length;
  const averageDays = averageCollectionDays(collectible);

  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold">Collection Health</p>
          <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">
            Billing efficiency and risk
          </p>
        </div>
        <span className="text-xs font-semibold text-[color:var(--primary)]">
          {rate.toFixed(1)}%
        </span>
      </div>

      <div className="mt-7 flex justify-center">
        <ProgressRing
          percentage={rate}
          label="Collected"
        />
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
        <MiniStat
          label="Collected"
          value={formatMoney(paid, currency)}
          tone="green"
        />
        <MiniStat
          label="Overdue invoices"
          value={String(overdueCount)}
          tone="red"
        />
        <MiniStat
          label="Average collection"
          value={
            averageDays === null ? "No data" : `${averageDays} days`
          }
          tone="cyan"
        />
      </div>
    </div>
  );
}

function TopCustomers({
  customers,
  currency,
}: {
  customers: {
    name: string;
    count: number;
    total: number;
    balance: number;
  }[];
  currency: string;
}) {
  const max = Math.max(...customers.map((row) => row.total), 1);

  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">
            Highest-Value Customers
          </p>
          <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">
            Ranked by invoiced value
          </p>
        </div>
        <span className="text-[10px] text-[color:var(--primary)]">
          {customers.length}
        </span>
      </div>

      <div className="mt-5 space-y-5">
        {customers.length ? (
          customers.map((customer, index) => (
            <div key={`${customer.name}-${index}`}>
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--primary-soft)] text-xs font-semibold text-[color:var(--primary)]">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="truncate text-xs font-medium text-[color:var(--text-secondary)]">
                        {customer.name}
                      </p>
                      <p className="mt-1 text-[9px] text-[color:var(--text-muted)]">
                        {customer.count} invoice
                        {customer.count === 1 ? "" : "s"} ·{" "}
                        {formatMoney(customer.balance, currency)} due
                      </p>
                    </div>
                    <p className="shrink-0 text-xs font-semibold text-[color:var(--primary)]">
                      {formatMoney(customer.total, currency)}
                    </p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--surface-soft)]">
                    <div
                      className="h-full rounded-full bg-[image:linear-gradient(90deg,var(--chart-1),var(--chart-3))]"
                      style={{
                        width: `${Math.max(
                          (customer.total / max) * 100,
                          2
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <EmptyState text="Customer rankings will appear after invoices are created." />
        )}
      </div>
    </div>
  );
}

function AccountCollectionPanel({
  accounts,
  currency,
}: {
  accounts: InvoiceAccount[];
  currency: string;
}) {
  const total = accounts.reduce(
    (sum, account) => sum + account.balance,
    0
  );

  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">
            Receiving Accounts
          </p>
          <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">
            Available destinations for invoice payments
          </p>
        </div>
        <span className="text-[10px] text-[color:var(--primary)]">
          {accounts.length}
        </span>
      </div>

      <div className="mt-5 divide-y divide-[color:var(--divider)]">
        {accounts.length ? (
          accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center gap-3 py-4"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
                <BankIcon />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[color:var(--text-secondary)]">
                  {account.name}
                </p>
                <p className="mt-1 text-[9px] capitalize text-[color:var(--text-muted)]">
                  {account.accountType.replaceAll("_", " ")} ·{" "}
                  {account.currency}
                </p>
              </div>
              <p className="text-xs font-semibold text-[color:var(--text-primary)]">
                {formatMoney(account.balance, account.currency)}
              </p>
            </div>
          ))
        ) : (
          <EmptyState text="Create an active financial account before recording payments." />
        )}
      </div>

      <div className="mt-4 flex justify-between border-t border-[color:var(--border)] pt-4">
        <span className="text-sm font-semibold text-[color:var(--primary)]">
          Total cash
        </span>
        <span className="text-lg font-semibold text-[color:var(--primary)]">
          {formatMoney(total, currency)}
        </span>
      </div>
    </div>
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
  tone: "cyan" | "amber" | "green" | "red";
  icon: ReactNode;
  data: number[];
}) {
  const styles = {
    cyan: {
      box: "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
      line: "var(--chart-1)",
    },
    amber: {
      box: "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
      line: "var(--chart-4)",
    },
    green: {
      box: "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
      line: "var(--chart-3)",
    },
    red: {
      box: "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
      line: "var(--chart-6)",
    },
  }[tone];

  return (
    <div className={`${PANEL} min-h-[235px] p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-[color:var(--text-secondary)]">{label}</p>
          <p className="mt-3 truncate text-[26px] font-semibold tracking-[-0.04em]">
            {value}
          </p>
          <p className="mt-3 text-[11px] text-[color:var(--text-muted)]">{note}</p>
        </div>
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl border ${styles.box}`}
        >
          {icon}
        </span>
      </div>
      <MiniChart data={data} color={styles.line} />
    </div>
  );
}

function MiniChart({
  data,
  color,
}: {
  data: number[];
  color: string;
}) {
  const values = data.length ? data.slice(-9) : [0];
  const max = Math.max(...values, 1);
  const width = 230;
  const height = 75;
  const points = values
    .map((value, index) => {
      const x =
        values.length === 1
          ? width / 2
          : (index / (values.length - 1)) * width;
      const y = 62 - (value / max) * 48;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-5 h-[75px] w-full"
    >
      {[18, 40, 62].map((y) => (
        <line
          key={y}
          x1="0"
          x2={width}
          y1={y}
          y2={y}
          stroke="var(--chart-grid)"
        />
      ))}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProgressRing({
  percentage,
  label,
}: {
  percentage: number;
  label: string;
}) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const offset =
    circumference -
    (Math.min(Math.max(percentage, 0), 100) / 100) *
      circumference;

  return (
    <div className="relative h-40 w-40">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="var(--chart-grid)"
          strokeWidth="12"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold">
          {percentage.toFixed(0)}%
        </span>
        <span className="mt-1 text-[9px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
          {label}
        </span>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Invoice["status"] }) {
  const style = {
    draft: "border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)]",
    sent: "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
    viewed: "border-[color:var(--secondary-border)] bg-[color:var(--secondary-soft)] text-[color:var(--secondary)]",
    partially_paid:
      "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
    paid:
      "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
    overdue: "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
    cancelled:
      "border-[color:var(--violet-border)] bg-[color:var(--violet-soft)] text-[color:var(--chart-5)]",
  }[status];

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[9px] font-medium uppercase tracking-[0.08em] ${style}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function DueDate({ invoice }: { invoice: Invoice }) {
  const overdue =
    invoice.balanceDue > 0 &&
    invoice.status !== "cancelled" &&
    startOfDay(new Date(invoice.dueDate)) < startOfDay(new Date());

  return (
    <div>
      <p className={overdue ? "text-[color:var(--danger)]" : "text-[color:var(--text-secondary)]"}>
        {formatDate(invoice.dueDate)}
      </p>
      {invoice.balanceDue > 0 && (
        <p
          className={`mt-1 text-[9px] ${
            overdue ? "text-[color:var(--danger)]" : "text-[color:var(--text-muted)]"
          }`}
        >
          {relativeDue(invoice.dueDate)}
        </p>
      )}
    </div>
  );
}

function ActionTile({
  title,
  description,
  icon,
  tone,
  onClick,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  tone: "cyan" | "green" | "red";
  onClick: () => void;
}) {
  const color = {
    cyan: "bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
    green: "bg-[color:var(--success-soft)] text-[color:var(--success)]",
    red: "bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 text-left transition hover:border-[color:var(--border-brand)] hover:bg-[color:var(--surface-soft)]"
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-[color:var(--text-primary)]">
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

function ActionButton({
  label,
  icon,
  onClick,
  tone,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  tone: "cyan" | "green" | "blue" | "violet" | "red";
}) {
  const style = {
    cyan: "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
    green:
      "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
    blue: "border-[color:var(--secondary-border)] bg-[color:var(--secondary-soft)] text-[color:var(--secondary)]",
    violet:
      "border-[color:var(--violet-border)] bg-[color:var(--violet-soft)] text-[color:var(--chart-5)]",
    red: "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-xs font-medium transition hover:brightness-125 ${style}`}
    >
      {icon}
      {label}
    </button>
  );
}

function Alert({
  tone,
  children,
}: {
  tone: "error" | "success" | "warning";
  children: ReactNode;
}) {
  const style = {
    error: "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
    success: "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
    warning:
      "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
  }[tone];

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${style}`}>
      {children}
    </div>
  );
}

function FormInput({
  name,
  label,
  type = "text",
  defaultValue,
  placeholder,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs text-[color:var(--text-secondary)]">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className={`${INPUT} mt-2`}
      />
    </label>
  );
}

function FormSelect({
  name,
  label,
  defaultValue,
  value,
  onChange,
  required,
  children,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs text-[color:var(--text-secondary)]">{label}</span>
      <select
        name={name}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={
          onChange
            ? (event) => onChange(event.target.value)
            : undefined
        }
        required={required}
        className={`${INPUT} mt-2`}
      >
        {children}
      </select>
    </label>
  );
}

function FormTextarea({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-[color:var(--text-secondary)]">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={`${TEXTAREA} mt-2`}
      />
    </label>
  );
}

function EditorField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
        {label}
      </p>
      {children}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 ${
        strong ? "text-base font-semibold" : "text-xs"
      }`}
    >
      <span className={strong ? "text-[color:var(--text-primary)]" : "text-[color:var(--text-tertiary)]"}>
        {label}
      </span>
      <span
        className={strong ? "text-[color:var(--primary)]" : "text-[color:var(--text-secondary)]"}
      >
        {value}
      </span>
    </div>
  );
}

function InvoiceAddress({
  label,
  title,
  lines,
}: {
  label: string;
  title: string;
  lines: (string | null)[];
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5 print:border-[color:var(--border)] print:bg-transparent">
      <p className="text-[9px] uppercase tracking-[0.14em] text-[color:var(--text-tertiary)] print:text-[color:var(--text-primary)]">
        {label}
      </p>
      <p className="mt-3 text-base font-semibold">{title}</p>
      {lines.filter(Boolean).map((line) => (
        <p
          key={line}
          className="mt-1 text-xs text-[color:var(--text-tertiary)] print:text-[color:var(--text-primary)]"
        >
          {line}
        </p>
      ))}
    </div>
  );
}

function InvoiceNote({
  label,
  text,
}: {
  label: string;
  text: string;
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.14em] text-[color:var(--text-tertiary)] print:text-[color:var(--text-primary)]">
        {label}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-[color:var(--text-secondary)] print:text-[color:var(--text-primary)]">
        {text}
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "cyan" | "green" | "red";
}) {
  const color = {
    cyan: "text-[color:var(--primary)]",
    green: "text-[color:var(--success)]",
    red: "text-[color:var(--danger)]",
  }[tone];

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-4">
      <p className="text-[9px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
        {label}
      </p>
      <p className={`mt-2 text-sm font-semibold ${color}`}>
        {value}
      </p>
    </div>
  );
}

function Legend({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
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
      className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs transition disabled:opacity-25 ${
        active
          ? "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
          : "border-[color:var(--border)] text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-5 rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-8 text-center text-xs text-[color:var(--text-muted)]">
      {text}
    </div>
  );
}

function smallButton(
  tone: "default" | "cyan" | "green" = "default"
) {
  const style = {
    default: "border-[color:var(--border)] text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)]",
    cyan: "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
    green:
      "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
  }[tone];

  return `rounded-lg border px-3 py-2 text-[10px] transition disabled:cursor-not-allowed disabled:opacity-25 ${style}`;
}

function submitAction(action: ServerAction, invoiceId: string) {
  const data = new FormData();
  data.append("invoice_id", invoiceId);
  action(data);
}

function newLine(): EditableLine {
  return {
    key:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    productId: "",
    description: "",
    quantity: 1,
    unitPrice: 0,
    discountAmount: 0,
    taxRate: 0,
  };
}

function calculateLine(line: EditableLine) {
  const subtotal = Math.max(line.quantity, 0) * Math.max(line.unitPrice, 0);
  const discount = Math.min(
    Math.max(line.discountAmount, 0),
    subtotal
  );
  const taxable = Math.max(subtotal - discount, 0);
  const tax = taxable * (Math.max(line.taxRate, 0) / 100);

  return {
    subtotal,
    discount,
    tax,
    total: taxable + tax,
  };
}

function calculateTotals(
  lines: EditableLine[],
  invoiceDiscount: number
) {
  const calculated = lines.map(calculateLine);
  const subtotal = calculated.reduce(
    (sum, line) => sum + line.subtotal,
    0
  );
  const lineDiscount = calculated.reduce(
    (sum, line) => sum + line.discount,
    0
  );
  const tax = calculated.reduce(
    (sum, line) => sum + line.tax,
    0
  );
  const total = Math.max(
    subtotal - lineDiscount + tax - Math.max(invoiceDiscount, 0),
    0
  );

  return { subtotal, lineDiscount, tax, total };
}

function buildTrend(invoices: Invoice[]) {
  const grouped = new Map<
    string,
    { invoiced: number; collected: number; outstanding: number }
  >();

  for (const invoice of invoices) {
    if (invoice.status === "cancelled") continue;
    const date = new Date(invoice.issueDate);
    const key = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}`;
    const current = grouped.get(key) || {
      invoiced: 0,
      collected: 0,
      outstanding: 0,
    };
    current.invoiced += invoice.totalAmount;
    current.collected += invoice.paidAmount;
    current.outstanding += invoice.balanceDue;
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([key, values]) => ({
      label: new Date(`${key}-01T00:00:00`).toLocaleDateString(
        "en-GB",
        { month: "short", year: "2-digit" }
      ),
      ...values,
    }));
}

function averageCollectionDays(invoices: Invoice[]) {
  const paid = invoices.filter(
    (invoice) => invoice.paidAt && invoice.totalAmount > 0
  );
  if (!paid.length) return null;

  return Math.round(
    paid.reduce((sum, invoice) => {
      const issue = new Date(invoice.issueDate).getTime();
      const paidAt = new Date(invoice.paidAt as string).getTime();
      return sum + Math.max((paidAt - issue) / 86_400_000, 0);
    }, 0) / paid.length
  );
}

function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
) {
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
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function numberValue(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  const parts = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).formatToParts(0);
  const symbol =
    parts.find((part) => part.type === "currency")?.value || "";
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000)
    return `${symbol}${(absolute / 1_000_000).toFixed(1)}m`;
  if (absolute >= 1_000)
    return `${symbol}${(absolute / 1_000).toFixed(1)}k`;
  return `${symbol}${Math.round(absolute)}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeDue(value: string) {
  const due = startOfDay(new Date(value)).getTime();
  const today = startOfDay(new Date()).getTime();
  const days = Math.round((due - today) / 86_400_000);
  if (days === 0) return "Due today";
  if (days > 0) return `Due in ${days} day${days === 1 ? "" : "s"}`;
  const overdue = Math.abs(days);
  return `${overdue} day${overdue === 1 ? "" : "s"} overdue`;
}

function startOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}

function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function toLocalDateTime(date: Date) {
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000
  );
  return local.toISOString().slice(0, 16);
}

function statusLabel(status: Invoice["status"]) {
  return {
    draft: "Draft",
    sent: "Sent",
    viewed: "Viewed",
    partially_paid: "Partially Paid",
    paid: "Paid",
    overdue: "Overdue",
    cancelled: "Cancelled",
  }[status];
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
  return <SvgIcon><path d="M12 5v14M5 12h14" /></SvgIcon>;
}
function DownloadIcon() {
  return <SvgIcon><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></SvgIcon>;
}
function SearchIcon() {
  return <SvgIcon size={15}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></SvgIcon>;
}
function InvoiceIcon() {
  return <SvgIcon size={18}><path d="M6 3h9l3 3v15H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></SvgIcon>;
}
function ClockIcon() {
  return <SvgIcon size={18}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></SvgIcon>;
}
function CheckIcon() {
  return <SvgIcon size={18}><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></SvgIcon>;
}
function AlertIcon() {
  return <SvgIcon size={18}><path d="M12 3 2.5 20h19z" /><path d="M12 9v4M12 17h.01" /></SvgIcon>;
}
function WalletIcon() {
  return <SvgIcon><path d="M4 6h14v14H4z" /><path d="M4 9h16v7h-5a2 2 0 0 1 0-4h5" /></SvgIcon>;
}
function BankIcon() {
  return <SvgIcon><path d="m3 9 9-5 9 5M5 10v7M9 10v7M15 10v7M19 10v7M3 20h18" /></SvgIcon>;
}
function SendIcon() {
  return <SvgIcon><path d="m22 2-7 20-4-9-9-4zM22 2 11 13" /></SvgIcon>;
}
function EditIcon() {
  return <SvgIcon><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" /></SvgIcon>;
}
function CopyIcon() {
  return <SvgIcon><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></SvgIcon>;
}
function RestoreIcon() {
  return <SvgIcon><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></SvgIcon>;
}
function TrashIcon() {
  return <SvgIcon><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 11v6M14 11v6" /></SvgIcon>;
}
function PrintIcon() {
  return <SvgIcon><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v7H6z" /></SvgIcon>;
}
function CloseIcon() {
  return <SvgIcon><path d="m6 6 12 12M18 6 6 18" /></SvgIcon>;
}
function ChevronLeftIcon() {
  return <SvgIcon size={14}><path d="m15 18-6-6 6-6" /></SvgIcon>;
}
function ChevronRightIcon() {
  return <SvgIcon size={14}><path d="m9 18 6-6-6-6" /></SvgIcon>;
}