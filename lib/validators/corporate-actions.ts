// HELIX ERP
// 006D-02 — Lightweight validation helpers
//
// No new package is required. Replace with Zod later if Zod is already part of
// your project.

import type {
  CreateCorporateActionInput,
  UpdateCorporateActionInput,
} from "@/types/corporate-actions";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class CorporateActionValidationError extends Error {
  readonly fieldErrors: Record<string, string>;

  constructor(fieldErrors: Record<string, string>) {
    super("Corporate action validation failed.");
    this.name = "CorporateActionValidationError";
    this.fieldErrors = fieldErrors;
  }
}

function isValidUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isPositiveNumber(value: number | null | undefined): boolean {
  return value == null || (Number.isFinite(value) && value > 0);
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
}

export function validateCreateCorporateAction(
  input: CreateCorporateActionInput,
): void {
  const errors: Record<string, string> = {};

  if (!isValidUuid(input.companyId)) {
    errors.companyId = "A valid company ID is required.";
  }

  if (!input.title?.trim()) {
    errors.title = "A title is required.";
  }

  if (!input.actionType?.trim()) {
    errors.actionType = "An action type is required.";
  }

  if (!isValidUuid(input.sourceEquityClassId)) {
    errors.sourceEquityClassId = "A valid source equity class is required.";
  }

  if (!isIsoDate(input.effectiveDate)) {
    errors.effectiveDate = "Use a valid date in YYYY-MM-DD format.";
  }

  if (
    input.destinationEquityClassId != null &&
    !isValidUuid(input.destinationEquityClassId)
  ) {
    errors.destinationEquityClassId =
      "Destination equity class must be a valid UUID.";
  }

  if (!isPositiveNumber(input.numerator)) {
    errors.numerator = "Numerator must be greater than zero.";
  }

  if (!isPositiveNumber(input.denominator)) {
    errors.denominator = "Denominator must be greater than zero.";
  }

  if (
    input.requiredApprovalCount != null &&
    (!Number.isInteger(input.requiredApprovalCount) ||
      input.requiredApprovalCount < 0)
  ) {
    errors.requiredApprovalCount =
      "Required approval count must be a non-negative integer.";
  }

  if (Object.keys(errors).length > 0) {
    throw new CorporateActionValidationError(errors);
  }
}

export function validateUpdateCorporateAction(
  input: UpdateCorporateActionInput,
): void {
  const errors: Record<string, string> = {};

  if (!isValidUuid(input.companyId)) {
    errors.companyId = "A valid company ID is required.";
  }

  if (!isValidUuid(input.actionId)) {
    errors.actionId = "A valid corporate action ID is required.";
  }

  if (input.title !== undefined && !input.title.trim()) {
    errors.title = "Title cannot be empty.";
  }

  if (input.actionType !== undefined && !input.actionType.trim()) {
    errors.actionType = "Action type cannot be empty.";
  }

  if (
    input.sourceEquityClassId !== undefined &&
    !isValidUuid(input.sourceEquityClassId)
  ) {
    errors.sourceEquityClassId = "Source equity class must be a valid UUID.";
  }

  if (
    input.destinationEquityClassId != null &&
    !isValidUuid(input.destinationEquityClassId)
  ) {
    errors.destinationEquityClassId =
      "Destination equity class must be a valid UUID.";
  }

  if (
    input.effectiveDate !== undefined &&
    !isIsoDate(input.effectiveDate)
  ) {
    errors.effectiveDate = "Use a valid date in YYYY-MM-DD format.";
  }

  if (!isPositiveNumber(input.numerator)) {
    errors.numerator = "Numerator must be greater than zero.";
  }

  if (!isPositiveNumber(input.denominator)) {
    errors.denominator = "Denominator must be greater than zero.";
  }

  if (
    input.requiredApprovalCount != null &&
    (!Number.isInteger(input.requiredApprovalCount) ||
      input.requiredApprovalCount < 0)
  ) {
    errors.requiredApprovalCount =
      "Required approval count must be a non-negative integer.";
  }

  if (Object.keys(errors).length > 0) {
    throw new CorporateActionValidationError(errors);
  }
}
