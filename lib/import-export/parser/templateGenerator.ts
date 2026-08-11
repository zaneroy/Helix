/* ============================================================
   HELIX IMPORT / EXPORT ENGINE
   Template Generator
   ============================================================ */

import type {
  ImportSchema,
  TemplateColumn,
} from "@/lib/import-export/types";

/* ============================================================
   Escape CSV Values
============================================================ */

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  const needsQuotes =
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n");

  if (!needsQuotes) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

/* ============================================================
   Build Header Row
============================================================ */

function buildHeader(columns: TemplateColumn[]): string {

  return columns
    .map(column => escapeCsvValue(column.label))
    .join(",");
}

/* ============================================================
   Build Example Row
============================================================ */

function buildExample(columns: TemplateColumn[]): string {

  return columns
    .map(column => escapeCsvValue(column.example ?? ""))
    .join(",");
}

/* ============================================================
   Generate CSV
============================================================ */

export function generateTemplate(
  schema: ImportSchema
): string {

  const lines: string[] = [];

  lines.push(buildHeader(schema.columns));

  lines.push(buildExample(schema.columns));

  return lines.join("\n");
}

/* ============================================================
   Download Template
============================================================ */

export function downloadTemplate(
  schema: ImportSchema
) {

  const csv = generateTemplate(schema);

  const blob = new Blob(
    [csv],
    {
      type: "text/csv;charset=utf-8;",
    }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download = schema.fileName;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}