/* ============================================================
   HELIX IMPORT / EXPORT ENGINE
   Schema Registry
   ============================================================ */

import type {
  ImportModule,
  ImportSchema,
} from "@/lib/import-export/types";

import { expensesImportSchema } from "./expenses";
import { inventoryImportSchema } from "./inventory";
import { salesImportSchema } from "./sales";
import { invoicesImportSchema } from "./invoices";

export {
  expensesImportSchema,
  inventoryImportSchema,
  salesImportSchema,
  invoicesImportSchema,
};

export const importSchemas: Record<ImportModule, ImportSchema> = {
  expenses: expensesImportSchema,
  inventory: inventoryImportSchema,
  sales: salesImportSchema,
  invoices: invoicesImportSchema,
};

export function getImportSchema(
  module: ImportModule
): ImportSchema {
  const schema = importSchemas[module];

  if (!schema) {
    throw new Error(
      `No import schema has been registered for "${module}".`
    );
  }

  return schema;
}