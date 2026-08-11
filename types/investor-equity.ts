export type UUID = string;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonRecord = Record<string, unknown>;

export type ActionResult<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * INVESTORS — SIMPLE EQUITY MODEL
 *
 * Founder/Admin starts with 100% equity.
 * Investors only receive the percentage the admin allows.
 * Company investment money must go into a selected cash account.
 * Founder/Admin sale money does not enter company cash.
 */

export type EquityDealType = "company_raise" | "founder_sale";
export type MoneyRecipient = "company" | "founder_admin";

export type InvestorCapitalRequestType = "capital_in" | "withdrawal_request";

export type InvestorCapitalRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "completed"
  | "cancelled";

export type AdminInvestorCapitalRequest = {
  id: UUID;
  companyId: UUID;
  investorId: UUID;
  investorName: string;
  investorEmail?: string | null;
  requestType: InvestorCapitalRequestType;
  amount: number;
  currency: string;
  notes?: string | null;
  status: InvestorCapitalRequestStatus;
  adminNote?: string | null;
  reviewedBy?: UUID | null;
  reviewedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ReviewInvestorCapitalRequestInput = {
  companyId: UUID;
  requestId: UUID;
  status: InvestorCapitalRequestStatus;
  adminNote?: string | null;
};

export type EquityOfferStatus =
  | "draft"
  | "pending"
  | "sent"
  | "accepted"
  | "payment_received"
  | "completed"
  | "cancelled"
  | "rejected";

export type InvestorOption = {
  id: UUID;
  full_name?: string | null;
  email?: string | null;
  access_status?: string | null;
};

export type CashAccountOption = {
  id: UUID;
  name: string;
  accountType: string;
  currency: string;
  status: string;
  openingBalance: number;
  balance: number;
};

export type EquityOwnerType = "founder_admin" | "investor";

export type EquityOwnerRow = {
  id: UUID | string;
  ownerType: EquityOwnerType;
  name: string;
  email?: string | null;
  equityPercent: number;

  /**
   * Money this holder has put into the company.
   * For investors, this only counts company-raise offers where money goes into
   * a company cash account.
   */
  capitalContributed: number;

  /**
   * Money this holder paid directly to Founder/Admin in a founder sale.
   * This is not company capital and must not increase company cash.
   */
  founderPurchaseAmount: number;

  /**
   * Money Founder/Admin has received from selling equity personally.
   * For investor rows this remains 0 because the proceeds belong to Founder/Admin.
   */
  founderSaleProceeds: number;

  totalInvested: number;
  activeOfferCount: number;
};

export type EquityFinanceSnapshot = {
  cashInAccounts: number;
  companySales: number;
  founderCapitalContributed: number;
  investorCapitalContributed: number;
  capitalPool: number;
  estimatedCompanyValue: number;
  activeAccountCount: number;
};

export type EquityTrendPoint = {
  key: string;
  label: string;
  value: number;
};

export type EquityTrends = {
  companyValue: EquityTrendPoint[];
  companyCash: EquityTrendPoint[];
  companySales: EquityTrendPoint[];
  companyCapitalRaised: EquityTrendPoint[];
};

export type EquitySummary = {
  companyId: UUID;
  companyName: string;
  currency: string;
  founderEquityPercent: number;
  investorEquityPercent: number;
  companyCapitalRaised: number;
  founderCapitalContributed: number;
  founderSaleProceeds: number;
  companySales: number;
  companyCash: number;
  capitalPool: number;
  estimatedCompanyValue: number;
  impliedPostMoneyValuation: number;
  completedInvestorCount: number;
  pendingOfferCount: number;
  canCreateOffer: boolean;
  warnings: string[];
};

export type EquityOffer = {
  id: UUID;
  investorId: UUID;
  investorName: string;
  investorEmail?: string | null;
  dealType: EquityDealType;
  moneyRecipient: MoneyRecipient;
  destinationAccountId?: UUID | null;
  destinationAccountName?: string | null;
  amount: number;
  equityPercent: number;
  currency: string;
  status: EquityOfferStatus;
  title: string;
  note?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
  companyReceives: number;
  founderReceives: number;
  impliedPostMoneyValuation: number;
  founderEquityBefore: number;
  founderEquityAfter: number;
  investorEquityBefore: number;
  investorEquityAfter: number;
  canComplete: boolean;
  canCancel: boolean;
  canDownloadOfferPdf: boolean;
  canDownloadAgreementPdf: boolean;
  canDownloadCertificatePdf: boolean;
};

export type EquityCertificate = {
  id: UUID;
  certificateNumber: string;
  investorId: UUID;
  investorName: string;
  investorEmail?: string | null;
  equityPercent: number;
  amount: number;
  currency: string;
  issuedAt?: string | null;
  sourceOfferId: UUID;
  canDownloadPdf: boolean;
};

export type EquityPreviewOwnerRow = {
  id: UUID | string;
  name: string;
  ownerType: EquityOwnerType;
  equityBefore: number;
  equityChange: number;
  equityAfter: number;
};

export type EquityOfferPreview = {
  dealType: EquityDealType;
  moneyRecipient: MoneyRecipient;
  investorId: UUID;
  investorName: string;
  destinationAccountId?: UUID | null;
  destinationAccountName?: string | null;
  amount: number;
  equityPercent: number;
  currency: string;
  companyReceives: number;
  founderReceives: number;
  founderEquityBefore: number;
  founderEquityAfter: number;
  investorEquityBefore: number;
  investorEquityAfter: number;
  investorEquityExisting: number;
  investorEquityTotalAfter: number;
  companyCapitalBefore: number;
  companyCapitalAfter: number;
  founderSaleProceedsBefore: number;
  founderSaleProceedsAfter: number;
  impliedPostMoneyValuation: number;
  impliedPreMoneyValuation: number;
  rows: EquityPreviewOwnerRow[];
  warnings: string[];
  blockingReasons: string[];
};

export type InvestorEquityReadModel = {
  companyId: UUID;
  companyName: string;
  currency: string;
  refreshedAt: string;
  summary: EquitySummary;
  finance: EquityFinanceSnapshot;
  trends: EquityTrends;
  investors: InvestorOption[];
  cashAccounts: CashAccountOption[];
  owners: EquityOwnerRow[];
  offers: EquityOffer[];
  certificates: EquityCertificate[];
  capitalRequests: AdminInvestorCapitalRequest[];
  raw: {
    investors: JsonRecord[];
    investments: JsonRecord[];
    cashAccounts: JsonRecord[];
    cashLedger: JsonRecord[];
    capitalRequests: JsonRecord[];
  };
  warnings: string[];
};

export type CreateEquityOfferInput = {
  companyId: UUID;
  investorId: UUID;
  dealType: EquityDealType;
  destinationAccountId?: UUID | null;
  amount: number | string;
  equityPercent: number | string;
  currency?: string | null;
  title?: string | null;
  note?: string | null;
};

export type PreviewEquityOfferInput = CreateEquityOfferInput;

export type CompleteEquityOfferInput = {
  companyId: UUID;
  offerId: UUID;
};

export type CancelEquityOfferInput = {
  companyId: UUID;
  offerId: UUID;
};

export type CreateFounderCapitalContributionInput = {
  companyId: UUID;
  amount: number | string;
  destinationAccountId: UUID;
  currency?: string | null;
  note?: string | null;
};

export type CertificatePdfData = {
  certificateNumber: string;
  companyName?: string | null;
  investorName: string;
  investorEmail?: string | null;
  equityPercent: number;
  amount: number;
  currency: string;
  issuedAt?: string | null;
};
