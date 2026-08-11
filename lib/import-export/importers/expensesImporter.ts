/* ============================================================
   HELIX IMPORT / EXPORT ENGINE
   Expenses Importer
   ============================================================ */

import {
  BaseImporter,
  type DuplicateCheckResult,
  type RowImportResult,
} from "./BaseImporter";

import type {
  TransformedRow,
} from "@/lib/import-export/parser/rowTransformer";

import type {
  ImportHandler,
  ImportHandlerResult,
} from "@/lib/import-export/parser/importRunner";

/* ============================================================
   Expense Import Data
============================================================ */

export type ExpenseImportData = {
  expenseDate: string;
  title: string;
  description?: string;
  category?: string;
  amount: number;
  paymentMethod?: string;
  account?: string;
  vendor?: string;
  reference?: string;
  taxAmount?: number;
  status?: string;
  notes?: string;
};

/* ============================================================
   Existing Expense Business Logic Result
============================================================ */

export type CreateExpenseResult = {
  success: boolean;
  expenseId?: string;
  skipped?: boolean;
  message?: string;
};

/* ============================================================
   Importer Dependencies
============================================================ */

export type ExpensesImporterDependencies = {
  /**
   * Must call the same complete expense workflow used when an
   * expense is created manually.
   *
   * This should handle:
   * - expense creation
   * - ledger posting
   * - account balance updates
   * - activity events
   * - notifications
   * - report/dashboard refresh triggers
   */
  createExpense: (
    expense: ExpenseImportData
  ) => Promise<CreateExpenseResult>;

  /**
   * Optional duplicate detector.
   *
   * Prefer checking a stable reference when supplied. Otherwise,
   * compare the date, title, amount and vendor.
   */
  findDuplicate?: (
    expense: ExpenseImportData
  ) => Promise<boolean>;

  /**
   * Optional category resolver.
   *
   * It can return a category ID, canonical category name, or any
   * value expected by the existing creation workflow.
   */
  resolveCategory?: (
    category: string
  ) => Promise<string | null>;

  /**
   * Optional account resolver.
   */
  resolveAccount?: (
    account: string
  ) => Promise<string | null>;

  /**
   * Called once after all rows finish processing.
   *
   * Use this for one dashboard refresh, report refresh, cache
   * invalidation or import-summary event instead of doing those
   * operations repeatedly for every row.
   */
  afterImport?: (
    result: ImportHandlerResult
  ) => Promise<void>;
};

/* ============================================================
   Helpers
============================================================ */

function requiredString(
  row: TransformedRow,
  key: string
): string {
  const value = row[key];

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function optionalString(
  row: TransformedRow,
  key: string
): string | undefined {
  const value = requiredString(row, key);

  return value || undefined;
}

function requiredNumber(
  row: TransformedRow,
  key: string
): number {
  const value = row[key];

  if (typeof value === "number") {
    return value;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(
  row: TransformedRow,
  key: string
): number | undefined {
  const value = row[key];

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return undefined;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : undefined;
}

/**
 * Converts transformed schema fields into the object expected by
 * the existing expense creation workflow.
 *
 * Update the keys here only when your expenses schema uses
 * different internal field names.
 */
function mapExpenseRow(
  row: TransformedRow
): ExpenseImportData {
  return {
    expenseDate:
      requiredString(row, "expense_date") ||
      requiredString(row, "date"),

    title:
      requiredString(row, "title") ||
      requiredString(row, "expense_name"),

    description: optionalString(row, "description"),
    category: optionalString(row, "category"),

    amount: requiredNumber(row, "amount"),

    paymentMethod:
      optionalString(row, "payment_method"),

    account: optionalString(row, "account"),
    vendor: optionalString(row, "vendor"),
    reference: optionalString(row, "reference"),

    taxAmount:
      optionalNumber(row, "tax_amount"),

    status: optionalString(row, "status"),
    notes: optionalString(row, "notes"),
  };
}

/* ============================================================
   Expenses Importer
============================================================ */

export class ExpensesImporter extends BaseImporter {
  private readonly dependencies: ExpensesImporterDependencies;

  private latestResult: ImportHandlerResult = {
    imported: 0,
    failed: 0,
    skipped: 0,
  };

  constructor(
    dependencies: ExpensesImporterDependencies
  ) {
    super();

    this.dependencies = dependencies;
  }

  /* ----------------------------------------------------------
     Duplicate Detection
  ---------------------------------------------------------- */

  protected async checkDuplicate(
    row: TransformedRow
  ): Promise<DuplicateCheckResult> {
    if (!this.dependencies.findDuplicate) {
      return {
        duplicate: false,
      };
    }

    const expense = mapExpenseRow(row);

    const duplicate =
      await this.dependencies.findDuplicate(expense);

    return {
      duplicate,
      reason: duplicate
        ? "A matching expense already exists."
        : undefined,
    };
  }

  /* ----------------------------------------------------------
     Relationship Resolution
  ---------------------------------------------------------- */

  protected async resolveRelations(
    row: TransformedRow
  ): Promise<TransformedRow> {
    const resolvedRow: TransformedRow = {
      ...row,
    };

    const category =
      optionalString(row, "category");

    if (
      category &&
      this.dependencies.resolveCategory
    ) {
      const resolvedCategory =
        await this.dependencies.resolveCategory(
          category
        );

      if (!resolvedCategory) {
        throw new Error(
          `Expense category "${category}" could not be resolved.`
        );
      }

      resolvedRow.category =
        resolvedCategory;
    }

    const account =
      optionalString(row, "account");

    if (
      account &&
      this.dependencies.resolveAccount
    ) {
      const resolvedAccount =
        await this.dependencies.resolveAccount(
          account
        );

      if (!resolvedAccount) {
        throw new Error(
          `Expense account "${account}" could not be resolved.`
        );
      }

      resolvedRow.account =
        resolvedAccount;
    }

    return resolvedRow;
  }

  /* ----------------------------------------------------------
     Expense Creation
  ---------------------------------------------------------- */

  protected async importRow(
    row: TransformedRow
  ): Promise<RowImportResult> {
    const expense = mapExpenseRow(row);

    if (!expense.expenseDate) {
      return {
        success: false,
        reason: "Expense date is missing.",
      };
    }

    if (!expense.title) {
      return {
        success: false,
        reason: "Expense title is missing.",
      };
    }

    if (
      !Number.isFinite(expense.amount) ||
      expense.amount <= 0
    ) {
      return {
        success: false,
        reason:
          "Expense amount must be greater than zero.",
      };
    }

    const result =
      await this.dependencies.createExpense(
        expense
      );

    if (result.success) {
      return {
        success: true,
      };
    }

    if (result.skipped) {
      return {
        success: false,
        skipped: true,
        reason:
          result.message ||
          "The expense was skipped.",
      };
    }

    return {
      success: false,
      reason:
        result.message ||
        "The expense could not be created.",
    };
  }

  /* ----------------------------------------------------------
     Main Import Override
  ---------------------------------------------------------- */

  async import(
    rows: TransformedRow[]
  ): Promise<ImportHandlerResult> {
    const result = await super.import(rows);

    this.latestResult = result;

    if (this.dependencies.afterImport) {
      await this.dependencies.afterImport(
        result
      );
    }

    return result;
  }

  /* ----------------------------------------------------------
     Base Hook
  ---------------------------------------------------------- */

  protected async afterImport(): Promise<void> {
    /*
     * The final summary hook is called from the import override
     * because BaseImporter.afterImport currently receives only
     * the imported count, while Helix needs the complete summary.
     */
  }

  getResult(): ImportHandlerResult {
    return this.latestResult;
  }
}

/* ============================================================
   Factory
============================================================ */

export function createExpensesImporter(
  dependencies: ExpensesImporterDependencies
): ImportHandler {
  const importer =
    new ExpensesImporter(dependencies);

  return async (
    rows: TransformedRow[]
  ): Promise<ImportHandlerResult> => {
    return importer.import(rows);
  };
}