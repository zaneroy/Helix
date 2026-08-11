/* ============================================================
   HELIX IMPORT / EXPORT ENGINE
   CSV Parser
   ============================================================ */

import {
  MAX_FILE_SIZE_MB,
  MAX_IMPORT_ROWS,
} from "@/lib/import-export/constants";

import type {
  ParsedRow,
} from "@/lib/import-export/types";

export type CsvParseErrorCode =
  | "EMPTY_FILE"
  | "INVALID_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "MISSING_HEADERS"
  | "EMPTY_HEADER"
  | "DUPLICATE_HEADER"
  | "COLUMN_COUNT_MISMATCH"
  | "UNCLOSED_QUOTE"
  | "TOO_MANY_ROWS"
  | "FILE_READ_FAILED";

export type CsvParseError = {
  code: CsvParseErrorCode;
  message: string;
  row?: number;
  column?: number;
};

export type CsvParseResult = {
  success: boolean;
  headers: string[];
  rows: ParsedRow[];
  errors: CsvParseError[];
  totalRows: number;
};

type RawCsvResult = {
  records: string[][];
  errors: CsvParseError[];
};

function normalizeLineEndings(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function normalizeHeader(value: string): string {
  return value.trim();
}

function headerIdentity(value: string): string {
  return normalizeHeader(value).toLocaleLowerCase("en-US");
}

function isBlankRecord(record: string[]): boolean {
  return record.every((value) => value.trim() === "");
}

function parseRawCsv(csvText: string): RawCsvResult {
  const text = normalizeLineEndings(csvText);

  const records: string[][] = [];
  const errors: CsvParseError[] = [];

  let currentRecord: string[] = [];
  let currentField = "";

  let insideQuotes = false;
  let rowNumber = 1;
  let columnNumber = 1;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (insideQuotes) {
      if (character === '"') {
        if (nextCharacter === '"') {
          currentField += '"';
          index += 1;
          columnNumber += 1;
        } else {
          insideQuotes = false;
        }
      } else {
        currentField += character;

        if (character === "\n") {
          rowNumber += 1;
          columnNumber = 1;
        }
      }

      columnNumber += 1;
      continue;
    }

    if (character === '"') {
      if (currentField.length === 0) {
        insideQuotes = true;
      } else {
        currentField += character;
      }

      columnNumber += 1;
      continue;
    }

    if (character === ",") {
      currentRecord.push(currentField);
      currentField = "";
      columnNumber += 1;
      continue;
    }

    if (character === "\n") {
      currentRecord.push(currentField);

      if (!isBlankRecord(currentRecord)) {
        records.push(currentRecord);
      }

      currentRecord = [];
      currentField = "";
      rowNumber += 1;
      columnNumber = 1;
      continue;
    }

    currentField += character;
    columnNumber += 1;
  }

  if (insideQuotes) {
    errors.push({
      code: "UNCLOSED_QUOTE",
      message: "The CSV contains a quoted value that was not closed.",
      row: rowNumber,
      column: columnNumber,
    });
  }

  currentRecord.push(currentField);

  if (!isBlankRecord(currentRecord)) {
    records.push(currentRecord);
  }

  return {
    records,
    errors,
  };
}

function validateHeaders(headers: string[]): CsvParseError[] {
  const errors: CsvParseError[] = [];

  if (headers.length === 0) {
    return [
      {
        code: "MISSING_HEADERS",
        message: "The CSV does not contain a header row.",
        row: 1,
      },
    ];
  }

  const seenHeaders = new Map<string, number>();

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    const identity = headerIdentity(header);
    const columnNumber = index + 1;

    if (!normalized) {
      errors.push({
        code: "EMPTY_HEADER",
        message: `Column ${columnNumber} does not have a heading.`,
        row: 1,
        column: columnNumber,
      });

      return;
    }

    const previousColumn = seenHeaders.get(identity);

    if (previousColumn !== undefined) {
      errors.push({
        code: "DUPLICATE_HEADER",
        message:
          `"${normalized}" is duplicated in columns ` +
          `${previousColumn} and ${columnNumber}.`,
        row: 1,
        column: columnNumber,
      });

      return;
    }

    seenHeaders.set(identity, columnNumber);
  });

  return errors;
}

function buildParsedRows(
  headers: string[],
  records: string[][]
): {
  rows: ParsedRow[];
  errors: CsvParseError[];
} {
  const rows: ParsedRow[] = [];
  const errors: CsvParseError[] = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const csvRowNumber = index + 2;

    if (record.length !== headers.length) {
      errors.push({
        code: "COLUMN_COUNT_MISMATCH",
        message:
          `Row ${csvRowNumber} contains ${record.length} columns, ` +
          `but the template requires ${headers.length}.`,
        row: csvRowNumber,
      });

      continue;
    }

    const values: Record<string, unknown> = {};

    headers.forEach((header, columnIndex) => {
      values[header] = record[columnIndex]?.trim() ?? "";
    });

    rows.push({
      rowNumber: csvRowNumber,
      values,
    });
  }

  return {
    rows,
    errors,
  };
}

export function parseCsvText(csvText: string): CsvParseResult {
  if (!csvText.trim()) {
    return {
      success: false,
      headers: [],
      rows: [],
      errors: [
        {
          code: "EMPTY_FILE",
          message: "The uploaded CSV is empty.",
        },
      ],
      totalRows: 0,
    };
  }

  const rawResult = parseRawCsv(csvText);

  if (rawResult.records.length === 0) {
    return {
      success: false,
      headers: [],
      rows: [],
      errors: [
        ...rawResult.errors,
        {
          code: "EMPTY_FILE",
          message: "The uploaded CSV does not contain any data.",
        },
      ],
      totalRows: 0,
    };
  }

  const [rawHeaders, ...dataRecords] = rawResult.records;
  const headers = rawHeaders.map(normalizeHeader);

  const headerErrors = validateHeaders(headers);

  if (dataRecords.length > MAX_IMPORT_ROWS) {
    return {
      success: false,
      headers,
      rows: [],
      errors: [
        ...rawResult.errors,
        ...headerErrors,
        {
          code: "TOO_MANY_ROWS",
          message:
            `This CSV contains ${dataRecords.length.toLocaleString(
              "en-US"
            )} rows. The maximum allowed is ` +
            `${MAX_IMPORT_ROWS.toLocaleString("en-US")}.`,
        },
      ],
      totalRows: dataRecords.length,
    };
  }

  const parsedResult = buildParsedRows(headers, dataRecords);

  const errors = [
    ...rawResult.errors,
    ...headerErrors,
    ...parsedResult.errors,
  ];

  return {
    success: errors.length === 0,
    headers,
    rows: parsedResult.rows,
    errors,
    totalRows: dataRecords.length,
  };
}

function hasCsvExtension(filename: string): boolean {
  return filename.toLocaleLowerCase("en-US").endsWith(".csv");
}

export async function parseCsvFile(
  file: File
): Promise<CsvParseResult> {
  if (!hasCsvExtension(file.name)) {
    return {
      success: false,
      headers: [],
      rows: [],
      errors: [
        {
          code: "INVALID_FILE_TYPE",
          message:
            "Only CSV files are supported. Download and use the Helix template.",
        },
      ],
      totalRows: 0,
    };
  }

  const maximumBytes = MAX_FILE_SIZE_MB * 1024 * 1024;

  if (file.size > maximumBytes) {
    return {
      success: false,
      headers: [],
      rows: [],
      errors: [
        {
          code: "FILE_TOO_LARGE",
          message:
            `The selected file exceeds the ${MAX_FILE_SIZE_MB} MB ` +
            "upload limit.",
        },
      ],
      totalRows: 0,
    };
  }

  try {
    const csvText = await file.text();

    return parseCsvText(csvText);
  } catch {
    return {
      success: false,
      headers: [],
      rows: [],
      errors: [
        {
          code: "FILE_READ_FAILED",
          message:
            "Helix could not read the selected file. Please try again.",
        },
      ],
      totalRows: 0,
    };
  }
}