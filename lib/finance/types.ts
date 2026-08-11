export type FinanceSale = {
  id: string;
  product_id?: string | null;
  quantity?: number | string | null;
  total_amount?: number | string | null;
  profit_amount?: number | string | null;
  unit_cost?: number | string | null;
  sale_price?: number | string | null;
  sold_at?: string | null;
  created_at?: string | null;
};

export type FinanceExpense = {
  id?: string;
  amount?: number | string | null;
  expense_date?: string | null;
  created_at?: string | null;
  category?: string | null;
  status?: string | null;
};

export type FinanceProduct = {
  id: string;
  quantity_on_hand?: number | string | null;
  stock_quantity?: number | string | null;
  quantity_bought?: number | string | null;
  quantity_sold?: number | string | null;
  price_per_piece?: number | string | null;
  total_cost?: number | string | null;
};

export type FinanceInvestment = {
  id?: string;
  amount?: number | string | null;
  equity_percent?: number | string | null;
  investment_date?: string | null;
  status?: string | null;
};

export type FinanceCashLedgerEntry = {
  id?: string;
  direction?: "inflow" | "outflow" | string | null;
  amount?: number | string | null;
  category?: string | null;
  source_type?: string | null;
  transaction_date?: string | null;
  created_at?: string | null;
};

export type FinancialMetrics = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;

  inventoryValue: number;

  cashBalance: number;
  cashOnHand: number;

  cashInflows: number;
  cashOutflows: number;

  totalInvestment: number;
  equityPercent: number;
  companyValuation: number;
  equityValue: number;
  roi: number;

  burnRate: number;
  cashRunwayMonths: number | null;

  ebitda: number;
  inventoryTurnover: number | null;

  businessHealthScore: number;
};