/* ============================================================
   HELIX IMPORT / EXPORT ENGINE
   Row Transformer
   ============================================================ */

import type {
  ImportSchema,
  ParsedRow,
} from "@/lib/import-export/types";

import {
  normalizeDate,
  normalizeNumber,
  normalizeString,
} from "@/lib/import-export/utils";

export type TransformedRow = Record<string, unknown>;

function transformValue(
  type: string,
  value: unknown
): unknown {

  switch (type) {

    case "string":
      return normalizeString(value);

    case "number":
      return normalizeNumber(value);

    case "currency":
      return normalizeNumber(value);

    case "date":
      return normalizeDate(value);

    case "boolean": {

      const normalized =
        normalizeString(value).toLowerCase();

      return (
        normalized === "true" ||
        normalized === "yes" ||
        normalized === "1"
      );
    }

    case "email":
      return normalizeString(value).toLowerCase();

    default:
      return value;
  }
}

export function transformRow(
  schema: ImportSchema,
  row: ParsedRow
): TransformedRow {

  const transformed: TransformedRow = {};

  for (const column of schema.columns) {

    const rawValue = row.values[column.label];

    transformed[column.key] =
      transformValue(
        column.type,
        rawValue
      );
  }

  return transformed;
}

export function transformRows(
  schema: ImportSchema,
  rows: ParsedRow[]
): TransformedRow[] {

  return rows.map(row =>
    transformRow(schema, row)
  );
}