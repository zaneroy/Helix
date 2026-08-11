export const supportedCurrencies = [
  "USD",
  "CAD",
  "GBP",
  "EUR",
  "AUD",
  "PKR",
  "AED",
  "JPY",
  "INR",
  "CHF",
  "SEK",
  "NOK",
] as const;

export type SupportedCurrency = (typeof supportedCurrencies)[number];

export function normalizeCurrency(currency?: string | null): SupportedCurrency {
  const value = String(currency || "USD").toUpperCase();

  if (supportedCurrencies.includes(value as SupportedCurrency)) {
    return value as SupportedCurrency;
  }

  return "USD";
}

export function formatCurrency(
  value: number | string | null | undefined,
  currency?: string | null,
  options?: {
    maximumFractionDigits?: number;
    minimumFractionDigits?: number;
  }
) {
  const safeCurrency = normalizeCurrency(currency);
  const amount = Number(value || 0);

  return new Intl.NumberFormat(getLocaleForCurrency(safeCurrency), {
    style: "currency",
    currency: safeCurrency,
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
    minimumFractionDigits: options?.minimumFractionDigits,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function createCurrencyFormatter(currency?: string | null) {
  return (value: number | string | null | undefined) =>
    formatCurrency(value, currency);
}

function getLocaleForCurrency(currency: SupportedCurrency) {
  switch (currency) {
    case "GBP":
      return "en-GB";
    case "CAD":
      return "en-CA";
    case "EUR":
      return "en-IE";
    case "AUD":
      return "en-AU";
    case "PKR":
      return "en-PK";
    case "AED":
      return "en-AE";
    case "INR":
      return "en-IN";
    default:
      return "en-US";
  }
}