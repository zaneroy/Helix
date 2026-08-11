/* ============================================================
   HELIX IMPORT / EXPORT ENGINE
   Inventory Schema
   ============================================================ */

import type { ImportSchema } from "@/lib/import-export/types";

export const inventoryImportSchema: ImportSchema = {
  module: "inventory",
  displayName: "Inventory",
  fileName: "helix-inventory-template.csv",

  columns: [
    {
      key: "sku",
      label: "SKU",
      type: "string",
      required: true,
      example: "SKU-1001",
    },
    {
      key: "name",
      label: "Product Name",
      type: "string",
      required: true,
      example: "Sterling Silver Chain",
    },
    {
      key: "category",
      label: "Category",
      type: "string",
      required: false,
      example: "Necklaces",
    },
    {
      key: "supplier",
      label: "Supplier",
      type: "string",
      required: false,
      example: "Premium Silver Ltd",
    },
    {
      key: "quantity",
      label: "Quantity",
      type: "number",
      required: true,
      example: "50",
    },
    {
      key: "cost_price",
      label: "Cost Price",
      type: "currency",
      required: true,
      example: "18.50",
    },
    {
      key: "selling_price",
      label: "Selling Price",
      type: "currency",
      required: true,
      example: "44.99",
    },
    {
      key: "reorder_level",
      label: "Reorder Level",
      type: "number",
      required: false,
      example: "10",
    },
    {
      key: "location",
      label: "Location",
      type: "string",
      required: false,
      example: "Warehouse A",
    },
    {
      key: "status",
      label: "Status",
      type: "string",
      required: true,
      example: "Active",
      options: ["Active", "Inactive"],
    },
  ],
};