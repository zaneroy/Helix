"use client";

/* ============================================================
   HELIX IMPORT / EXPORT ENGINE
   Shared Import Modal
   ============================================================ */

import {
  ChangeEvent,
  DragEvent,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";

import type {
  ImportSchema,
  ValidationError,
  ValidationWarning,
} from "@/lib/import-export/types";

import type {
  ImportHandlerResult,
} from "@/lib/import-export/parser/importRunner";

import type {
  TransformedRow,
} from "@/lib/import-export/parser/rowTransformer";

import {
  validateImport,
} from "@/lib/import-export/parser/importRunner";

import {
  downloadTemplate,
} from "@/lib/import-export/parser/templateGenerator";

type ImportStep =
  | "upload"
  | "preview"
  | "importing"
  | "complete";

export type ImportModalProps = {
  open: boolean;
  schema: ImportSchema;
  onClose: () => void;

  /**
   * Module-specific import function.
   *
   * This will later connect to:
   * - expensesImporter
   * - inventoryImporter
   * - salesImporter
   * - invoicesImporter
   */
  onImport: (
    rows: TransformedRow[]
  ) => Promise<ImportHandlerResult>;
};

const MAX_PREVIEW_ROWS = 25;

function getRowIssueCount(
  rowNumber: number,
  issues: Array<ValidationError | ValidationWarning>
) {
  return issues.filter((issue) => issue.row === rowNumber).length;
}

function getFileSizeLabel(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function displayCellValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

export default function ImportModal({
  open,
  schema,
  onClose,
  onImport,
}: ImportModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<ImportStep>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(
    null
  );
  const [dragActive, setDragActive] = useState(false);
  const [validating, setValidating] = useState(false);

  const [rows, setRows] = useState<TransformedRow[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [warnings, setWarnings] = useState<
    ValidationWarning[]
  >([]);

  const [importResult, setImportResult] =
    useState<ImportHandlerResult | null>(null);

  const [generalError, setGeneralError] = useState<string | null>(
    null
  );

  const previewRows = useMemo(
    () => rows.slice(0, MAX_PREVIEW_ROWS),
    [rows]
  );

  const invalidRowNumbers = useMemo(
    () =>
      new Set(
        errors
          .map((error) => error.row)
          .filter((rowNumber) => rowNumber > 0)
      ),
    [errors]
  );

  const validRowCount = Math.max(
    rows.length - invalidRowNumbers.size,
    0
  );

  function resetModal() {
    setStep("upload");
    setSelectedFile(null);
    setDragActive(false);
    setValidating(false);
    setRows([]);
    setErrors([]);
    setWarnings([]);
    setImportResult(null);
    setGeneralError(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleClose() {
    if (step === "importing") {
      return;
    }

    resetModal();
    onClose();
  }

  async function processFile(file: File) {
    setSelectedFile(file);
    setGeneralError(null);
    setErrors([]);
    setWarnings([]);
    setRows([]);
    setValidating(true);

    try {
      const result = await validateImport(file, schema);

      setRows(result.transformedRows);
      setErrors(result.validation.errors);
      setWarnings(result.validation.warnings);
      setStep("preview");
    } catch (error) {
      setGeneralError(
        error instanceof Error
          ? error.message
          : "Helix could not validate this CSV."
      );
    } finally {
      setValidating(false);
    }
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (file) {
      void processFile(file);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      void processFile(file);
    }
  }

  async function handleImport() {
    if (errors.length > 0 || rows.length === 0) {
      return;
    }

    setStep("importing");
    setGeneralError(null);

    try {
      const result = await onImport(rows);

      setImportResult(result);
      setStep("complete");
    } catch (error) {
      setGeneralError(
        error instanceof Error
          ? error.message
          : `Helix could not import the ${schema.displayName.toLowerCase()}.`
      );

      setStep("preview");
    }
  }

  function chooseAnotherFile() {
    setStep("upload");
    setSelectedFile(null);
    setRows([]);
    setErrors([]);
    setWarnings([]);
    setGeneralError(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="helix-import-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#061012] shadow-2xl shadow-black/60">
        <header className="flex items-start justify-between border-b border-white/8 px-6 py-5 sm:px-8">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-teal-400">
              Helix data import
            </p>

            <h2
              id="helix-import-title"
              className="text-xl font-semibold text-white sm:text-2xl"
            >
              Import {schema.displayName}
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
              Use the official Helix template so your data can be
              validated and imported safely.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={step === "importing"}
            className="rounded-xl border border-white/10 p-2 text-white/50 transition hover:border-white/20 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Close import modal"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <ImportProgressHeader step={step} />

        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          {generalError ? (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-4 text-sm text-red-100">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />

              <div>
                <p className="font-semibold">
                  Something went wrong
                </p>
                <p className="mt-1 text-red-100/70">
                  {generalError}
                </p>
              </div>
            </div>
          ) : null}

          {step === "upload" ? (
            <UploadStep
              schema={schema}
              inputRef={inputRef}
              dragActive={dragActive}
              validating={validating}
              onFileChange={handleFileChange}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            />
          ) : null}

          {step === "preview" ? (
            <PreviewStep
              schema={schema}
              file={selectedFile}
              rows={previewRows}
              totalRows={rows.length}
              errors={errors}
              warnings={warnings}
              validRowCount={validRowCount}
              onChooseAnotherFile={chooseAnotherFile}
            />
          ) : null}

          {step === "importing" ? (
            <ImportingStep
              moduleName={schema.displayName}
              totalRows={rows.length}
            />
          ) : null}

          {step === "complete" && importResult ? (
            <CompleteStep
              moduleName={schema.displayName}
              result={importResult}
            />
          ) : null}
        </main>

        <footer className="flex flex-col-reverse gap-3 border-t border-white/8 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            {step === "preview" ? (
              <button
                type="button"
                onClick={chooseAnotherFile}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/5 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Choose another file
              </button>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            {step !== "complete" ? (
              <button
                type="button"
                onClick={handleClose}
                disabled={step === "importing"}
                className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-white/70 transition hover:border-white/20 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancel
              </button>
            ) : null}

            {step === "preview" ? (
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={
                  errors.length > 0 ||
                  rows.length === 0
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-400 px-5 py-2.5 text-sm font-bold text-[#021011] transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
              >
                <Upload className="h-4 w-4" />

                {errors.length > 0
                  ? "Resolve errors before importing"
                  : `Import ${rows.length.toLocaleString(
                      "en-US"
                    )} rows`}
              </button>
            ) : null}

            {step === "complete" ? (
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-400 px-6 py-2.5 text-sm font-bold text-[#021011] transition hover:bg-teal-300"
              >
                <Check className="h-4 w-4" />
                Done
              </button>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ============================================================
   Progress Header
============================================================ */

function ImportProgressHeader({
  step,
}: {
  step: ImportStep;
}) {
  const activeIndex =
    step === "upload"
      ? 0
      : step === "preview"
        ? 1
        : step === "importing"
          ? 2
          : 3;

  const steps = [
    "Upload",
    "Validate & Preview",
    "Import",
    "Complete",
  ];

  return (
    <div className="border-b border-white/8 px-6 py-4 sm:px-8">
      <div className="grid grid-cols-4 gap-2">
        {steps.map((label, index) => {
          const complete = index < activeIndex;
          const active = index === activeIndex;

          return (
            <div key={label}>
              <div
                className={`h-1 rounded-full transition ${
                  complete || active
                    ? "bg-teal-400"
                    : "bg-white/10"
                }`}
              />

              <p
                className={`mt-2 truncate text-[11px] font-semibold sm:text-xs ${
                  active
                    ? "text-white"
                    : complete
                      ? "text-teal-300"
                      : "text-white/30"
                }`}
              >
                {label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Upload Step
============================================================ */

function UploadStep({
  schema,
  inputRef,
  dragActive,
  validating,
  onFileChange,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  schema: ImportSchema;
  inputRef: React.RefObject<HTMLInputElement | null>;
  dragActive: boolean;
  validating: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-5 sm:p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-teal-400/20 bg-teal-400/10">
          <Download className="h-5 w-5 text-teal-300" />
        </div>

        <h3 className="mt-5 text-lg font-semibold text-white">
          1. Download the template
        </h3>

        <p className="mt-2 text-sm leading-6 text-white/50">
          Keep the column headings unchanged. Replace the example
          row with your own {schema.displayName.toLowerCase()} data.
        </p>

        <button
          type="button"
          onClick={() => downloadTemplate(schema)}
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-teal-400/25 bg-teal-400/10 px-4 py-2.5 text-sm font-semibold text-teal-200 transition hover:border-teal-400/40 hover:bg-teal-400/15"
        >
          <Download className="h-4 w-4" />
          Download {schema.displayName} Template
        </button>

        <div className="mt-6 space-y-3 border-t border-white/8 pt-5 text-xs text-white/40">
          <p>CSV format only</p>
          <p>Maximum 10,000 rows</p>
          <p>Maximum file size 25 MB</p>
          <p>Dates must use YYYY-MM-DD</p>
        </div>
      </section>

      <section>
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`flex min-h-[350px] flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center transition ${
            dragActive
              ? "border-teal-400 bg-teal-400/8"
              : "border-white/15 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.035]"
          }`}
        >
          {validating ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-teal-300" />

              <h3 className="mt-5 text-lg font-semibold text-white">
                Validating your CSV
              </h3>

              <p className="mt-2 text-sm text-white/45">
                Helix is checking columns, formats and row data.
              </p>
            </>
          ) : (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <FileSpreadsheet className="h-7 w-7 text-teal-300" />
              </div>

              <h3 className="mt-5 text-lg font-semibold text-white">
                2. Upload your completed CSV
              </h3>

              <p className="mt-2 max-w-sm text-sm leading-6 text-white/45">
                Drag and drop the completed Helix template here, or
                choose it from your computer.
              </p>

              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={onFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black transition hover:bg-white/90"
              >
                <Upload className="h-4 w-4" />
                Choose CSV File
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/* ============================================================
   Preview Step
============================================================ */

function PreviewStep({
  schema,
  file,
  rows,
  totalRows,
  errors,
  warnings,
  validRowCount,
  onChooseAnotherFile,
}: {
  schema: ImportSchema;
  file: File | null;
  rows: TransformedRow[];
  totalRows: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  validRowCount: number;
  onChooseAnotherFile: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/8 bg-white/[0.025] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-400/10">
            <FileSpreadsheet className="h-5 w-5 text-teal-300" />
          </div>

          <div className="min-w-0">
            <p className="truncate font-semibold text-white">
              {file?.name || "Selected CSV"}
            </p>

            <p className="mt-1 text-xs text-white/40">
              {file ? getFileSizeLabel(file.size) : ""}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onChooseAnotherFile}
          className="text-sm font-semibold text-teal-300 transition hover:text-teal-200"
        >
          Replace file
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Rows detected"
          value={totalRows}
          tone="neutral"
        />

        <SummaryCard
          label="Valid rows"
          value={validRowCount}
          tone="success"
        />

        <SummaryCard
          label="Errors"
          value={errors.length}
          tone={errors.length > 0 ? "danger" : "neutral"}
        />
      </div>

      {errors.length > 0 ? (
        <IssuePanel
          title="Errors must be corrected"
          description="Update the indicated rows in your CSV and upload the file again."
          issues={errors}
          tone="danger"
        />
      ) : (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/8 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />

          <div>
            <p className="text-sm font-semibold text-emerald-100">
              Validation passed
            </p>
            <p className="mt-1 text-sm text-emerald-100/60">
              All {totalRows.toLocaleString("en-US")} rows are ready
              to import.
            </p>
          </div>
        </div>
      )}

      {warnings.length > 0 ? (
        <IssuePanel
          title="Warnings"
          description="These rows can still be imported, but should be reviewed."
          issues={warnings}
          tone="warning"
        />
      ) : null}

      <div>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h3 className="font-semibold text-white">
              Import preview
            </h3>

            <p className="mt-1 text-xs text-white/40">
              Showing the first{" "}
              {Math.min(totalRows, MAX_PREVIEW_ROWS)} of{" "}
              {totalRows.toLocaleString("en-US")} rows.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/8">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead className="bg-white/[0.04]">
                <tr>
                  <th className="whitespace-nowrap border-b border-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40">
                    Row
                  </th>

                  {schema.columns.map((column) => (
                    <th
                      key={column.key}
                      className="whitespace-nowrap border-b border-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40"
                    >
                      {column.label}
                    </th>
                  ))}

                  <th className="whitespace-nowrap border-b border-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, index) => {
                  const csvRowNumber = index + 2;

                  const rowErrorCount = getRowIssueCount(
                    csvRowNumber,
                    errors
                  );

                  const rowWarningCount = getRowIssueCount(
                    csvRowNumber,
                    warnings
                  );

                  return (
                    <tr
                      key={`${csvRowNumber}-${index}`}
                      className="border-b border-white/5 last:border-b-0"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-white/35">
                        {csvRowNumber}
                      </td>

                      {schema.columns.map((column) => (
                        <td
                          key={column.key}
                          className="max-w-[260px] truncate whitespace-nowrap px-4 py-3 text-sm text-white/70"
                          title={displayCellValue(
                            row[column.key]
                          )}
                        >
                          {displayCellValue(row[column.key])}
                        </td>
                      ))}

                      <td className="whitespace-nowrap px-4 py-3">
                        {rowErrorCount > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-400/10 px-2.5 py-1 text-xs font-semibold text-red-300">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {rowErrorCount} error
                            {rowErrorCount === 1 ? "" : "s"}
                          </span>
                        ) : rowWarningCount > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Warning
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                            <Check className="h-3.5 w-3.5" />
                            Valid
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={schema.columns.length + 2}
                      className="px-4 py-12 text-center text-sm text-white/40"
                    >
                      No data rows were found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Importing Step
============================================================ */

function ImportingStep({
  moduleName,
  totalRows,
}: {
  moduleName: string;
  totalRows: number;
}) {
  return (
    <div className="flex min-h-[430px] flex-col items-center justify-center text-center">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-teal-400/20 bg-teal-400/10">
        <Loader2 className="h-9 w-9 animate-spin text-teal-300" />
      </div>

      <h3 className="mt-7 text-xl font-semibold text-white">
        Importing {moduleName}
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-white/45">
        Helix is processing{" "}
        {totalRows.toLocaleString("en-US")} rows and applying the
        relevant financial workflows.
      </p>

      <div className="mt-8 w-full max-w-md space-y-3 text-left">
        {[
          "Writing validated records",
          "Updating financial data",
          "Refreshing dashboard and reports",
          "Recording activity",
        ].map((label, index) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3"
          >
            {index === 0 ? (
              <Loader2 className="h-4 w-4 animate-spin text-teal-300" />
            ) : (
              <div className="h-4 w-4 rounded-full border border-white/15" />
            )}

            <span className="text-sm text-white/60">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Complete Step
============================================================ */

function CompleteStep({
  moduleName,
  result,
}: {
  moduleName: string;
  result: ImportHandlerResult;
}) {
  const fullySuccessful =
    result.failed === 0 && result.imported > 0;

  return (
    <div className="flex min-h-[430px] flex-col items-center justify-center text-center">
      <div
        className={`flex h-20 w-20 items-center justify-center rounded-3xl border ${
          fullySuccessful
            ? "border-emerald-400/20 bg-emerald-400/10"
            : "border-amber-400/20 bg-amber-400/10"
        }`}
      >
        {fullySuccessful ? (
          <CheckCircle2 className="h-10 w-10 text-emerald-300" />
        ) : (
          <AlertCircle className="h-10 w-10 text-amber-300" />
        )}
      </div>

      <h3 className="mt-7 text-2xl font-semibold text-white">
        {fullySuccessful
          ? "Import complete"
          : "Import completed with issues"}
      </h3>

      <p className="mt-2 max-w-lg text-sm leading-6 text-white/45">
        {result.imported.toLocaleString("en-US")}{" "}
        {moduleName.toLowerCase()} records were imported into Helix.
        Dashboard data, activity and reports can now reflect the new
        records.
      </p>

      <div className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Imported"
          value={result.imported}
          tone="success"
        />

        <SummaryCard
          label="Skipped"
          value={result.skipped}
          tone="neutral"
        />

        <SummaryCard
          label="Failed"
          value={result.failed}
          tone={result.failed > 0 ? "danger" : "neutral"}
        />
      </div>
    </div>
  );
}

/* ============================================================
   Shared UI Pieces
============================================================ */

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "success" | "danger";
}) {
  const toneClasses = {
    neutral: "border-white/8 bg-white/[0.025] text-white",
    success:
      "border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-200",
    danger:
      "border-red-400/15 bg-red-400/[0.06] text-red-200",
  };

  return (
    <div
      className={`rounded-2xl border p-4 ${toneClasses[tone]}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider opacity-50">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold">
        {value.toLocaleString("en-US")}
      </p>
    </div>
  );
}

function IssuePanel({
  title,
  description,
  issues,
  tone,
}: {
  title: string;
  description: string;
  issues: Array<ValidationError | ValidationWarning>;
  tone: "danger" | "warning";
}) {
  const danger = tone === "danger";

  return (
    <section
      className={`overflow-hidden rounded-2xl border ${
        danger
          ? "border-red-400/20 bg-red-400/[0.05]"
          : "border-amber-400/20 bg-amber-400/[0.05]"
      }`}
    >
      <div className="flex items-start gap-3 border-b border-white/8 px-5 py-4">
        <AlertCircle
          className={`mt-0.5 h-5 w-5 shrink-0 ${
            danger ? "text-red-300" : "text-amber-300"
          }`}
        />

        <div>
          <h3
            className={`text-sm font-semibold ${
              danger ? "text-red-100" : "text-amber-100"
            }`}
          >
            {title}
          </h3>

          <p className="mt-1 text-xs text-white/45">
            {description}
          </p>
        </div>
      </div>

      <div className="max-h-60 overflow-y-auto">
        {issues.slice(0, 100).map((issue, index) => (
          <div
            key={`${issue.row}-${issue.column}-${index}`}
            className="grid gap-1 border-b border-white/5 px-5 py-3 last:border-b-0 sm:grid-cols-[90px_160px_1fr]"
          >
            <span className="text-xs font-semibold text-white/45">
              {issue.row > 0 ? `Row ${issue.row}` : "File"}
            </span>

            <span className="text-xs text-white/55">
              {issue.column || "CSV structure"}
            </span>

            <span className="text-xs text-white/75">
              {issue.message}
            </span>
          </div>
        ))}

        {issues.length > 100 ? (
          <div className="px-5 py-3 text-xs text-white/40">
            Showing the first 100 of{" "}
            {issues.length.toLocaleString("en-US")} issues.
          </div>
        ) : null}
      </div>
    </section>
  );
}