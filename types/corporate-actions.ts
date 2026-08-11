// HELIX ERP
// 006D-02 — Corporate Actions TypeScript Types
//
// These types match the JSON envelopes returned by the 006D-01 RPC functions.

export type UUID = string;

export type CorporateActionStatus =
  | "draft"
  | "submitted"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "cancelled"
  | "calculated"
  | "ready"
  | "processing"
  | "executed"
  | "completed"
  | "failed"
  | "reversed"
  | string;

export type CorporateActionType =
  | "stock_split"
  | "share_split"
  | "split"
  | "reverse_split"
  | "reverse_stock_split"
  | "consolidation"
  | "conversion"
  | "class_conversion"
  | "equity_conversion"
  | string;

export interface ApiError {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

export type ApiResponse<T> =
  | {
      success: true;
      data: T;
      meta: Record<string, unknown>;
    }
  | {
      success: false;
      error: ApiError;
    };

export interface CorporateAction {
  id: UUID;
  company_id: UUID;
  action_number: string | null;
  title: string;
  action_type: CorporateActionType;
  status: CorporateActionStatus;
  source_equity_class_id: UUID;
  destination_equity_class_id: UUID | null;
  numerator: number | null;
  denominator: number | null;
  effective_date: string;
  fractional_share_treatment: string | null;
  fractional_share_price: number | null;
  currency_code: string | null;
  approval_required: boolean;
  board_approval_required?: boolean;
  shareholder_approval_required?: boolean;
  regulatory_approval_required?: boolean;
  required_approval_count?: number;
  submitted_at: string | null;
  approved_at: string | null;
  executed_at: string | null;
  completed_at: string | null;
  reversed_at: string | null;
  reversal_reason?: string | null;
  created_by: UUID | null;
  updated_by: UUID | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface CorporateActionListItem extends CorporateAction {
  total_impacts: number;
  calculated_impacts: number;
  processing_impacts: number;
  processed_impacts: number;
  failed_impacts: number;
}

export interface CorporateActionHolderImpact {
  id: UUID;
  company_id: UUID;
  corporate_action_id: UUID;
  investor_id: UUID;
  source_equity_class_id: UUID;
  destination_equity_class_id: UUID | null;
  shares_before: number;
  shares_debited: number;
  shares_credited: number;
  shares_after: number;
  raw_calculated_shares?: number;
  fractional_shares?: number;
  fractional_cash_amount?: number;
  currency_code?: string | null;
  status: string;
  failure_details?: Record<string, unknown> | null;
  processing_details?: Record<string, unknown> | null;
  resulting_certificate_ids?: UUID[];
  processed_at?: string | null;
  reversed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface EquityTransaction {
  id: UUID;
  company_id: UUID;
  investor_id: UUID;
  equity_class_id: UUID;
  transaction_group_id: UUID | null;
  transaction_type: string;
  share_delta: number;
  price_per_share: number | null;
  consideration_amount: number | null;
  currency: string | null;
  effective_at: string;
  status: string;
  description: string | null;
  notes: string | null;
  source_type: string | null;
  source_id: UUID | null;
  related_transaction_id: UUID | null;
  reversal_of: UUID | null;
  idempotency_key: string | null;
  created_by: UUID | null;
  approved_by: UUID | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ShareCertificate {
  id: UUID;
  company_id: UUID;
  investor_id: UUID;
  equity_class_id: UUID;
  equity_transaction_id: UUID | null;
  certificate_number: string;
  shares: number;
  issue_price_per_share: number | null;
  total_consideration: number | null;
  currency: string | null;
  issued_at: string | null;
  certificate_status: string;
  verification_token: string | null;
  issued_by: UUID | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface CorporateActionProgress {
  id: UUID;
  company_id: UUID;
  action_number: string | null;
  action_type: string;
  status: string;
  total_impacts: number;
  calculated: number;
  processing: number;
  processed: number;
  failed: number;
  created_at: string;
  updated_at: string;
}

export interface CorporateActionTestSummary {
  scope?: string;
  company_id?: UUID;
  corporate_action_id?: UUID;
  total_tests?: number;
  passed?: number;
  failed?: number;
  not_applicable?: number;
  critical_failures?: number;
  results?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface CorporateActionDetail {
  action: CorporateAction;
  progress: CorporateActionProgress | Record<string, never>;
  holder_impacts: CorporateActionHolderImpact[];
  transactions: EquityTransaction[];
  certificates: ShareCertificate[];
  test_summary: CorporateActionTestSummary;
}

export interface CorporateActionListMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  sort_direction: "asc" | "desc";
  [key: string]: unknown;
}

export interface CorporateActionDashboard {
  status_counts: Record<string, number>;
  action_type_counts: Record<string, number>;
  recent_actions: Array<{
    id: UUID;
    action_number: string | null;
    title: string;
    action_type: string;
    status: string;
    effective_date: string;
    created_at: string;
    updated_at: string;
  }>;
  integrity_issue_count: number;
  failed_holder_impact_count: number;
}

export interface ReversalPreviewRow {
  investor_id: UUID;
  equity_class_id: UUID;
  current_shares: number;
  reversal_share_delta: number;
  projected_shares: number;
  can_reverse: boolean;
}

export interface CreateCorporateActionInput {
  companyId: UUID;
  title: string;
  actionType: CorporateActionType;
  sourceEquityClassId: UUID;
  effectiveDate: string;
  destinationEquityClassId?: UUID | null;
  numerator?: number | null;
  denominator?: number | null;
  fractionalShareTreatment?: string;
  fractionalSharePrice?: number | null;
  currencyCode?: string;
  approvalRequired?: boolean;
  boardApprovalRequired?: boolean;
  shareholderApprovalRequired?: boolean;
  regulatoryApprovalRequired?: boolean;
  requiredApprovalCount?: number;
}

export interface UpdateCorporateActionInput {
  companyId: UUID;
  actionId: UUID;
  title?: string;
  actionType?: CorporateActionType;
  sourceEquityClassId?: UUID;
  destinationEquityClassId?: UUID | null;
  effectiveDate?: string;
  numerator?: number | null;
  denominator?: number | null;
  fractionalShareTreatment?: string;
  fractionalSharePrice?: number | null;
  currencyCode?: string;
  approvalRequired?: boolean;
  boardApprovalRequired?: boolean;
  shareholderApprovalRequired?: boolean;
  regulatoryApprovalRequired?: boolean;
  requiredApprovalCount?: number;
}

export interface ListCorporateActionsInput {
  companyId: UUID;
  page?: number;
  pageSize?: number;
  status?: string | null;
  actionType?: string | null;
  search?: string | null;
  sortDirection?: "asc" | "desc";
}
