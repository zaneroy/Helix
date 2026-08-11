/* ============================================================
   HELIX IMPORT / EXPORT ENGINE
   Expenses Schema
   ============================================================ */

import type { ImportSchema } from "@/lib/import-export/types";

export const expensesImportSchema: ImportSchema = {
  module: "expenses",
  displayName: "Expenses",
  fileName: "helix-expenses-template.csv",

  columns: [
    {
      key: "expense_date",
      label: "Expense Date",
      type: "date",
      required: true,
      example: "2026-07-25",
    },
    {
      key: "title",
      label: "Title",
      type: "string",
      required: true,
      example: "Office printer paper",
    },
    {
      key: "category",
      label: "Category",
      type: "string",
      required: true,
      example: "Office Supplies",
    },
    {
      key: "payee",
      label: "Payee",
      type: "string",
      required: false,
      example: "Staples",
    },
    {
      key: "amount",
      label: "Amount",
      type: "currency",
      required: true,
      example: "52.99",
    },
    {
      key: "payment_method",
      label: "Payment Method",
      type: "string",
      required: false,
      example: "Business Card",
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
      example: "Monthly office supplies",
    },
  ],
};