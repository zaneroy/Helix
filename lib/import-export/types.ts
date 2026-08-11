/* ============================================================
   HELIX IMPORT / EXPORT ENGINE
   Shared Types
   ============================================================ */

export type ImportModule =
  | "expenses"
  | "inventory"
  | "sales"
  | "invoices";

export type ImportStatus =
  | "pending"
  | "validating"
  | "validated"
  | "importing"
  | "completed"
  | "failed";

export type ColumnType =
  | "string"
  | "number"
  | "date"
  | "boolean"
  | "currency"
  | "email"
  | "uuid";

export interface TemplateColumn {
  /**
   * Internal field name
   * Example:
   * amount
   */
  key: string;

  /**
   * CSV Column Heading
   * Example:
   * Amount
   */
  label: string;

  /**
   * Data type
   */
  type: ColumnType;

  /**
   * Is this field mandatory?
   */
  required: boolean;

  /**
   * Example value shown inside template
   */
  example?: string | number | boolean;

  /**
   * Optional dropdown values
   */
  options?: readonly string[];
}

export interface ImportSchema {
  module: ImportModule;

  displayName: string;

  fileName: string;

  columns: TemplateColumn[];
}

export interface ParsedRow {
  rowNumber: number;

  values: Record<string, unknown>;
}

export interface ValidationError {
  row: number;

  column: string;

  value: unknown;

  message: string;
}

export interface ValidationWarning {
  row: number;

  column: string;

  value: unknown;

  message: string;
}

export interface ValidationResult {
  valid: boolean;

  errors: ValidationError[];

  warnings: ValidationWarning[];
}

export interface ImportSummary {
  totalRows: number;

  validRows: number;

  invalidRows: number;

  warningRows: number;
}

export interface ImportResult<T = unknown> {
  success: boolean;

  imported: number;

  failed: number;

  skipped: number;

  data: T[];

  errors: ValidationError[];
}

export interface ImportHistory {
  id: string;

  module: ImportModule;

  filename: string;

  importedBy: string;

  importedAt: string;

  durationMs: number;

  totalRows: number;

  importedRows: number;

  failedRows: number;

  status: ImportStatus;
}