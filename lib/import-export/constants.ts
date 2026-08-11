/* ============================================================
   HELIX IMPORT / EXPORT ENGINE
   Global Constants
   ============================================================ */

export const MAX_IMPORT_ROWS = 10000;

export const MAX_FILE_SIZE_MB = 25;

export const ACCEPTED_FILE_TYPES = [
  ".csv",
] as const;

export const DATE_FORMAT = "YYYY-MM-DD";

export const DEFAULT_ENCODING = "utf-8";

export const CSV_DELIMITER = ",";

export const CSV_LINE_BREAK = "\n";