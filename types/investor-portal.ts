export type UUID = string;

export type InvestorPortalDealType = "company_raise" | "founder_sale";
export type InvestorPortalMoneyRecipient = "company" | "founder_admin";
export type InvestorPortalOfferStatus =
  | "draft"
  | "pending"
  | "sent"
  | "accepted"
  | "payment_received"
  | "completed"
  | "cancelled"
  | "rejected";

export type InvestorCapitalRequestType = "capital_in" | "withdrawal_request";

export type InvestorCapitalRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "completed"
  | "cancelled";

export type InvestorCapitalRequest = {
  id: UUID;
  companyId: UUID;
  investorId: UUID;
  investorName: string;
  investorEmail: string | null;
  requestType: InvestorCapitalRequestType;
  amount: number;
  currency: string;
  notes: string | null;
  status: InvestorCapitalRequestStatus;
  adminNote: string | null;
  reviewedBy: UUID | null;
  reviewedAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SubmitInvestorCapitalRequestInput = {
  requestType: InvestorCapitalRequestType;
  amount: number | string;
  notes?: string | null;
};

export type ReviewInvestorCapitalRequestInput = {
  companyId: UUID;
  requestId: UUID;
  status: InvestorCapitalRequestStatus;
  adminNote?: string | null;
};

export type InvestorPortalMetric = {
  label: string;
  value: string;
  caption: string;
};

export type InvestorPortalTrendPoint = {
  key: string;
  label: string;
  value: number;
};

export type InvestorPortalSummary = {
  companyName: string;
  currency: string;

  investorName: string;
  investorEmail: string | null;
  investorInitials: string;
  investorId: UUID;
  companyId: UUID;

  totalInvestment: number;
  capitalContributed: number;
  founderPurchaseAmount: number;
  equityPercent: number;

  companyValue: number;
  estimatedHoldingValue: number;
  estimatedRoiPercent: number;

  companyCash: number;
  companySales: number;
  companyCapitalRaised: number;
  founderEquityPercent: number;
  investorEquityPercent: number;

  pendingOfferCount: number;
  completedOfferCount: number;
  cancelledOfferCount: number;
  certificateCount: number;
  documentCount: number;
  unreadNotificationCount: number;
  activeCapitalRequestCount: number;
  completedCapitalRequestCount: number;
  rejectedCapitalRequestCount: number;
};


export type InvestorPortalOffer = {
  id: UUID;
  investorId: UUID;
  investorName: string;
  amount: number;
  equityPercent: number;
  status: InvestorPortalOfferStatus;
  dealType: InvestorPortalDealType;
  moneyRecipient: InvestorPortalMoneyRecipient;
  destinationAccountId: UUID | null;
  destinationAccountName: string | null;
  createdAt: string | null;
  completedAt: string | null;
  title: string;
  note: string | null;
  canDownloadOfferPdf: boolean;
  canDownloadAgreementPdf: boolean;
  canDownloadCertificatePdf: boolean;
};

export type InvestorPortalCertificate = {
  id: UUID;
  sourceOfferId: UUID | null;
  certificateNumber: string;
  investorId: UUID;
  investorName: string;
  equityPercent: number;
  amount: number;
  issuedAt: string | null;
};

export type InvestorPortalDocument = {
  id: UUID;
  title: string;
  category: string;
  fileName: string | null;
  fileType: string | null;
  sizeLabel: string | null;
  uploadedAt: string | null;
  downloadUrl: string | null;
};

export type InvestorPortalNotification = {
  id: UUID;
  title: string;
  message: string;
  type: string;
  createdAt: string | null;
  readAt: string | null;
  actionUrl: string | null;
};

export type InvestorPortalActivity = {
  id: UUID;
  title: string;
  description: string;
  type: string;
  createdAt: string | null;
};

export type InvestorPortalReportData = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  grossMarginPercent: number;
  netMarginPercent: number;
  ebitdaEstimate: number;
  businessHealthScore: number;
  businessHealthLabel: string;
  inventoryValue: number;
  inventoryTurnover: number;
  cashInflows: number;
  cashOutflows: number;
  monthlyBurnRate: number;
  cashRunwayLabel: string;
  topProducts: {
    id: UUID | string;
    name: string;
    sku: string | null;
    quantitySold: number;
    revenue: number;
  }[];
};

export type InvestorPortalReadModel = {
  summary: InvestorPortalSummary;
  offers: InvestorPortalOffer[];
  certificates: InvestorPortalCertificate[];
  documents: InvestorPortalDocument[];
  notifications: InvestorPortalNotification[];
  activity: InvestorPortalActivity[];
  capitalRequests: InvestorCapitalRequest[];
  trends: {
    companyValue: InvestorPortalTrendPoint[];
    companyCash: InvestorPortalTrendPoint[];
    companySales: InvestorPortalTrendPoint[];
    revenue: InvestorPortalTrendPoint[];
    profit: InvestorPortalTrendPoint[];
    expenses: InvestorPortalTrendPoint[];
  };
  reports: InvestorPortalReportData;
};

export type InvestorPortalActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };
