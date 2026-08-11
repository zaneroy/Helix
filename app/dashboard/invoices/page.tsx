import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { createClient } from "@/lib/supabase/server";
import { getUserNotifications } from "@/lib/notifications/server";
import { emitEvent } from "@/lib/events/emitEvent";
import {
  createInvoicesImporter,
  type InvoiceImportData,
} from "@/lib/import-export/importers/invoicesImporter";
import type { TransformedRow } from "@/lib/import-export/parser/rowTransformer";
import InvoicesClient from "./InvoicesClient";

type SearchParams = { error?: string; success?: string };

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  company_id: string | null;
  access_status: string | null;
};

type CompanyRow = { id: string; name: string; currency: string | null };

type CustomerRow = {
  id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
};

type ProductRow = {
  id: string;
  name: string | null;
  item_name: string | null;
  sku: string | null;
  selling_price: number | string | null;
  price_per_piece: number | string | null;
  quantity_on_hand: number | string | null;
  stock_quantity: number | string | null;
};

type CashAccountRow = {
  id: string;
  name: string;
  account_type: string;
  currency: string;
  opening_balance: number | string;
  status: string;
};

type CashLedgerRow = {
  account_id: string | null;
  direction: "inflow" | "outflow";
  amount: number | string;
};

type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";

type InvoiceRow = {
  id: string;
  company_id: string;
  customer_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: number | string;
  discount_amount: number | string;
  tax_amount: number | string;
  total_amount: number | string;
  paid_amount: number | string;
  balance_due: number | string;
  payment_terms: string | null;
  notes: string | null;
  footer_note: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type InvoiceItemRow = {
  id: string;
  invoice_id: string;
  product_id: string | null;
  description: string;
  quantity: number | string;
  unit_price: number | string;
  discount_amount: number | string;
  tax_rate: number | string;
  tax_amount: number | string;
  line_subtotal: number | string;
  line_total: number | string;
  sort_order: number;
  created_at: string;
};

type InvoicePaymentRow = {
  id: string;
  company_id: string;
  invoice_id: string;
  customer_id: string;
  account_id: string;
  amount: number | string;
  payment_date: string;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  cash_ledger_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type ImportedInvoiceRow = TransformedRow;

export type InvoiceCustomer = {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
};

export type InvoiceProduct = {
  id: string;
  name: string;
  sku: string | null;
  sellingPrice: number;
  availableStock: number;
};

export type InvoiceAccount = {
  id: string;
  name: string;
  accountType: string;
  currency: string;
  balance: number;
};

export type InvoiceItem = {
  id: string;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  sortOrder: number;
};

export type InvoicePayment = {
  id: string;
  accountId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
};

export type Invoice = {
  id: string;
  customerId: string;
  customerName: string;
  customerCompany: string | null;
  customerEmail: string | null;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  paymentTerms: string | null;
  notes: string | null;
  footerNote: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItem[];
  payments: InvoicePayment[];
};

function cleanText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function cleanNumber(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(String(value ?? "").replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanDate(value: FormDataEntryValue | null) {
  const date = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function redirectWithMessage(
  type: "error" | "success",
  message: string
): never {
  redirect(`/dashboard/invoices?${type}=${encodeURIComponent(message)}`);
}

async function getAdminContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/admin/login");

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, company_id, access_status")
    .eq("id", user.id)
    .single();

  const profile = profileData as ProfileRow | null;

  if (
    profileError ||
    !profile ||
    profile.role !== "admin" ||
    !profile.company_id ||
    profile.access_status === "inactive"
  ) {
    redirect("/admin/login");
  }

  return { supabase, user, profile, companyId: profile.company_id };
}

function parseInvoiceItems(rawItems: string) {
  let parsedItems: Array<{
    productId?: string | null;
    description?: string;
    quantity?: number;
    unitPrice?: number;
    discountAmount?: number;
    taxRate?: number;
  }>;

  try {
    parsedItems = JSON.parse(rawItems);
  } catch {
    redirectWithMessage(
      "error",
      "Invoice item data is invalid. Refresh and try again."
    );
  }

  if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
    redirectWithMessage("error", "Add at least one invoice item.");
  }

  return parsedItems.map((item, index) => {
    const description = String(item.description ?? "").trim();
    const quantity = Number(item.quantity ?? 0);
    const unitPrice = Number(item.unitPrice ?? 0);
    const discountAmount = Number(item.discountAmount ?? 0);
    const taxRate = Number(item.taxRate ?? 0);
    const productId =
      typeof item.productId === "string" && item.productId.trim()
        ? item.productId.trim()
        : null;

    if (!description) {
      redirectWithMessage("error", `Item ${index + 1} needs a description.`);
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      redirectWithMessage(
        "error",
        `Item ${index + 1} needs a quantity above zero.`
      );
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      redirectWithMessage(
        "error",
        `Item ${index + 1} has an invalid unit price.`
      );
    }
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      redirectWithMessage(
        "error",
        `Item ${index + 1} has an invalid discount.`
      );
    }
    if (!Number.isFinite(taxRate) || taxRate < 0) {
      redirectWithMessage(
        "error",
        `Item ${index + 1} has an invalid tax rate.`
      );
    }

    const lineSubtotal = quantity * unitPrice;
    if (discountAmount > lineSubtotal) {
      redirectWithMessage(
        "error",
        `Item ${index + 1} discount exceeds its subtotal.`
      );
    }

    return {
      product_id: productId,
      description,
      quantity,
      unit_price: unitPrice,
      discount_amount: discountAmount,
      tax_rate: taxRate,
      sort_order: index,
    };
  });
}

async function createInvoice(formData: FormData) {
  "use server";

  const { supabase, user, profile, companyId } = await getAdminContext();
  const customerId = cleanText(formData.get("customer_id"));
  const issueDate = cleanDate(formData.get("issue_date"));
  const dueDate = cleanDate(formData.get("due_date"));
  const currency = cleanText(formData.get("currency"))?.toUpperCase() || "USD";
  const paymentTerms = cleanText(formData.get("payment_terms"));
  const notes = cleanText(formData.get("notes"));
  const footerNote = cleanText(formData.get("footer_note"));
  const invoiceDiscount = cleanNumber(formData.get("discount_amount"), 0);
  const requestedStatus =
    cleanText(formData.get("status")) === "sent" ? "sent" : "draft";

  if (!customerId) redirectWithMessage("error", "Select a customer.");
  if (!issueDate || !dueDate) {
    redirectWithMessage("error", "Enter a valid issue date and due date.");
  }
  if (new Date(dueDate) < new Date(issueDate)) {
    redirectWithMessage("error", "The due date cannot be before the issue date.");
  }
  if (invoiceDiscount < 0) {
    redirectWithMessage("error", "Invoice discount cannot be negative.");
  }

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, name")
    .eq("id", customerId)
    .eq("company_id", companyId)
    .single();

  if (customerError || !customer) {
    redirectWithMessage("error", "The selected customer could not be found.");
  }

  const rawItems = cleanText(formData.get("items_json"));
  if (!rawItems) redirectWithMessage("error", "Add at least one invoice item.");
  const items = parseInvoiceItems(rawItems);

  const productIds = Array.from(
    new Set(
      items
        .map((item) => item.product_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  if (productIds.length > 0) {
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id")
      .eq("company_id", companyId)
      .in("id", productIds);

    if (productsError || (products ?? []).length !== productIds.length) {
      redirectWithMessage("error", "One or more selected products are invalid.");
    }
  }

  const { data: invoiceNumberData, error: numberError } = await supabase.rpc(
    "generate_invoice_number"
  );

  if (numberError || !invoiceNumberData) {
    redirectWithMessage(
      "error",
      numberError?.message || "Unable to generate an invoice number."
    );
  }

  const invoiceNumber = String(invoiceNumberData);
  const { data: invoiceData, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      company_id: companyId,
      customer_id: customerId,
      invoice_number: invoiceNumber,
      issue_date: issueDate,
      due_date: dueDate,
      status: requestedStatus,
      currency,
      discount_amount: invoiceDiscount,
      payment_terms: paymentTerms,
      notes,
      footer_note: footerNote,
      sent_at: requestedStatus === "sent" ? new Date().toISOString() : null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (invoiceError || !invoiceData) {
    redirectWithMessage(
      "error",
      invoiceError?.message || "Unable to create the invoice."
    );
  }

  const invoiceId = String(invoiceData.id);
  const { error: itemError } = await supabase.from("invoice_items").insert(
    items.map((item) => ({ invoice_id: invoiceId, ...item }))
  );

  if (itemError) {
    await supabase
      .from("invoices")
      .delete()
      .eq("id", invoiceId)
      .eq("company_id", companyId);

    redirectWithMessage(
      "error",
      itemError.message || "Unable to save invoice items."
    );
  }

  const { error: recalculateError } = await supabase.rpc(
    "recalculate_invoice_totals",
    { target_invoice_id: invoiceId }
  );

  if (recalculateError) {
    redirectWithMessage(
      "error",
      recalculateError.message ||
        "Invoice was created, but totals could not be refreshed."
    );
  }

  await emitEvent({
    companyId,
    actorId: user.id,
    actorRole: profile.role === "admin" ? "admin" : undefined,
    recipients: [user.id],
    type: "invoice_created",
    title:
      requestedStatus === "sent"
        ? "Invoice created and marked sent"
        : "Draft invoice created",
    message: `${invoiceNumber} was created for ${customer.name}.`,
    actionUrl: "/dashboard/invoices",
    referenceType: "invoice",
    referenceId: invoiceId,
    severity: "success",
    metadata: {
      invoiceId,
      invoiceNumber,
      customerId,
      customerName: customer.name,
      issueDate,
      dueDate,
      currency,
      requestedStatus,
      paymentTerms,
      invoiceDiscount,
      itemCount: items.length,
      createdAndSent: requestedStatus === "sent",
    },
  });

  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");
  redirectWithMessage("success", `${invoiceNumber} was created successfully.`);
}

function getImportErrorMessage(
  error: { message?: string } | null | undefined,
  fallback: string
) {
  return error?.message || fallback;
}

async function importInvoices(
  rows: ImportedInvoiceRow[]
): Promise<{
  imported: number;
  failed: number;
  skipped: number;
}> {
  "use server";

  const { supabase, user, profile, companyId } = await getAdminContext();

  const { data: companyData } = await supabase
    .from("companies")
    .select("currency")
    .eq("id", companyId)
    .single();

  const companyCurrency = String(companyData?.currency || "USD").toUpperCase();

  const importer = createInvoicesImporter({
    resolveCustomer: async ({ name, email }) => {
      const normalizedName = String(name || "").trim();
      const normalizedEmail = String(email || "").trim().toLowerCase();

      if (normalizedEmail) {
        const { data: customerByEmail } = await supabase
          .from("customers")
          .select("id")
          .eq("company_id", companyId)
          .ilike("email", normalizedEmail)
          .limit(1)
          .maybeSingle();

        if (customerByEmail?.id) {
          return String(customerByEmail.id);
        }
      }

      if (!normalizedName) return null;

      const { data: customerByName } = await supabase
        .from("customers")
        .select("id")
        .eq("company_id", companyId)
        .ilike("name", normalizedName)
        .limit(1)
        .maybeSingle();

      return customerByName?.id ? String(customerByName.id) : null;
    },

    resolveProduct: async ({ name, sku }) => {
      const normalizedSku = String(sku || "").trim();
      const normalizedName = String(name || "").trim();

      if (normalizedSku) {
        const { data: productBySku } = await supabase
          .from("products")
          .select("id")
          .eq("company_id", companyId)
          .ilike("sku", normalizedSku)
          .limit(1)
          .maybeSingle();

        if (productBySku?.id) {
          return String(productBySku.id);
        }
      }

      if (!normalizedName) return null;

      const { data: productByItemName } = await supabase
        .from("products")
        .select("id")
        .eq("company_id", companyId)
        .ilike("item_name", normalizedName)
        .limit(1)
        .maybeSingle();

      if (productByItemName?.id) {
        return String(productByItemName.id);
      }

      const { data: productByName } = await supabase
        .from("products")
        .select("id")
        .eq("company_id", companyId)
        .ilike("name", normalizedName)
        .limit(1)
        .maybeSingle();

      return productByName?.id ? String(productByName.id) : null;
    },

    requireProductMatch: false,

    findDuplicate: async (invoice) => {
      const { data: existingInvoice } = await supabase
        .from("invoices")
        .select("id")
        .eq("company_id", companyId)
        .eq("invoice_number", invoice.invoiceNumber)
        .limit(1)
        .maybeSingle();

      return Boolean(existingInvoice?.id);
    },

    createInvoice: async (invoice: InvoiceImportData) => {
      let invoiceId: string | null = null;

      try {
        const currency = String(
          invoice.currency || companyCurrency
        ).toUpperCase();
        const status = invoice.status === "sent" ? "sent" : "draft";

        const { data: customer, error: customerError } = await supabase
          .from("customers")
          .select("id")
          .eq("id", invoice.customerId)
          .eq("company_id", companyId)
          .single();

        if (customerError || !customer) {
          return {
            success: false,
            message: "The imported customer could not be found.",
          };
        }

        const productIds = Array.from(
          new Set(
            invoice.items
              .map((item) => item.productId)
              .filter((productId): productId is string => Boolean(productId))
          )
        );

        if (productIds.length > 0) {
          const { data: validProducts, error: productsError } = await supabase
            .from("products")
            .select("id")
            .eq("company_id", companyId)
            .in("id", productIds);

          if (
            productsError ||
            (validProducts || []).length !== productIds.length
          ) {
            return {
              success: false,
              message: "One or more imported products are invalid.",
            };
          }
        }

        const { data: createdInvoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert({
            company_id: companyId,
            customer_id: invoice.customerId,
            invoice_number: invoice.invoiceNumber,
            issue_date: invoice.issueDate,
            due_date: invoice.dueDate,
            status,
            currency,
            discount_amount: invoice.discountAmount,
            payment_terms: invoice.paymentTerms || null,
            notes: invoice.notes || null,
            footer_note: invoice.footerNote || null,
            sent_at: status === "sent" ? new Date().toISOString() : null,
            created_by: user.id,
          })
          .select("id")
          .single();

        if (invoiceError || !createdInvoice) {
          return {
            success: false,
            message: getImportErrorMessage(
              invoiceError,
              "Unable to create the imported invoice."
            ),
          };
        }

        invoiceId = String(createdInvoice.id);

        const itemPayload = invoice.items.map((item, index) => ({
          invoice_id: invoiceId,
          product_id: item.productId || null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount_amount: item.discountAmount,
          tax_rate: item.taxRate,
          sort_order: index,
        }));

        const { error: itemError } = await supabase
          .from("invoice_items")
          .insert(itemPayload);

        if (itemError) {
          await supabase
            .from("invoices")
            .delete()
            .eq("id", invoiceId)
            .eq("company_id", companyId);

          return {
            success: false,
            message: getImportErrorMessage(
              itemError,
              "Unable to save imported invoice items."
            ),
          };
        }

        const { error: recalculateError } = await supabase.rpc(
          "recalculate_invoice_totals",
          { target_invoice_id: invoiceId }
        );

        if (recalculateError) {
          await supabase
            .from("invoice_items")
            .delete()
            .eq("invoice_id", invoiceId);

          await supabase
            .from("invoices")
            .delete()
            .eq("id", invoiceId)
            .eq("company_id", companyId);

          return {
            success: false,
            message: getImportErrorMessage(
              recalculateError,
              "Unable to calculate imported invoice totals."
            ),
          };
        }

        return {
          success: true,
          invoiceId,
        };
      } catch (error) {
        console.error("Invoice CSV import failed:", error);

        if (invoiceId) {
          await supabase
            .from("invoices")
            .delete()
            .eq("id", invoiceId)
            .eq("company_id", companyId);
        }

        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Unable to import the invoice.",
        };
      }
    },

    afterImport: async (result) => {
      if (result.imported > 0) {
        await emitEvent({
          companyId,
          actorId: user.id,
          recipients: [user.id],
          type: "invoices_imported",
          title: "Invoices imported",
          message: `${result.imported} invoice${
            result.imported === 1 ? "" : "s"
          } imported from CSV.`,
          actionUrl: "/dashboard/invoices",
          severity: "success",
          metadata: {
            imported: result.imported,
            failed: result.failed,
            skipped: result.skipped,
            importedBy: user.id,
            importedAt: new Date().toISOString(),
            actorRole: profile.role,
          },
        });
      }
    },
  });

  const result = await importer(rows as TransformedRow[]);

  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");

  return result;
}

async function updateInvoice(formData: FormData) {
  "use server";

  const { supabase, user, profile, companyId } = await getAdminContext();
  const invoiceId = cleanText(formData.get("invoice_id"));
  const customerId = cleanText(formData.get("customer_id"));
  const issueDate = cleanDate(formData.get("issue_date"));
  const dueDate = cleanDate(formData.get("due_date"));
  const paymentTerms = cleanText(formData.get("payment_terms"));
  const notes = cleanText(formData.get("notes"));
  const footerNote = cleanText(formData.get("footer_note"));
  const invoiceDiscount = cleanNumber(formData.get("discount_amount"), 0);

  if (!invoiceId || !customerId || !issueDate || !dueDate) {
    redirectWithMessage(
      "error",
      "Invoice, customer and date details are required."
    );
  }
  if (new Date(dueDate) < new Date(issueDate)) {
    redirectWithMessage("error", "The due date cannot be before the issue date.");
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, customer_id, issue_date, due_date, status, currency, discount_amount, payment_terms, notes, footer_note, total_amount, paid_amount"
    )
    .eq("id", invoiceId)
    .eq("company_id", companyId)
    .single();

  if (invoiceError || !invoice) {
    redirectWithMessage("error", "Invoice could not be found.");
  }
  if (invoice.status === "paid" || Number(invoice.paid_amount || 0) > 0) {
    redirectWithMessage(
      "error",
      "Paid or partially paid invoices cannot be structurally edited."
    );
  }
  if (invoice.status === "cancelled") {
    redirectWithMessage("error", "Cancelled invoices cannot be edited.");
  }

  const rawItems = cleanText(formData.get("items_json"));
  if (!rawItems) redirectWithMessage("error", "Add at least one invoice item.");
  const items = parseInvoiceItems(rawItems).map((item) => ({
    invoice_id: invoiceId,
    ...item,
  }));

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      customer_id: customerId,
      issue_date: issueDate,
      due_date: dueDate,
      discount_amount: invoiceDiscount,
      payment_terms: paymentTerms,
      notes,
      footer_note: footerNote,
    })
    .eq("id", invoiceId)
    .eq("company_id", companyId);

  if (updateError) {
    redirectWithMessage(
      "error",
      updateError.message || "Unable to update the invoice."
    );
  }

  const { error: deleteItemsError } = await supabase
    .from("invoice_items")
    .delete()
    .eq("invoice_id", invoiceId);

  if (deleteItemsError) {
    redirectWithMessage(
      "error",
      deleteItemsError.message || "Unable to replace invoice items."
    );
  }

  const { error: insertItemsError } = await supabase
    .from("invoice_items")
    .insert(items);

  if (insertItemsError) {
    redirectWithMessage(
      "error",
      insertItemsError.message || "Unable to save updated invoice items."
    );
  }

  const { error: recalculateError } = await supabase.rpc(
    "recalculate_invoice_totals",
    {
      target_invoice_id: invoiceId,
    }
  );

  if (recalculateError) {
    redirectWithMessage(
      "error",
      recalculateError.message ||
        "Invoice details were saved, but totals could not be refreshed."
    );
  }

  const { data: refreshedInvoice } = await supabase
    .from("invoices")
    .select("total_amount, tax_amount, subtotal, balance_due")
    .eq("id", invoiceId)
    .eq("company_id", companyId)
    .single();

  const changedFields = [
    invoice.customer_id !== customerId ? "customer" : null,
    invoice.issue_date !== issueDate ? "issue date" : null,
    invoice.due_date !== dueDate ? "due date" : null,
    Number(invoice.discount_amount || 0) !== invoiceDiscount
      ? "invoice discount"
      : null,
    (invoice.payment_terms || null) !== paymentTerms
      ? "payment terms"
      : null,
    (invoice.notes || null) !== notes ? "notes" : null,
    (invoice.footer_note || null) !== footerNote ? "footer note" : null,
    "line items",
  ].filter((field): field is string => Boolean(field));

  await emitEvent({
    companyId,
    actorId: user.id,
    actorRole: profile.role === "admin" ? "admin" : undefined,
    recipients: [user.id],
    type: "invoice_updated",
    title: "Invoice updated",
    message: `${invoice.invoice_number} was updated.`,
    actionUrl: "/dashboard/invoices",
    referenceType: "invoice",
    referenceId: invoiceId,
    severity: "info",
    metadata: {
      invoiceId,
      invoiceNumber: invoice.invoice_number,
      changedFields,
      previous: {
        customerId: invoice.customer_id,
        issueDate: invoice.issue_date,
        dueDate: invoice.due_date,
        discountAmount: Number(invoice.discount_amount || 0),
        paymentTerms: invoice.payment_terms,
        notes: invoice.notes,
        footerNote: invoice.footer_note,
        totalAmount: Number(invoice.total_amount || 0),
      },
      updated: {
        customerId,
        issueDate,
        dueDate,
        discountAmount: invoiceDiscount,
        paymentTerms,
        notes,
        footerNote,
        itemCount: items.length,
        subtotal: Number(refreshedInvoice?.subtotal || 0),
        taxAmount: Number(refreshedInvoice?.tax_amount || 0),
        totalAmount: Number(refreshedInvoice?.total_amount || 0),
        balanceDue: Number(refreshedInvoice?.balance_due || 0),
      },
    },
  });

  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");
  redirectWithMessage(
    "success",
    `${invoice.invoice_number} was updated successfully.`
  );
}

async function markInvoiceSent(formData: FormData) {
  "use server";

  const { supabase, user, companyId } = await getAdminContext();
  const invoiceId = cleanText(formData.get("invoice_id"));
  if (!invoiceId) redirectWithMessage("error", "Invoice ID is missing.");

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, total_amount")
    .eq("id", invoiceId)
    .eq("company_id", companyId)
    .single();

  if (invoiceError || !invoice) {
    redirectWithMessage("error", "Invoice could not be found.");
  }
  if (["paid", "cancelled"].includes(invoice.status)) {
    redirectWithMessage(
      "error",
      "Paid or cancelled invoices cannot be marked as sent."
    );
  }
  if (Number(invoice.total_amount || 0) <= 0) {
    redirectWithMessage(
      "error",
      "An invoice must have a positive total before it can be sent."
    );
  }

  const { error } = await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("company_id", companyId);

  if (error) {
    redirectWithMessage(
      "error",
      error.message || "Unable to mark the invoice as sent."
    );
  }

  await emitEvent({
    companyId,
    actorId: user.id,
    recipients: [user.id],
    type: "invoice_sent",
    title: "Invoice marked as sent",
    message: `${invoice.invoice_number} was marked as sent.`,
    actionUrl: "/dashboard/invoices",
    referenceType: "invoice",
    referenceId: invoiceId,
    severity: "success",
    metadata: {
      invoiceId,
      invoiceNumber: invoice.invoice_number,
      totalAmount: Number(invoice.total_amount || 0),
      previousStatus: invoice.status,
      newStatus: "sent",
      sentAt: new Date().toISOString(),
    },
  });

  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");
  redirectWithMessage("success", `${invoice.invoice_number} was marked as sent.`);
}

async function cancelInvoice(formData: FormData) {
  "use server";

  const { supabase, user, companyId } = await getAdminContext();
  const invoiceId = cleanText(formData.get("invoice_id"));
  if (!invoiceId) redirectWithMessage("error", "Invoice ID is missing.");

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, paid_amount")
    .eq("id", invoiceId)
    .eq("company_id", companyId)
    .single();

  if (invoiceError || !invoice) {
    redirectWithMessage("error", "Invoice could not be found.");
  }
  if (Number(invoice.paid_amount || 0) > 0 || invoice.status === "paid") {
    redirectWithMessage(
      "error",
      "Paid invoices or invoices with payments cannot be cancelled."
    );
  }

  const { error } = await supabase
    .from("invoices")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("company_id", companyId);

  if (error) {
    redirectWithMessage("error", error.message || "Unable to cancel the invoice.");
  }

  await emitEvent({
    companyId,
    actorId: user.id,
    recipients: [user.id],
    type: "invoice_cancelled",
    title: "Invoice cancelled",
    message: `${invoice.invoice_number} was cancelled.`,
    actionUrl: "/dashboard/invoices",
    referenceType: "invoice",
    referenceId: invoiceId,
    severity: "warning",
    metadata: {
      invoiceId,
      invoiceNumber: invoice.invoice_number,
      previousStatus: invoice.status,
      newStatus: "cancelled",
      cancelledAt: new Date().toISOString(),
    },
  });

  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");
  redirectWithMessage("success", `${invoice.invoice_number} was cancelled.`);
}

async function restoreInvoice(formData: FormData) {
  "use server";

  const { supabase, user, companyId } = await getAdminContext();
  const invoiceId = cleanText(formData.get("invoice_id"));
  if (!invoiceId) redirectWithMessage("error", "Invoice ID is missing.");

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, due_date")
    .eq("id", invoiceId)
    .eq("company_id", companyId)
    .single();

  if (invoiceError || !invoice || invoice.status !== "cancelled") {
    redirectWithMessage("error", "Only cancelled invoices can be restored.");
  }

  const restoredStatus =
    new Date(invoice.due_date) < new Date() ? "overdue" : "draft";

  const { error } = await supabase
    .from("invoices")
    .update({ status: restoredStatus, cancelled_at: null })
    .eq("id", invoiceId)
    .eq("company_id", companyId);

  if (error) {
    redirectWithMessage("error", error.message || "Unable to restore the invoice.");
  }

  await emitEvent({
    companyId,
    actorId: user.id,
    recipients: [user.id],
    type: "invoice_restored",
    title: "Invoice restored",
    message: `${invoice.invoice_number} was restored as ${restoredStatus.replaceAll(
      "_",
      " "
    )}.`,
    actionUrl: "/dashboard/invoices",
    referenceType: "invoice",
    referenceId: invoiceId,
    severity: "success",
    metadata: {
      invoiceId,
      invoiceNumber: invoice.invoice_number,
      previousStatus: "cancelled",
      newStatus: restoredStatus,
      dueDate: invoice.due_date,
      restoredAt: new Date().toISOString(),
    },
  });

  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");
  redirectWithMessage("success", `${invoice.invoice_number} was restored.`);
}

async function deleteInvoice(formData: FormData) {
  "use server";

  const { supabase, user, companyId } = await getAdminContext();
  const invoiceId = cleanText(formData.get("invoice_id"));
  if (!invoiceId) redirectWithMessage("error", "Invoice ID is missing.");

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, paid_amount")
    .eq("id", invoiceId)
    .eq("company_id", companyId)
    .single();

  if (invoiceError || !invoice) {
    redirectWithMessage("error", "Invoice could not be found.");
  }
  if (!["draft", "cancelled"].includes(invoice.status)) {
    redirectWithMessage(
      "error",
      "Only draft or cancelled invoices can be deleted."
    );
  }
  if (Number(invoice.paid_amount || 0) > 0) {
    redirectWithMessage("error", "Invoices with payments cannot be deleted.");
  }

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", invoiceId)
    .eq("company_id", companyId);

  if (error) {
    redirectWithMessage("error", error.message || "Unable to delete the invoice.");
  }

  await emitEvent({
    companyId,
    actorId: user.id,
    recipients: [user.id],
    type: "invoice_deleted",
    title: "Invoice deleted",
    message: `${invoice.invoice_number} was permanently deleted.`,
    actionUrl: "/dashboard/invoices",
    referenceType: "invoice",
    referenceId: invoiceId,
    severity: "warning",
    metadata: {
      invoiceId,
      invoiceNumber: invoice.invoice_number,
      previousStatus: invoice.status,
      paidAmount: Number(invoice.paid_amount || 0),
      deletedAt: new Date().toISOString(),
    },
  });

  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");
  redirectWithMessage("success", `${invoice.invoice_number} was deleted.`);
}

async function duplicateInvoice(formData: FormData) {
  "use server";

  const { supabase, user, companyId } = await getAdminContext();
  const invoiceId = cleanText(formData.get("invoice_id"));
  if (!invoiceId) redirectWithMessage("error", "Invoice ID is missing.");

  const [invoiceResult, itemsResult] = await Promise.all([
    supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("company_id", companyId)
      .single(),
    supabase
      .from("invoice_items")
      .select(
        "product_id, description, quantity, unit_price, discount_amount, tax_rate, sort_order"
      )
      .eq("invoice_id", invoiceId)
      .order("sort_order", { ascending: true }),
  ]);

  const invoice = invoiceResult.data;
  const items = itemsResult.data ?? [];

  if (invoiceResult.error || itemsResult.error || !invoice) {
    redirectWithMessage("error", "The invoice could not be duplicated.");
  }

  const { data: invoiceNumberData, error: numberError } = await supabase.rpc(
    "generate_invoice_number"
  );

  if (numberError || !invoiceNumberData) {
    redirectWithMessage("error", "Unable to generate a new invoice number.");
  }

  const today = new Date();
  const originalIssue = new Date(invoice.issue_date);
  const originalDue = new Date(invoice.due_date);
  const termDays = Math.max(
    0,
    Math.round((originalDue.getTime() - originalIssue.getTime()) / 86_400_000)
  );
  const duplicatedDue = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + termDays
  );

  const { data: duplicatedInvoice, error: duplicateError } = await supabase
    .from("invoices")
    .insert({
      company_id: companyId,
      customer_id: invoice.customer_id,
      invoice_number: String(invoiceNumberData),
      issue_date: today.toISOString().slice(0, 10),
      due_date: duplicatedDue.toISOString().slice(0, 10),
      status: "draft",
      currency: invoice.currency,
      discount_amount: invoice.discount_amount,
      payment_terms: invoice.payment_terms,
      notes: invoice.notes,
      footer_note: invoice.footer_note,
      created_by: user.id,
    })
    .select("id, invoice_number")
    .single();

  if (duplicateError || !duplicatedInvoice) {
    redirectWithMessage(
      "error",
      duplicateError?.message || "Unable to duplicate the invoice."
    );
  }

  const { error: duplicateItemsError } = await supabase
    .from("invoice_items")
    .insert(
      items.map((item) => ({ invoice_id: duplicatedInvoice.id, ...item }))
    );

  if (duplicateItemsError) {
    await supabase
      .from("invoices")
      .delete()
      .eq("id", duplicatedInvoice.id)
      .eq("company_id", companyId);
    redirectWithMessage("error", "Unable to duplicate invoice items.");
  }

  const { error: recalculateError } = await supabase.rpc(
    "recalculate_invoice_totals",
    {
      target_invoice_id: duplicatedInvoice.id,
    }
  );

  if (recalculateError) {
    redirectWithMessage(
      "error",
      recalculateError.message ||
        "The invoice was duplicated, but its totals could not be refreshed."
    );
  }

  await emitEvent({
    companyId,
    actorId: user.id,
    recipients: [user.id],
    type: "invoice_duplicated",
    title: "Invoice duplicated",
    message: `${invoice.invoice_number} was duplicated as ${duplicatedInvoice.invoice_number}.`,
    actionUrl: "/dashboard/invoices",
    referenceType: "invoice",
    referenceId: duplicatedInvoice.id,
    severity: "success",
    metadata: {
      sourceInvoiceId: invoiceId,
      sourceInvoiceNumber: invoice.invoice_number,
      duplicatedInvoiceId: duplicatedInvoice.id,
      duplicatedInvoiceNumber: duplicatedInvoice.invoice_number,
      customerId: invoice.customer_id,
      currency: invoice.currency,
      itemCount: items.length,
      newStatus: "draft",
    },
  });

  revalidatePath("/dashboard/invoices");
  redirectWithMessage(
    "success",
    `${duplicatedInvoice.invoice_number} was created as a draft.`
  );
}

async function recordPayment(formData: FormData) {
  "use server";

  const { supabase } = await getAdminContext();
  const invoiceId = cleanText(formData.get("invoice_id"));
  const accountId = cleanText(formData.get("account_id"));
  const amount = cleanNumber(formData.get("amount"), 0);
  const paymentDate =
    cleanText(formData.get("payment_date")) || new Date().toISOString();
  const paymentMethod = cleanText(formData.get("payment_method"));
  const reference = cleanText(formData.get("reference"));
  const notes = cleanText(formData.get("notes"));

  if (!invoiceId || !accountId) {
    redirectWithMessage("error", "Select an invoice and receiving account.");
  }
  if (amount <= 0) {
    redirectWithMessage("error", "Payment amount must be greater than zero.");
  }

  const { error } = await supabase.rpc("record_invoice_payment", {
    p_invoice_id: invoiceId,
    p_account_id: accountId,
    p_amount: amount,
    p_payment_date: paymentDate,
    p_payment_method: paymentMethod,
    p_reference: reference,
    p_notes: notes,
  });

  if (error) {
    redirectWithMessage(
      "error",
      error.message || "Unable to record the payment."
    );
  }

  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");
  redirectWithMessage("success", "Invoice payment was recorded successfully.");
}

async function refreshOverdueInvoices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  actorId: string
) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: newlyOverdueInvoices, error: lookupError } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, customer_id, due_date, currency, total_amount, balance_due, status"
    )
    .eq("company_id", companyId)
    .lt("due_date", today)
    .in("status", ["sent", "viewed"])
    .gt("balance_due", 0);

  if (lookupError || !newlyOverdueInvoices?.length) {
    return;
  }

  const overdueIds = newlyOverdueInvoices.map((invoice) => invoice.id);

  const { error: updateError } = await supabase
    .from("invoices")
    .update({ status: "overdue" })
    .eq("company_id", companyId)
    .in("id", overdueIds);

  if (updateError) {
    console.error(
      "[Invoices] Unable to refresh overdue invoices:",
      updateError
    );
    return;
  }

  for (const invoice of newlyOverdueInvoices) {
    await emitEvent({
      companyId,
      actorId,
      recipients: [actorId],
      type: "invoice_overdue",
      title: "Invoice overdue",
      message: `${invoice.invoice_number} is overdue with ${Number(
        invoice.balance_due || 0
      ).toFixed(2)} ${invoice.currency} outstanding.`,
      actionUrl: "/dashboard/invoices",
      referenceType: "invoice",
      referenceId: invoice.id,
      severity: "warning",
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        customerId: invoice.customer_id,
        dueDate: invoice.due_date,
        currency: invoice.currency,
        totalAmount: Number(invoice.total_amount || 0),
        balanceDue: Number(invoice.balance_due || 0),
        previousStatus: invoice.status,
        newStatus: "overdue",
      },
    });
  }

  revalidatePath("/dashboard/activity");
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const { supabase, user, profile, companyId } = await getAdminContext();

  await refreshOverdueInvoices(supabase, companyId, user.id);

  const [
    { data: companyData, error: companyError },
    { data: customerRows, error: customerError },
    { data: productRows, error: productError },
    { data: accountRows, error: accountError },
    { data: ledgerRows, error: ledgerError },
    { data: invoiceRows, error: invoiceError },
    { data: itemRows, error: itemError },
    { data: paymentRows, error: paymentError },
    notifications,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, currency")
      .eq("id", companyId)
      .single(),
    supabase
      .from("customers")
      .select("id, name, company_name, email, phone")
      .eq("company_id", companyId)
      .order("name", { ascending: true }),
    supabase
      .from("products")
      .select(
        "id, name, item_name, sku, selling_price, price_per_piece, quantity_on_hand, stock_quantity"
      )
      .eq("company_id", companyId)
      .order("item_name", { ascending: true }),
    supabase
      .from("cash_accounts")
      .select("id, name, account_type, currency, opening_balance, status")
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("name", { ascending: true }),
    supabase
      .from("cash_ledger")
      .select("account_id, direction, amount")
      .eq("company_id", companyId)
      .eq("status", "completed"),
    supabase
      .from("invoices")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase.from("invoice_items").select("*").order("sort_order", {
      ascending: true,
    }),
    supabase
      .from("invoice_payments")
      .select("*")
      .eq("company_id", companyId)
      .order("payment_date", { ascending: false }),
    getUserNotifications(user.id),
  ]);

  const company = companyData as CompanyRow | null;
  const customers = (customerRows ?? []) as CustomerRow[];
  const products = (productRows ?? []) as ProductRow[];
  const accounts = (accountRows ?? []) as CashAccountRow[];
  const ledger = (ledgerRows ?? []) as CashLedgerRow[];
  const invoices = (invoiceRows ?? []) as InvoiceRow[];
  const items = (itemRows ?? []) as InvoiceItemRow[];
  const payments = (paymentRows ?? []) as InvoicePaymentRow[];

  const loadError =
    companyError?.message ||
    customerError?.message ||
    productError?.message ||
    accountError?.message ||
    ledgerError?.message ||
    invoiceError?.message ||
    itemError?.message ||
    paymentError?.message ||
    undefined;

  const customerMap = new Map(customers.map((customer) => [customer.id, customer]));
  const itemsByInvoice = new Map<string, InvoiceItem[]>();

  for (const item of items) {
    const list = itemsByInvoice.get(item.invoice_id) ?? [];
    list.push({
      id: item.id,
      productId: item.product_id,
      description: item.description,
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unit_price || 0),
      discountAmount: Number(item.discount_amount || 0),
      taxRate: Number(item.tax_rate || 0),
      taxAmount: Number(item.tax_amount || 0),
      lineSubtotal: Number(item.line_subtotal || 0),
      lineTotal: Number(item.line_total || 0),
      sortOrder: Number(item.sort_order || 0),
    });
    itemsByInvoice.set(item.invoice_id, list);
  }

  const paymentsByInvoice = new Map<string, InvoicePayment[]>();
  for (const payment of payments) {
    const list = paymentsByInvoice.get(payment.invoice_id) ?? [];
    list.push({
      id: payment.id,
      accountId: payment.account_id,
      amount: Number(payment.amount || 0),
      paymentDate: payment.payment_date,
      paymentMethod: payment.payment_method,
      reference: payment.reference,
      notes: payment.notes,
    });
    paymentsByInvoice.set(payment.invoice_id, list);
  }

  const accountBalanceMap = new Map<string, number>();
  for (const account of accounts) {
    accountBalanceMap.set(account.id, Number(account.opening_balance || 0));
  }
  for (const row of ledger) {
    if (!row.account_id) continue;
    const current = accountBalanceMap.get(row.account_id) || 0;
    const amount = Number(row.amount || 0);
    accountBalanceMap.set(
      row.account_id,
      row.direction === "inflow" ? current + amount : current - amount
    );
  }

  const clientCustomers: InvoiceCustomer[] = customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    companyName: customer.company_name,
    email: customer.email,
    phone: customer.phone,
  }));

  const clientProducts: InvoiceProduct[] = products.map((product) => ({
    id: product.id,
    name: product.item_name || product.name || product.sku || "Unnamed product",
    sku: product.sku,
    sellingPrice: Number(product.selling_price || product.price_per_piece || 0),
    availableStock: Number(
      product.quantity_on_hand || product.stock_quantity || 0
    ),
  }));

  const clientAccounts: InvoiceAccount[] = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    accountType: account.account_type,
    currency: account.currency,
    balance:
      Math.round((accountBalanceMap.get(account.id) || 0) * 100) / 100,
  }));

  const clientInvoices: Invoice[] = invoices.map((invoice) => {
    const customer = customerMap.get(invoice.customer_id);
    return {
      id: invoice.id,
      customerId: invoice.customer_id,
      customerName: customer?.name || "Unknown customer",
      customerCompany: customer?.company_name || null,
      customerEmail: customer?.email || null,
      invoiceNumber: invoice.invoice_number,
      issueDate: invoice.issue_date,
      dueDate: invoice.due_date,
      status: invoice.status,
      currency: invoice.currency,
      subtotal: Number(invoice.subtotal || 0),
      discountAmount: Number(invoice.discount_amount || 0),
      taxAmount: Number(invoice.tax_amount || 0),
      totalAmount: Number(invoice.total_amount || 0),
      paidAmount: Number(invoice.paid_amount || 0),
      balanceDue: Number(invoice.balance_due || 0),
      paymentTerms: invoice.payment_terms,
      notes: invoice.notes,
      footerNote: invoice.footer_note,
      sentAt: invoice.sent_at,
      viewedAt: invoice.viewed_at,
      paidAt: invoice.paid_at,
      cancelledAt: invoice.cancelled_at,
      createdAt: invoice.created_at,
      updatedAt: invoice.updated_at,
      items: itemsByInvoice.get(invoice.id) ?? [],
      payments: paymentsByInvoice.get(invoice.id) ?? [],
    };
  });

  return (
    <AdminShell
      title="Invoices"
      adminName={profile.full_name || profile.email || user.email || "Founder"}
      adminRole="Founder"
      showPageHeader={false}
      notifications={notifications ?? []}
      userId={user.id}
    >
      <InvoicesClient
        companyName={company?.name || "Company"}
        currency={company?.currency || "USD"}
        customers={clientCustomers}
        products={clientProducts}
        accounts={clientAccounts}
        invoices={clientInvoices}
        error={params.error || loadError}
        success={params.success}
        createInvoice={createInvoice}
        importInvoices={importInvoices}
        updateInvoice={updateInvoice}
        markInvoiceSent={markInvoiceSent}
        cancelInvoice={cancelInvoice}
        restoreInvoice={restoreInvoice}
        deleteInvoice={deleteInvoice}
        duplicateInvoice={duplicateInvoice}
        recordPayment={recordPayment}
      />
    </AdminShell>
  );
}