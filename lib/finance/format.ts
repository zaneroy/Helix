export function toNumber(value: number | string | null | undefined) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function percent(value: number) {
  return Number.isFinite(value) ? value : 0;
}

export function safeDivide(numerator: number, denominator: number) {
  if (!denominator || denominator === 0) return null;
  return numerator / denominator;
}