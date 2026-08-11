/* ============================================================
   HELIX IMPORT / EXPORT ENGINE
   Import Runner
   ============================================================ */

import type {
  ImportSchema,
  ParsedRow,
  ValidationResult,
} from "@/lib/import-export/types";

import { parseCsvFile } from "./csvParser";
import { validateRows } from "./csvValidator";
import {
  transformRows,
  TransformedRow,
} from "./rowTransformer";

/* ============================================================
   Module Import Handler
============================================================ */

export type ImportHandlerResult = {
  imported: number;
  failed: number;
  skipped: number;
};

export type ImportHandler = (
  rows: TransformedRow[]
) => Promise<ImportHandlerResult>;

/* ============================================================
   Runner Result
============================================================ */

export interface ImportRunnerResult {

  success: boolean;

  parsedRows: ParsedRow[];

  transformedRows: TransformedRow[];

  validation: ValidationResult;

  importResult?: ImportHandlerResult;

}

/* ============================================================
   Validate Only
============================================================ */

export async function validateImport(

  file: File,

  schema: ImportSchema

): Promise<ImportRunnerResult> {

  const parsed = await parseCsvFile(file);

  if (!parsed.success) {

    return {

      success: false,

      parsedRows: [],

      transformedRows: [],

      validation: {

        valid: false,

        errors: parsed.errors.map(error => ({

          row: error.row ?? 0,

          column: "",

          value: "",

          message: error.message,

        })),

        warnings: [],

      },

    };

  }

  const validation =
    validateRows(
      schema,
      parsed.rows
    );

  const transformedRows =
    transformRows(
      schema,
      parsed.rows
    );

  return {

    success: validation.valid,

    parsedRows: parsed.rows,

    transformedRows,

    validation,

  };

}

/* ============================================================
   Full Import
============================================================ */

export async function runImport(

  file: File,

  schema: ImportSchema,

  importer: ImportHandler

): Promise<ImportRunnerResult> {

  const validationResult =
    await validateImport(
      file,
      schema
    );

  if (
    !validationResult.success
  ) {

    return validationResult;

  }

  const result =
    await importer(
      validationResult.transformedRows
    );

  return {

    ...validationResult,

    importResult: result,

  };

}