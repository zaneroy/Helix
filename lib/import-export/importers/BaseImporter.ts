/* ============================================================
   HELIX IMPORT / EXPORT ENGINE
   Base Importer
   ============================================================ */

import type {
  TransformedRow,
} from "@/lib/import-export/parser/rowTransformer";

import type {
  ImportHandlerResult,
} from "@/lib/import-export/parser/importRunner";

/* ============================================================
   Duplicate Check Result
============================================================ */

export interface DuplicateCheckResult {
  duplicate: boolean;
  reason?: string;
}

/* ============================================================
   Import Result
============================================================ */

export interface RowImportResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
}

/* ============================================================
   Base Importer
============================================================ */

export abstract class BaseImporter {

  /* ----------------------------------------------------------
     Hook Methods
  ---------------------------------------------------------- */

  /**
   * Override if duplicates should be detected.
   */
  protected async checkDuplicate(
    row: TransformedRow
  ): Promise<DuplicateCheckResult> {

    return {
      duplicate: false,
    };

  }

  /**
   * Override if relationships need resolving.
   *
   * Examples:
   * - Category
   * - Account
   * - Customer
   * - Supplier
   */
  protected async resolveRelations(
    row: TransformedRow
  ): Promise<TransformedRow> {

    return row;

  }

  /**
   * Every module MUST implement this.
   */
  protected abstract importRow(
    row: TransformedRow
  ): Promise<RowImportResult>;

  /**
   * Optional after-import hook.
   */
  protected async afterImport(
    importedRows: number
  ): Promise<void> {}

  /* ----------------------------------------------------------
     Main Import Runner
  ---------------------------------------------------------- */

  async import(
    rows: TransformedRow[]
  ): Promise<ImportHandlerResult> {

    let imported = 0;
    let failed = 0;
    let skipped = 0;

    for (const originalRow of rows) {

      try {

        const duplicate =
          await this.checkDuplicate(
            originalRow
          );

        if (duplicate.duplicate) {

          skipped++;

          continue;

        }

        const row =
          await this.resolveRelations(
            originalRow
          );

        const result =
          await this.importRow(row);

        if (result.success) {

          imported++;

          continue;

        }

        if (result.skipped) {

          skipped++;

          continue;

        }

        failed++;

      } catch (error) {

        console.error(
          "Helix Import Error",
          error
        );

        failed++;

      }

    }

    await this.afterImport(
      imported
    );

    return {

      imported,

      failed,

      skipped,

    };

  }

}