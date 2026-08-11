import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminReportsClient from "./AdminReportsClient";
import { buildFinancialMetrics } from "@/lib/finance/metrics";
import type {
  FinanceCashLedgerEntry,
  FinanceExpense,
  FinanceInvestment,
  FinanceProduct,
  FinanceSale,
} from "@/lib/finance/types";
import { getUserNotifications } from "@/lib/notifications/server";

export default async function AdminReportsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, company_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || !profile.company_id) {
    redirect("/admin/login");
  }

  const { data: company } = await supabase
    .from("companies")
    .select("name, currency")
    .eq("id", profile.company_id)
    .single();

  const [
  { data: investments },
  { data: sales },
  { data: expenses },
  { data: products },
  { data: cashLedger },
  { data: publishedReports },
  notifications,
] = await Promise.all([
    supabase
      .from("investments")
      .select("amount, equity_percent, investment_date, status")
      .eq("company_id", profile.company_id),

    supabase
      .from("sales")
      .select(
        "id, quantity, total_amount, profit_amount, unit_cost, sale_price, sold_at, created_at"
      )
      .eq("company_id", profile.company_id),

    supabase
      .from("expenses")
      .select("id, amount, expense_date, created_at, category, status")
      .eq("company_id", profile.company_id),

    supabase
      .from("products")
      .select(
        "id, quantity_on_hand, stock_quantity, quantity_bought, quantity_sold, price_per_piece, total_cost"
      )
      .eq("company_id", profile.company_id),

    supabase
      .from("cash_ledger")
      .select(
        "id, direction, amount, category, source_type, transaction_date, created_at"
      )
      .eq("company_id", profile.company_id),

    supabase
      .from("company_documents")
      .select("id, title, category, visibility, created_at")
      .eq("company_id", profile.company_id)
      .eq("category", "financial")
      .order("created_at", { ascending: false }),

    getUserNotifications(user.id),
  ]);

  const investmentSummary = {
    amount: (investments || []).reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0
    ),
    equity_percent: (investments || []).reduce(
      (sum, row) => sum + Number(row.equity_percent || 0),
      0
    ),
  };

  const metrics = buildFinancialMetrics({
    sales: (sales || []) as FinanceSale[],
    expenses: (expenses || []) as FinanceExpense[],
    products: (products || []) as FinanceProduct[],
    investment: investmentSummary as FinanceInvestment,
    cashLedger: (cashLedger || []) as FinanceCashLedgerEntry[],
  });

  return (
    <AdminReportsClient
  adminName={profile.full_name || user.email || "Founder"}
  companyId={profile.company_id}
  companyName={company?.name || "Company"}
  founderName={profile.full_name || user.email || "Founder"}
  currency={company?.currency || "USD"}
  metrics={metrics}
  publishedReports={publishedReports || []}
  notifications={notifications}
  userId={user.id}
/>
  );
}