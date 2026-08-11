/* ============================================================
   HELIX IMPORT / EXPORT ENGINE
   CSV Validator
   ============================================================ */

import type {
  ImportSchema,
  ParsedRow,
  ValidationError,
  ValidationResult,
  ValidationWarning,
  TemplateColumn,
} from "@/lib/import-export/types";

import {
  normalizeDate,
  normalizeNumber,
  normalizeString,
  isEmpty,
} from "@/lib/import-export/utils";

/* ============================================================
   Helpers
============================================================ */

function getColumn(
  schema: ImportSchema,
  label: string
): TemplateColumn | undefined {
  return schema.columns.find((c) => c.label === label);
}

function validateRequired(
  row: ParsedRow,
  column: TemplateColumn,
  value: unknown,
  errors: ValidationError[]
) {
  if (!column.required) return;

  if (isEmpty(value)) {
    errors.push({
      row: row.rowNumber,
      column: column.label,
      value,
      message: `${column.label} is required.`,
    });
  }
}

function validateNumber(
  row: ParsedRow,
  column: TemplateColumn,
  value: unknown,
  errors: ValidationError[]
) {
  if (isEmpty(value)) return;

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    errors.push({
      row: row.rowNumber,
      column: column.label,
      value,
      message: `${column.label} must be a valid number.`,
    });
  }
}

function validateCurrency(
  row: ParsedRow,
  column: TemplateColumn,
  value: unknown,
  errors: ValidationError[]
) {
  if (isEmpty(value)) return;

  const normalizedValue = String(value)
    .replace(/[$£€,]/g, "")
    .trim();

  const parsed = Number(normalizedValue);

  if (!Number.isFinite(parsed)) {
    errors.push({
      row: row.rowNumber,
      column: column.label,
      value,
      message: `${column.label} must be a valid currency value.`,
    });

    return;
  }

  if (parsed < 0) {
    errors.push({
      row: row.rowNumber,
      column: column.label,
      value,
      message: `${column.label} cannot be negative.`,
    });
  }
}

function validateDate(
  row: ParsedRow,
  column: TemplateColumn,
  value: unknown,
  errors: ValidationError[]
) {
  if (isEmpty(value)) return;

  const normalized = normalizeDate(value);

  if (!normalized) {
    errors.push({
      row: row.rowNumber,
      column: column.label,
      value,
      message:
        `${column.label} must use YYYY-MM-DD format.`,
    });
  }
}

function validateBoolean(
  row: ParsedRow,
  column: TemplateColumn,
  value: unknown,
  errors: ValidationError[]
) {
  if (isEmpty(value)) return;

  const normalized = normalizeString(value).toLowerCase();

  const allowed = [
    "true",
    "false",
    "yes",
    "no",
    "1",
    "0",
  ];

  if (!allowed.includes(normalized)) {
    errors.push({
      row: row.rowNumber,
      column: column.label,
      value,
      message:
        `${column.label} must be True or False.`,
    });
  }
}

function validateEmail(
  row: ParsedRow,
  column: TemplateColumn,
  value: unknown,
  errors: ValidationError[]
) {
  if (isEmpty(value)) return;

  const email = normalizeString(value);

  const regex =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!regex.test(email)) {
    errors.push({
      row: row.rowNumber,
      column: column.label,
      value,
      message: `${column.label} is not a valid email.`,
    });
  }
}

function validateOptions(
  row: ParsedRow,
  column: TemplateColumn,
  value: unknown,
  errors: ValidationError[]
) {
  if (!column.options) return;

  if (isEmpty(value)) return;

  const normalized = normalizeString(value);

  const found = column.options.some(
    (option) =>
      option.toLowerCase() === normalized.toLowerCase()
  );

  if (!found) {
    errors.push({
      row: row.rowNumber,
      column: column.label,
      value,
      message:
        `${column.label} must be one of: ` +
        column.options.join(", "),
    });
  }
}

/* ============================================================
   Duplicate Detection
============================================================ */

function detectDuplicateRows(
  rows: ParsedRow[],
  errors: ValidationError[]
) {
  const seen = new Map<string, number>();

  for (const row of rows) {
    const signature = JSON.stringify(row.values);

    const existing = seen.get(signature);

    if (existing) {
      errors.push({
        row: row.rowNumber,
        column: "",
        value: "",
        message: `Duplicate of row ${existing}.`,
      });

      continue;
    }

    seen.set(signature, row.rowNumber);
  }
}

/* ============================================================
   Main Validator
============================================================ */

export function validateRows(
  schema: ImportSchema,
  rows: ParsedRow[]
): ValidationResult {

  const errors: ValidationError[] = [];

  const warnings: ValidationWarning[] = [];

  for (const row of rows) {

    for (const column of schema.columns) {

      const value = row.values[column.label];

      validateRequired(
        row,
        column,
        value,
        errors
      );

      switch (column.type) {

        case "number":
          validateNumber(
            row,
            column,
            value,
            errors
          );
          break;

        case "currency":
          validateCurrency(
            row,
            column,
            value,
            errors
          );
          break;

        case "date":
          validateDate(
            row,
            column,
            value,
            errors
          );
          break;

        case "boolean":
          validateBoolean(
            row,
            column,
            value,
            errors
          );
          break;

        case "email":
          validateEmail(
            row,
            column,
            value,
            errors
          );
          break;
      }

      validateOptions(
        row,
        column,
        value,
        errors
      );
    }
  }

  detectDuplicateRows(rows, errors);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}