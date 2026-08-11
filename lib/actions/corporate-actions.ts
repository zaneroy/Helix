// HELIX ERP
// 006D-02 — Corporate Actions Next.js Server Actions
//
// IMPORTANT:
// Update the createClient import below only if your project uses a different
// Supabase server-client path.
//
// These functions are server-only and add no React hooks to Server Components.

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  CorporateActionValidationError,
  validateCreateCorporateAction,
  validateUpdateCorporateAction,
} from "@/lib/validators/corporate-actions";
import type {
  ApiResponse,
  CorporateAction,
  CorporateActionDashboard,
  CorporateActionDetail,
  CorporateActionListItem,
  CorporateActionListMeta,
  CreateCorporateActionInput,
  ListCorporateActionsInput,
  ReversalPreviewRow,
  UpdateCorporateActionInput,
  UUID,
} from "@/types/corporate-actions";

type RpcEnvelope<T> = ApiResponse<T>;

export interface ActionResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
  fieldErrors?: Record<string, string>;
  meta?: Record<string, unknown>;
}

function normalizeRpcEnvelope<T>(
  envelope: RpcEnvelope<T> | null,
): ActionResult<T> {
  if (!envelope) {
    return {
      ok: false,
      code: "EMPTY_RESPONSE",
      error: "The database returned an empty response.",
    };
  }

  if (envelope.success) {
    return {
      ok: true,
      data: envelope.data,
      meta: envelope.meta,
    };
  }

  return {
    ok: false,
    code: envelope.error.code,
    error: envelope.error.message,
  };
}

function normalizeThrownError(error: unknown): ActionResult<never> {
  if (error instanceof CorporateActionValidationError) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: error.message,
      fieldErrors: error.fieldErrors,
    };
  }

  if (error instanceof Error) {
    return {
      ok: false,
      code: "UNEXPECTED_ERROR",
      error: error.message,
    };
  }

  return {
    ok: false,
    code: "UNEXPECTED_ERROR",
    error: "An unexpected error occurred.",
  };
}

async function callRpc<T>(
  functionName: string,
  args: Record<string, unknown>,
): Promise<ActionResult<T>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(functionName, args);

    if (error) {
      return {
        ok: false,
        code: error.code ?? "DATABASE_ERROR",
        error: error.message,
      };
    }

    return normalizeRpcEnvelope<T>(data as RpcEnvelope<T> | null);
  } catch (error) {
    return normalizeThrownError(error);
  }
}

function revalidateCorporateActionPaths(
  _companyId: UUID,
  _actionId?: UUID,
): void {
  revalidatePath("/dashboard/investors");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");
}

export async function listCorporateActions(
  input: ListCorporateActionsInput,
): Promise<
  ActionResult<CorporateActionListItem[]> & {
    meta?: CorporateActionListMeta;
  }
> {
  const result = await callRpc<CorporateActionListItem[]>(
    "api_list_corporate_actions",
    {
      p_company_id: input.companyId,
      p_page: input.page ?? 1,
      p_page_size: input.pageSize ?? 25,
      p_status: input.status ?? null,
      p_action_type: input.actionType ?? null,
      p_search: input.search ?? null,
      p_sort_direction: input.sortDirection ?? "desc",
    },
  );

  return result as ActionResult<CorporateActionListItem[]> & {
    meta?: CorporateActionListMeta;
  };
}

export async function getCorporateAction(
  companyId: UUID,
  actionId: UUID,
): Promise<ActionResult<CorporateActionDetail>> {
  return callRpc<CorporateActionDetail>("api_get_corporate_action", {
    p_company_id: companyId,
    p_action_id: actionId,
  });
}

export async function getCorporateActionsDashboard(
  companyId: UUID,
): Promise<ActionResult<CorporateActionDashboard>> {
  return callRpc<CorporateActionDashboard>(
    "api_corporate_actions_dashboard",
    {
      p_company_id: companyId,
    },
  );
}

export async function createCorporateActionDraft(
  input: CreateCorporateActionInput,
): Promise<ActionResult<CorporateAction>> {
  try {
    validateCreateCorporateAction(input);

    const result = await callRpc<CorporateAction>(
      "api_create_corporate_action_draft",
      {
        p_company_id: input.companyId,
        p_title: input.title.trim(),
        p_action_type: input.actionType,
        p_source_equity_class_id: input.sourceEquityClassId,
        p_effective_date: input.effectiveDate,
        p_destination_equity_class_id:
          input.destinationEquityClassId ?? null,
        p_numerator: input.numerator ?? null,
        p_denominator: input.denominator ?? null,
        p_fractional_share_treatment:
          input.fractionalShareTreatment ?? "round_down",
        p_fractional_share_price:
          input.fractionalSharePrice ?? null,
        p_currency_code: input.currencyCode ?? "USD",
        p_approval_required: input.approvalRequired ?? true,
        p_board_approval_required:
          input.boardApprovalRequired ?? false,
        p_shareholder_approval_required:
          input.shareholderApprovalRequired ?? false,
        p_regulatory_approval_required:
          input.regulatoryApprovalRequired ?? false,
        p_required_approval_count:
          input.requiredApprovalCount ?? 1,
      },
    );

    if (result.ok && result.data) {
      revalidateCorporateActionPaths(
        input.companyId,
        result.data.id,
      );
    }

    return result;
  } catch (error) {
    return normalizeThrownError(error);
  }
}

export async function updateCorporateActionDraft(
  input: UpdateCorporateActionInput,
): Promise<ActionResult<CorporateAction>> {
  try {
    validateUpdateCorporateAction(input);

    const result = await callRpc<CorporateAction>(
      "api_update_corporate_action_draft",
      {
        p_company_id: input.companyId,
        p_action_id: input.actionId,
        p_title: input.title ?? null,
        p_action_type: input.actionType ?? null,
        p_source_equity_class_id:
          input.sourceEquityClassId ?? null,
        p_destination_equity_class_id:
          input.destinationEquityClassId ?? null,
        p_effective_date: input.effectiveDate ?? null,
        p_numerator: input.numerator ?? null,
        p_denominator: input.denominator ?? null,
        p_fractional_share_treatment:
          input.fractionalShareTreatment ?? null,
        p_fractional_share_price:
          input.fractionalSharePrice ?? null,
        p_currency_code: input.currencyCode ?? null,
        p_approval_required:
          input.approvalRequired ?? null,
        p_board_approval_required:
          input.boardApprovalRequired ?? null,
        p_shareholder_approval_required:
          input.shareholderApprovalRequired ?? null,
        p_regulatory_approval_required:
          input.regulatoryApprovalRequired ?? null,
        p_required_approval_count:
          input.requiredApprovalCount ?? null,
      },
    );

    if (result.ok) {
      revalidateCorporateActionPaths(
        input.companyId,
        input.actionId,
      );
    }

    return result;
  } catch (error) {
    return normalizeThrownError(error);
  }
}

export async function deleteCorporateActionDraft(
  companyId: UUID,
  actionId: UUID,
): Promise<ActionResult<{ deleted: boolean; corporate_action_id: UUID }>> {
  const result = await callRpc<{
    deleted: boolean;
    corporate_action_id: UUID;
  }>("api_delete_corporate_action_draft", {
    p_company_id: companyId,
    p_action_id: actionId,
  });

  if (result.ok) {
    revalidateCorporateActionPaths(companyId, actionId);
  }

  return result;
}

async function runWorkflowAction<T>(
  rpcName: string,
  companyId: UUID,
  actionId: UUID,
  extraArgs: Record<string, unknown> = {},
): Promise<ActionResult<T>> {
  const result = await callRpc<T>(rpcName, {
    p_company_id: companyId,
    p_action_id: actionId,
    ...extraArgs,
  });

  if (result.ok) {
    revalidateCorporateActionPaths(companyId, actionId);
  }

  return result;
}

export async function submitCorporateAction(
  companyId: UUID,
  actionId: UUID,
): Promise<ActionResult<CorporateAction>> {
  return runWorkflowAction(
    "api_submit_corporate_action",
    companyId,
    actionId,
  );
}

export async function approveCorporateAction(
  companyId: UUID,
  actionId: UUID,
): Promise<ActionResult<CorporateAction>> {
  return runWorkflowAction(
    "api_approve_corporate_action",
    companyId,
    actionId,
  );
}

export async function rejectCorporateAction(
  companyId: UUID,
  actionId: UUID,
  reason: string,
): Promise<ActionResult<CorporateAction>> {
  if (!reason.trim()) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: "A rejection reason is required.",
      fieldErrors: { reason: "A rejection reason is required." },
    };
  }

  return runWorkflowAction(
    "api_reject_corporate_action",
    companyId,
    actionId,
    { p_reason: reason.trim() },
  );
}

export async function cancelCorporateAction(
  companyId: UUID,
  actionId: UUID,
  reason: string,
): Promise<ActionResult<CorporateAction>> {
  if (!reason.trim()) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: "A cancellation reason is required.",
      fieldErrors: { reason: "A cancellation reason is required." },
    };
  }

  return runWorkflowAction(
    "api_cancel_corporate_action",
    companyId,
    actionId,
    { p_reason: reason.trim() },
  );
}

export async function calculateCorporateAction(
  companyId: UUID,
  actionId: UUID,
): Promise<ActionResult<Record<string, unknown>>> {
  return runWorkflowAction(
    "api_calculate_corporate_action",
    companyId,
    actionId,
  );
}

export async function executeCorporateAction(
  companyId: UUID,
  actionId: UUID,
): Promise<ActionResult<Record<string, unknown>>> {
  return runWorkflowAction(
    "api_execute_corporate_action",
    companyId,
    actionId,
  );
}

export async function issueCorporateActionCertificates(
  companyId: UUID,
  actionId: UUID,
): Promise<ActionResult<Record<string, unknown>>> {
  return runWorkflowAction(
    "api_issue_corporate_action_certificates",
    companyId,
    actionId,
  );
}

export async function processCorporateAction(
  companyId: UUID,
  actionId: UUID,
): Promise<ActionResult<Record<string, unknown>>> {
  return runWorkflowAction(
    "api_process_corporate_action",
    companyId,
    actionId,
  );
}

export async function previewCorporateActionReversal(
  companyId: UUID,
  actionId: UUID,
): Promise<ActionResult<ReversalPreviewRow[]>> {
  return callRpc<ReversalPreviewRow[]>(
    "api_preview_corporate_action_reversal",
    {
      p_company_id: companyId,
      p_action_id: actionId,
    },
  );
}

export async function reverseCorporateAction(
  companyId: UUID,
  actionId: UUID,
  reason: string,
  effectiveAt?: string,
): Promise<ActionResult<Record<string, unknown>>> {
  if (!reason.trim()) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: "A reversal reason is required.",
      fieldErrors: { reason: "A reversal reason is required." },
    };
  }

  return runWorkflowAction(
    "api_reverse_corporate_action",
    companyId,
    actionId,
    {
      p_reason: reason.trim(),
      p_effective_at: effectiveAt ?? new Date().toISOString(),
    },
  );
}