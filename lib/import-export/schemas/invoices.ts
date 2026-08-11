/* ============================================================
   HELIX IMPORT / EXPORT ENGINE
   Invoices Schema
   ============================================================ */

import type { ImportSchema } from "@/lib/import-export/types";

export const invoicesImportSchema: ImportSchema = {
  module: "invoices",
  displayName: "Invoices",
  fileName: "helix-invoices-template.csv",

  columns: [
    {
      key: "invoice_number",
      label: "Invoice Number",
      type: "string",
      required: true,
      example: "INV-1001",
    },
    {
      key: "customer",
      label: "Customer",
      type: "string",
      required: true,
      example: "John Smith",
    },
    {
      key: "customer_email",
      label: "Customer Email",
      type: "email",
      required: false,
      example: "john@example.com",
    },
    {
      key: "issue_date",
      label: "Issue Date",
      type: "date",
      required: true,
      example: "2026-07-25",
    },
    {
      key: "due_date",
      label: "Due Date",
      type: "date",
      required: true,
      example: "2026-08-24",
    },
    {
      key: "currency",
      label: "Currency",
      type: "string",
      required: false,
      example: "USD",
    },
    {
      key: "status",
      label: "Status",
      type: "string",
      required: true,
      example: "Draft",
      options: ["Draft", "Sent"],
    },
    {
      key: "payment_terms",
      label: "Payment Terms",
      type: "string",
      required: false,
      example: "Net 30",
      options: [
        "Due on receipt",
        "Net 7",
        "Net 14",
        "Net 30",
        "Net 45",
        "Net 60",
      ],
    },
    {
      key: "invoice_discount",
      label: "Invoice Discount",
      type: "currency",
      required: false,
      example: "0.00",
    },
    {
      key: "product",
      label: "Product",
      type: "string",
      required: false,
      example: "Sterling Silver Chain",
    },
    {
      key: "sku",
      label: "SKU",
      type: "string",
      required: false,
      example: "SSC-001",
    },
    {
      key: "description",
      label: "Description",
      type: "string",
      required: true,
      example: "Sterling Silver Chain",
    },
    {
      key: "quantity",
      label: "Quantity",
      type: "number",
      required: true,
      example: "2",
    },
    {
      key: "unit_price",
      label: "Unit Price",
      type: "currency",
      required: true,
      example: "44.99",
    },
    {
      key: "line_discount",
      label: "Line Discount",
      type: "currency",
      required: false,
      example: "0.00",
    },
    {
      key: "tax_rate",
      label: "Tax Rate",
      type: "number",
      required: false,
      example: "13",
    },
    {
      key: "notes",
      label: "Notes",
      type: "string",
      required: false,
      example: "Payment due within 30 days",
    },
    {
      key: "footer_note",
      label: "Footer Note",
      type: "string",
      required: false,
      example: "Thank you for your business.",
    },
  ],
};