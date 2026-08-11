/* ============================================================
   HELIX IMPORT / EXPORT ENGINE
   CSV Exporter
   ============================================================ */

import type {
  ImportSchema,
  TemplateColumn,
} from "@/lib/import-export/types";

import { downloadBlob } from "@/lib/import-export/utils";

export type ExportRecord = Record<string, unknown>;

export type CsvExportOptions = {
  /**
   * Optional custom filename.
   * When omitted, Helix derives one from the schema.
   */
  fileName?: string;

  /**
   * Whether to include the schema's example row.
   * Normally false for real exports.
   */
  includeExampleRow?: boolean;

  /**
   * Include UTF-8 BOM for stronger Excel compatibility.
   */
  includeBom?: boolean;
};

/* ============================================================
   CSV Value Formatting
============================================================ */

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let text: string;

  if (value instanceof Date) {
    text = value.toISOString().slice(0, 10);
  } else if (typeof value === "boolean") {
    text = value ? "True" : "False";
  } else {
    text = String(value);
  }

  const escaped = text.replace(/"/g, '""');

  const requiresQuotes =
    escaped.includes(",") ||
    escaped.includes('"') ||
    escaped.includes("\n") ||
    escaped.includes("\r") ||
    escaped.startsWith(" ") ||
    escaped.endsWith(" ");

  return requiresQuotes ? `"${escaped}"` : escaped;
}

function formatDateValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const parsed = new Date(text);

  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return parsed.toISOString().slice(0, 10);
}

function formatNumberValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/[$£€,]/g, "").trim());

  return Number.isFinite(parsed) ? String(parsed) : String(value);
}

function formatBooleanValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }

  const normalized = String(value).trim().toLowerCase();

  if (["true", "yes", "1"].includes(normalized)) {
    return "True";
  }

  if (["false", "no", "0"].includes(normalized)) {
    return "False";
  }

  return String(value);
}

function formatExportValue(
  column: TemplateColumn,
  value: unknown
): string {
  switch (column.type) {
    case "date":
      return formatDateValue(value);

    case "number":
    case "currency":
      return formatNumberValue(value);

    case "boolean":
      return formatBooleanValue(value);

    default:
      return value === null || value === undefined
        ? ""
        : String(value);
  }
}

/* ============================================================
   Record Resolution
============================================================ */

/**
 * Supports both:
 *
 * Internal keys:
 * { expense_date: "2026-07-25", amount: 52.99 }
 *
 * CSV labels:
 * { "Expense Date": "2026-07-25", Amount: 52.99 }
 */
function getRecordValue(
  record: ExportRecord,
  column: TemplateColumn
): unknown {
  if (
    Object.prototype.hasOwnProperty.call(record, column.key)
  ) {
    return record[column.key];
  }

  if (
    Object.prototype.hasOwnProperty.call(record, column.label)
  ) {
    return record[column.label];
  }

  return "";
}

/* ============================================================
   CSV Construction
============================================================ */

function buildHeaderRow(schema: ImportSchema): string {
  return schema.columns
    .map((column) => escapeCsvValue(column.label))
    .join(",");
}

function buildExampleRow(schema: ImportSchema): string {
  return schema.columns
    .map((column) => escapeCsvValue(column.example ?? ""))
    .join(",");
}

function buildDataRow(
  schema: ImportSchema,
  record: ExportRecord
): string {
  return schema.columns
    .map((column) => {
      const rawValue = getRecordValue(record, column);
      const formattedValue = formatExportValue(
        column,
        rawValue
      );

      return escapeCsvValue(formattedValue);
    })
    .join(",");
}

export function generateCsvExport(
  schema: ImportSchema,
  records: ExportRecord[],
  options: CsvExportOptions = {}
): string {
  const lines: string[] = [];

  lines.push(buildHeaderRow(schema));

  if (options.includeExampleRow) {
    lines.push(buildExampleRow(schema));
  }

  for (const record of records) {
    lines.push(buildDataRow(schema, record));
  }

  const csv = lines.join("\n");

  return options.includeBom === false
    ? csv
    : `\uFEFF${csv}`;
}

/* ============================================================
   Filename
============================================================ */

function createExportFilename(
  schema: ImportSchema
): string {
  const date = new Date().toISOString().slice(0, 10);

  return `helix-${schema.module}-export-${date}.csv`;
}

/* ============================================================
   Browser Download
============================================================ */

export function downloadCsvExport(
  schema: ImportSchema,
  records: ExportRecord[],
  options: CsvExportOptions = {}
): void {
  const csv = generateCsvExport(
    schema,
    records,
    options
  );

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8",
  });

  downloadBlob(
    blob,
    options.fileName || createExportFilename(schema)
  );
}