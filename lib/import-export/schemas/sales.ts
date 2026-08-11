/* ============================================================
   HELIX IMPORT / EXPORT ENGINE
   Sales Schema
   ============================================================ */

import type { ImportSchema } from "@/lib/import-export/types";

export const salesImportSchema: ImportSchema = {
  module: "sales",
  displayName: "Sales",
  fileName: "helix-sales-template.csv",

  columns: [
    {
      key: "sale_date",
      label: "Sale Date",
      type: "date",
      required: true,
      example: "2026-07-25",
    },
    {
      key: "reference",
      label: "Sale Reference",
      type: "string",
      required: true,
      example: "SALE-1001",
    },
    {
      key: "customer",
      label: "Customer",
      type: "string",
      required: false,
      example: "John Smith",
    },
    {
      key: "sku",
      label: "SKU",
      type: "string",
      required: true,
      example: "SKU-1001",
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
      key: "discount",
      label: "Discount",
      type: "currency",
      required: false,
      example: "5.00",
    },
    {
      key: "tax",
      label: "Tax",
      type: "currency",
      required: false,
      example: "4.25",
    },
    {
      key: "payment_method",
      label: "Payment Method",
      type: "string",
      required: false,
      example: "Card",
    },
    {
      key: "account",
      label: "Account",
      type: "string",
      required: true,
      example: "Business Checking",
    },
    {
      key: "notes",
      label: "Notes",
      type: "string",
      required: false,
      example: "Online order",
    },
  ],
};