/* ============================================================
   HELIX IMPORT / EXPORT ENGINE
   Invoices Importer
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
   Invoice Import Types
============================================================ */

export type InvoiceImportStatus =
  | "draft"
  | "sent";

export type InvoiceImportItem = {
  productId?: string | null;
  productName?: string;
  sku?: string;

  description: string;

  quantity: number;
  unitPrice: number;

  discountAmount: number;
  taxRate: number;
};

export type InvoiceImportData = {
  invoiceNumber: string;

  customerId: string;
  customerName: string;
  customerEmail?: string;

  issueDate: string;
  dueDate: string;

  currency?: string;
  status: InvoiceImportStatus;
  paymentTerms?: string;

  discountAmount: number;

  notes?: string;
  footerNote?: string;

  items: InvoiceImportItem[];
};

/* ============================================================
   Existing Invoice Workflow Result
============================================================ */

export type CreateInvoiceResult = {
  success: boolean;
  invoiceId?: string;
  skipped?: boolean;
  message?: string;
};

/* ============================================================
   Importer Dependencies
============================================================ */

export type InvoicesImporterDependencies = {
  /**
   * Calls the existing complete invoice creation workflow.
   *
   * That workflow should handle:
   * - invoice creation
   * - invoice item creation
   * - total recalculation
   * - events and notifications
   * - any other invoice business logic
   */
  createInvoice: (
    invoice: InvoiceImportData
  ) => Promise<CreateInvoiceResult>;

  /**
   * Resolves a customer name/email to an existing customer ID.
   */
  resolveCustomer: (
    customer: {
      name: string;
      email?: string;
    }
  ) => Promise<string | null>;

  /**
   * Optionally resolves an imported product name or SKU.
   */
  resolveProduct?: (
    product: {
      name?: string;
      sku?: string;
    }
  ) => Promise<string | null>;

  /**
   * Optional duplicate detector.
   *
   * This should normally check invoice_number within the current
   * company.
   */
  findDuplicate?: (
    invoice: InvoiceImportData
  ) => Promise<boolean>;

  /**
   * When true, a product name or SKU must match an existing
   * product.
   *
   * When false or omitted, unmatched rows remain custom invoice
   * lines.
   */
  requireProductMatch?: boolean;

  /**
   * Runs once after the complete import has finished.
   */
  afterImport?: (
    result: ImportHandlerResult
  ) => Promise<void>;
};

/* ============================================================
   Internal Grouped Row
============================================================ */

type GroupedInvoiceRow =
  TransformedRow & {
    __invoice_items: InvoiceImportItem[];
  };

/* ============================================================
   Value Helpers
============================================================ */

function requiredString(
  row: TransformedRow,
  key: string
): string {
  const value = row[key];

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

function optionalString(
  row: TransformedRow,
  key: string
): string | undefined {
  const value =
    requiredString(row, key);

  return value || undefined;
}

function requiredNumber(
  row: TransformedRow,
  key: string
): number {
  const value = row[key];

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
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

function normalizeStatus(
  value: unknown
): InvoiceImportStatus {
  const normalized =
    String(value ?? "")
      .trim()
      .toLowerCase();

  return normalized === "sent"
    ? "sent"
    : "draft";
}

function normalizeComparisonValue(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .trim()
    .toLowerCase();
}

function isValidDate(
  value: string
): boolean {
  if (!value) {
    return false;
  }

  return !Number.isNaN(
    new Date(value).getTime()
  );
}

/* ============================================================
   Tax Compatibility
============================================================ */

/**
 * Prefer tax_rate from the updated schema.
 *
 * The fallback supports the older tax column, where tax was
 * supplied as a monetary amount.
 */
function getTaxRate(
  row: TransformedRow,
  quantity: number,
  unitPrice: number,
  discountAmount: number
): number {
  const explicitTaxRate =
    optionalNumber(
      row,
      "tax_rate"
    );

  if (
    explicitTaxRate !== undefined
  ) {
    return explicitTaxRate;
  }

  const taxAmount =
    optionalNumber(
      row,
      "tax"
    );

  if (
    taxAmount === undefined ||
    taxAmount <= 0
  ) {
    return 0;
  }

  const taxableAmount =
    Math.max(
      quantity * unitPrice -
        discountAmount,
      0
    );

  if (taxableAmount <= 0) {
    return 0;
  }

  return Number(
    (
      (taxAmount / taxableAmount) *
      100
    ).toFixed(4)
  );
}

/* ============================================================
   Line Item Mapping
============================================================ */

function mapInvoiceItem(
  row: TransformedRow
): InvoiceImportItem {
  const quantity =
    requiredNumber(
      row,
      "quantity"
    );

  const unitPrice =
    requiredNumber(
      row,
      "unit_price"
    );

  const discountAmount =
    optionalNumber(
      row,
      "line_discount"
    ) ??
    optionalNumber(
      row,
      "discount_amount"
    ) ??
    0;

  const productName =
    optionalString(
      row,
      "product"
    );

  const sku =
    optionalString(
      row,
      "sku"
    );

  return {
    productName,
    sku,

    description:
      requiredString(
        row,
        "description"
      ) ||
      productName ||
      "",

    quantity,
    unitPrice,
    discountAmount,

    taxRate: getTaxRate(
      row,
      quantity,
      unitPrice,
      discountAmount
    ),
  };
}

/* ============================================================
   Grouped Invoice Helpers
============================================================ */

function getGroupedItems(
  row: TransformedRow
): InvoiceImportItem[] {
  const groupedItems =
    (
      row as GroupedInvoiceRow
    ).__invoice_items;

  if (!Array.isArray(groupedItems)) {
    return [];
  }

  return groupedItems;
}

function mapGroupedInvoice(
  row: TransformedRow
): InvoiceImportData {
  return {
    invoiceNumber:
      requiredString(
        row,
        "invoice_number"
      ),

    customerId:
      requiredString(
        row,
        "customer_id"
      ),

    customerName:
      requiredString(
        row,
        "customer"
      ),

    customerEmail:
      optionalString(
        row,
        "customer_email"
      ),

    issueDate:
      requiredString(
        row,
        "issue_date"
      ),

    dueDate:
      requiredString(
        row,
        "due_date"
      ),

    currency:
      optionalString(
        row,
        "currency"
      ),

    status:
      normalizeStatus(
        row["status"]
      ),

    paymentTerms:
      optionalString(
        row,
        "payment_terms"
      ),

    discountAmount:
      optionalNumber(
        row,
        "invoice_discount"
      ) ??
      0,

    notes:
      optionalString(
        row,
        "notes"
      ),

    footerNote:
      optionalString(
        row,
        "footer_note"
      ),

    items:
      getGroupedItems(row),
  };
}

/* ============================================================
   Invoice-Level Consistency
============================================================ */

const INVOICE_LEVEL_KEYS = [
  "customer",
  "customer_email",
  "issue_date",
  "due_date",
  "currency",
  "status",
  "payment_terms",
  "invoice_discount",
  "notes",
  "footer_note",
] as const;

function getGroupConflict(
  invoiceNumber: string,
  rows: TransformedRow[]
): string | null {
  const firstRow = rows[0];

  if (!firstRow) {
    return `Invoice "${invoiceNumber}" has no rows.`;
  }

  for (
    const key of
    INVOICE_LEVEL_KEYS
  ) {
    const expected =
      normalizeComparisonValue(
        firstRow[key]
      );

    for (
      let index = 1;
      index < rows.length;
      index++
    ) {
      const current =
        normalizeComparisonValue(
          rows[index][key]
        );

      if (current !== expected) {
        return (
          `Invoice "${invoiceNumber}" contains ` +
          `conflicting values for "${key}".`
        );
      }
    }
  }

  return null;
}

/* ============================================================
   Grouping Result
============================================================ */

type InvoiceGroupingResult = {
  groupedRows: GroupedInvoiceRow[];
  invalidGroups: number;
};

/* ============================================================
   Group Invoice Rows
============================================================ */

function groupInvoiceRows(
  rows: TransformedRow[]
): InvoiceGroupingResult {
  const groups =
    new Map<
      string,
      TransformedRow[]
    >();

  let missingInvoiceIndex = 0;

  for (const row of rows) {
    const invoiceNumber =
      requiredString(
        row,
        "invoice_number"
      );

    let groupKey =
      invoiceNumber
        .trim()
        .toLowerCase();

    if (!groupKey) {
      missingInvoiceIndex += 1;

      groupKey =
        `__missing_invoice_${missingInvoiceIndex}`;
    }

    const existingRows =
      groups.get(groupKey) ?? [];

    existingRows.push(row);

    groups.set(
      groupKey,
      existingRows
    );
  }

  const groupedRows:
    GroupedInvoiceRow[] = [];

  let invalidGroups = 0;

  for (
    const [
      groupKey,
      groupRows,
    ] of groups
  ) {
    const firstRow =
      groupRows[0];

    if (!firstRow) {
      invalidGroups += 1;
      continue;
    }

    const invoiceNumber =
      requiredString(
        firstRow,
        "invoice_number"
      );

    /*
     * A missing invoice number is retained as a grouped row so
     * importRow can count it as a normal failed invoice.
     */
    if (!invoiceNumber) {
      groupedRows.push({
        ...firstRow,
        invoice_number: groupKey,
        __invoice_items:
          groupRows.map(
            mapInvoiceItem
          ),
      });

      continue;
    }

    const conflict =
      getGroupConflict(
        invoiceNumber,
        groupRows
      );

    if (conflict) {
      console.error(
        "Helix Invoice Group Conflict:",
        conflict
      );

      invalidGroups += 1;
      continue;
    }

    groupedRows.push({
      ...firstRow,

      invoice_number:
        invoiceNumber,

      __invoice_items:
        groupRows.map(
          mapInvoiceItem
        ),
    });
  }

  return {
    groupedRows,
    invalidGroups,
  };
}

/* ============================================================
   Invoices Importer
============================================================ */

export class InvoicesImporter
  extends BaseImporter {
  private readonly dependencies:
    InvoicesImporterDependencies;

  private latestResult:
    ImportHandlerResult = {
      imported: 0,
      failed: 0,
      skipped: 0,
    };

  constructor(
    dependencies:
      InvoicesImporterDependencies
  ) {
    super();

    this.dependencies =
      dependencies;
  }

  /* ----------------------------------------------------------
     Duplicate Detection
  ---------------------------------------------------------- */

  protected async checkDuplicate(
    row: TransformedRow
  ): Promise<DuplicateCheckResult> {
    if (
      !this.dependencies
        .findDuplicate
    ) {
      return {
        duplicate: false,
      };
    }

    const invoice =
      mapGroupedInvoice(row);

    const duplicate =
      await this.dependencies
        .findDuplicate(invoice);

    return {
      duplicate,

      reason: duplicate
        ? `Invoice "${invoice.invoiceNumber}" already exists.`
        : undefined,
    };
  }

  /* ----------------------------------------------------------
     Relationship Resolution
  ---------------------------------------------------------- */

  protected async resolveRelations(
    row: TransformedRow
  ): Promise<TransformedRow> {
    const resolvedRow:
      GroupedInvoiceRow = {
      ...row,

      __invoice_items:
        getGroupedItems(row).map(
          (item) => ({
            ...item,
          })
        ),
    };

    const customerName =
      requiredString(
        row,
        "customer"
      );

    const customerEmail =
      optionalString(
        row,
        "customer_email"
      );

    if (!customerName) {
      throw new Error(
        "Customer is missing."
      );
    }

    const customerId =
      await this.dependencies
        .resolveCustomer({
          name: customerName,
          email: customerEmail,
        });

    if (!customerId) {
      const customerDescription =
        customerEmail
          ? `"${customerName}" (${customerEmail})`
          : `"${customerName}"`;

      throw new Error(
        `Customer ${customerDescription} could not be resolved.`
      );
    }

    resolvedRow["customer_id"] =
      customerId;

    if (
      this.dependencies
        .resolveProduct
    ) {
      for (
        const item of
        resolvedRow.__invoice_items
      ) {
        const hasProductReference =
          Boolean(
            item.productName ||
            item.sku
          );

        /*
         * Rows without a product or SKU are valid custom invoice
         * lines and do not require product resolution.
         */
        if (!hasProductReference) {
          continue;
        }

        const productId =
          await this.dependencies
            .resolveProduct({
              name:
                item.productName,
              sku:
                item.sku,
            });

        if (
          !productId &&
          this.dependencies
            .requireProductMatch
        ) {
          const reference =
            item.sku ||
            item.productName ||
            "Unknown product";

          throw new Error(
            `Product "${reference}" could not be resolved.`
          );
        }

        item.productId =
          productId;
      }
    }

    return resolvedRow;
  }

  /* ----------------------------------------------------------
     Invoice Validation and Creation
  ---------------------------------------------------------- */

  protected async importRow(
    row: TransformedRow
  ): Promise<RowImportResult> {
    const invoice =
      mapGroupedInvoice(row);

    if (
      !invoice.invoiceNumber ||
      invoice.invoiceNumber
        .startsWith(
          "__missing_invoice_"
        )
    ) {
      return {
        success: false,
        reason:
          "Invoice number is missing.",
      };
    }

    if (!invoice.customerName) {
      return {
        success: false,
        reason:
          "Customer is missing.",
      };
    }

    if (!invoice.customerId) {
      return {
        success: false,
        reason:
          "Customer could not be resolved.",
      };
    }

    if (!invoice.issueDate) {
      return {
        success: false,
        reason:
          "Issue date is missing.",
      };
    }

    if (
      !isValidDate(
        invoice.issueDate
      )
    ) {
      return {
        success: false,
        reason:
          "Issue date is invalid.",
      };
    }

    if (!invoice.dueDate) {
      return {
        success: false,
        reason:
          "Due date is missing.",
      };
    }

    if (
      !isValidDate(
        invoice.dueDate
      )
    ) {
      return {
        success: false,
        reason:
          "Due date is invalid.",
      };
    }

    const issueTimestamp =
      new Date(
        invoice.issueDate
      ).getTime();

    const dueTimestamp =
      new Date(
        invoice.dueDate
      ).getTime();

    if (
      dueTimestamp <
      issueTimestamp
    ) {
      return {
        success: false,
        reason:
          "Due date cannot be before the issue date.",
      };
    }

    if (
      !Number.isFinite(
        invoice.discountAmount
      ) ||
      invoice.discountAmount < 0
    ) {
      return {
        success: false,
        reason:
          "Invoice discount cannot be negative.",
      };
    }

    if (
      invoice.items.length === 0
    ) {
      return {
        success: false,
        reason:
          "Invoice has no line items.",
      };
    }

    for (
      let index = 0;
      index < invoice.items.length;
      index++
    ) {
      const item =
        invoice.items[index];

      const lineNumber =
        index + 1;

      if (
        !item.description.trim()
      ) {
        return {
          success: false,
          reason:
            `Line ${lineNumber} is missing a description.`,
        };
      }

      if (
        !Number.isFinite(
          item.quantity
        ) ||
        item.quantity <= 0
      ) {
        return {
          success: false,
          reason:
            `Line ${lineNumber} quantity must be greater than zero.`,
        };
      }

      if (
        !Number.isFinite(
          item.unitPrice
        ) ||
        item.unitPrice < 0
      ) {
        return {
          success: false,
          reason:
            `Line ${lineNumber} unit price cannot be negative.`,
        };
      }

      if (
        !Number.isFinite(
          item.discountAmount
        ) ||
        item.discountAmount < 0
      ) {
        return {
          success: false,
          reason:
            `Line ${lineNumber} discount cannot be negative.`,
        };
      }

      const lineSubtotal =
        item.quantity *
        item.unitPrice;

      if (
        item.discountAmount >
        lineSubtotal
      ) {
        return {
          success: false,
          reason:
            `Line ${lineNumber} discount cannot exceed the line subtotal.`,
        };
      }

      if (
        !Number.isFinite(
          item.taxRate
        ) ||
        item.taxRate < 0
      ) {
        return {
          success: false,
          reason:
            `Line ${lineNumber} tax rate cannot be negative.`,
        };
      }
    }

    const result =
      await this.dependencies
        .createInvoice(invoice);

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
          "The invoice was skipped.",
      };
    }

    return {
      success: false,

      reason:
        result.message ||
        "The invoice could not be created.",
    };
  }

  /* ----------------------------------------------------------
     Main Import Override
  ---------------------------------------------------------- */

  async import(
    rows: TransformedRow[]
  ): Promise<ImportHandlerResult> {
    const groupingResult =
      groupInvoiceRows(rows);

    const baseResult =
      await super.import(
        groupingResult.groupedRows
      );

    const result:
      ImportHandlerResult = {
        imported:
          baseResult.imported,

        skipped:
          baseResult.skipped,

        failed:
          baseResult.failed +
          groupingResult.invalidGroups,
      };

    this.latestResult =
      result;

    if (
      this.dependencies
        .afterImport
    ) {
      await this.dependencies
        .afterImport(result);
    }

    return result;
  }

  /* ----------------------------------------------------------
     Base Hook
  ---------------------------------------------------------- */

  protected async afterImport(
    _importedRows: number
  ): Promise<void> {
    /*
     * The complete import summary is handled in import(), because
     * BaseImporter.afterImport receives only the imported count.
     */
  }

  getResult():
    ImportHandlerResult {
    return this.latestResult;
  }
}

/* ============================================================
   Factory
============================================================ */

export function createInvoicesImporter(
  dependencies:
    InvoicesImporterDependencies
): ImportHandler {
  const importer =
    new InvoicesImporter(
      dependencies
    );

  return async (
    rows: TransformedRow[]
  ): Promise<ImportHandlerResult> => {
    return importer.import(rows);
  };
}