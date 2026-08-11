/* ============================================================
   HELIX IMPORT / EXPORT ENGINE
   Shared Utilities
   ============================================================ */

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;

  if (typeof value === "string") {
    return value.trim() === "";
  }

  return false;
}

export function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeDate(value: unknown): string {
  const text = normalizeString(value);

  if (!text) {
    return "";
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export function downloadBlob(
  blob: Blob,
  filename: string
) {
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download = filename;

  link.click();

  URL.revokeObjectURL(url);
}