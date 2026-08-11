import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import CurrencySelector from "@/app/dashboard/CurrencySelector";
import { getUserNotifications } from "@/lib/notifications/server";

type MoneyRow = {
  id: string;
  total_amount?: number | string | null;
  profit_amount?: number | string | null;
  amount?: number | string | null;
  created_at?: string | null;
  sold_at?: string | null;
  expense_date?: string | null;
  category?: string | null;
  title?: string | null;
  description?: string | null;
  quantity?: number | string | null;
  product_id?: string | null;
  product_name?: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  item_name?: string | null;
  sku?: string | null;
  supplier?: string | null;
  cost_price?: number | string | null;
  selling_price?: number | string | null;
  stock_quantity?: number | string | null;
  low_stock_limit?: number | string | null;
  quantity_on_hand?: number | string | null;
  quantity_sold?: number | string | null;
  price_per_piece?: number | string | null;
};

type CashAccountRow = {
  id: string;
  name?: string | null;
  account_type?: string | null;
  currency?: string | null;
  opening_balance?: number | string | null;
  status?: string | null;
};

type CashTransactionRow = {
  id: string;
  account_id: string | null;
  direction: "inflow" | "outflow";
  amount: number | string | null;
  status?: string | null;
  source_type?: string | null;
};

type PerformancePoint = { key: string; label: string; revenue: number; expenses: number; profit: number };
type TopProduct = { name: string; revenue: number; quantity: number };

const PANEL = "rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]";

export default async function DashboardPage({ searchParams }: { searchParams?: Promise<{ period?: string }> }) {
  const params = await searchParams;
  const period = params?.period === "weekly" || params?.period === "monthly" || params?.period === "yearly" ? params.period : "monthly";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, company_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || !profile.company_id) redirect("/admin/login");

  const [
    { data: company },
    { data: products },
    { data: sales },
    { data: expenses },
    { data: cashAccounts },
    { data: cashTransactions },
    notifications,
  ] = await Promise.all([
    supabase.from("companies").select("name, currency").eq("id", profile.company_id).single(),
    supabase.from("products").select("*").eq("company_id", profile.company_id),
    supabase.from("sales").select("*").eq("company_id", profile.company_id),
    supabase.from("expenses").select("*").eq("company_id", profile.company_id),
    supabase
      .from("cash_accounts")
      .select(
        "id, name, account_type, currency, opening_balance, status"
      )
      .eq("company_id", profile.company_id),
    supabase
      .from("cash_ledger")
      .select("id, account_id, direction, amount, status, source_type")
      .eq("company_id", profile.company_id)
      .eq("status", "completed"),
    getUserNotifications(user.id),
  ]);

  const currency = company?.currency || "USD";
  const productRows = (products || []) as ProductRow[];
  const saleRows = (sales || []) as MoneyRow[];
  const expenseRows = (expenses || []) as MoneyRow[];
  const cashAccountRows = (cashAccounts || []) as CashAccountRow[];
  const cashTransactionRows =
    (cashTransactions || []) as CashTransactionRow[];

  const totalRevenue = sum(saleRows, "total_amount");
  const grossProfit = sum(saleRows, "profit_amount");
  const totalExpenses = sum(expenseRows, "amount");
  const netProfit = grossProfit - totalExpenses;

  const accountBalanceMap = new Map<string, number>();

  for (const account of cashAccountRows) {
    accountBalanceMap.set(
      account.id,
      Number(account.opening_balance || 0)
    );
  }

  for (const transaction of cashTransactionRows) {
    if (!transaction.account_id) continue;

    const amount = Number(transaction.amount || 0);

    if (!Number.isFinite(amount)) continue;

    const currentBalance =
      accountBalanceMap.get(transaction.account_id) || 0;

    accountBalanceMap.set(
      transaction.account_id,
      transaction.direction === "inflow"
        ? currentBalance + amount
        : currentBalance - amount
    );
  }

  const cashBalance = cashAccountRows
    .filter((account) => account.status === "active")
    .reduce(
      (total, account) =>
        total + (accountBalanceMap.get(account.id) || 0),
      0
    );

  const activeAccountBalances = cashAccountRows
    .filter((account) => account.status === "active")
    .map((account) => ({
      id: account.id,
      name: account.name || "Financial Account",
      accountType: account.account_type || "account",
      currency: account.currency || currency,
      balance:
        Math.round(
          (accountBalanceMap.get(account.id) || 0) * 100
        ) / 100,
    }))
    .sort((a, b) => b.balance - a.balance);
  const inventoryValue = productRows.reduce((total, product) => total + Number(product.quantity_on_hand || product.stock_quantity || 0) * deriveUnitCost(product), 0);
  const lowStock = productRows.filter((p) => Number(p.quantity_on_hand || p.stock_quantity || 0) <= Number(p.low_stock_limit || 0));
  const outOfStock = productRows.filter((p) => Number(p.quantity_on_hand || p.stock_quantity || 0) <= 0);
  const performanceData = getPerformanceData(saleRows, expenseRows, period);
  const recentActivity = [...saleRows, ...expenseRows].sort((a,b) => new Date(b.sold_at || b.expense_date || b.created_at || "").getTime() - new Date(a.sold_at || a.expense_date || a.created_at || "").getTime()).slice(0,6);
  const topProducts = getTopProducts(saleRows, productRows);
  const expenseBreakdown = getExpenseBreakdown(expenseRows);
  const supplierExposure = getSupplierExposure(productRows);
  const businessHealth = calculateBusinessHealth({ totalRevenue, grossProfit, totalExpenses, netProfit, products: productRows.length, lowStock: lowStock.length, outOfStock: outOfStock.length });
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const expenseRatio = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0;

  const latestPerformancePoint =
    performanceData[performanceData.length - 1];
  const previousPerformancePoint =
    performanceData[performanceData.length - 2];

  const revenueChange = calculatePercentageChange(
    latestPerformancePoint?.revenue || 0,
    previousPerformancePoint?.revenue || 0
  );
  const grossProfitChange = calculatePercentageChange(
    latestPerformancePoint?.profit || 0,
    previousPerformancePoint?.profit || 0
  );
  const expenseChange = calculatePercentageChange(
    latestPerformancePoint?.expenses || 0,
    previousPerformancePoint?.expenses || 0
  );
  const latestNetProfit =
    (latestPerformancePoint?.profit || 0) -
    (latestPerformancePoint?.expenses || 0);
  const previousNetProfit =
    (previousPerformancePoint?.profit || 0) -
    (previousPerformancePoint?.expenses || 0);
  const netProfitChange = calculatePercentageChange(
    latestNetProfit,
    previousNetProfit
  );

  const executiveBrief = buildExecutiveBrief({
    currency,
    totalRevenue,
    netProfit,
    cashBalance,
    grossMargin,
    expenseRatio,
    revenueChange,
    expenseChange,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    topProduct: topProducts[0],
  });

  return (
    <AdminShell title="Dashboard" adminName={profile.full_name || user.email || "Founder"} adminRole="Founder" showPageHeader={false} notifications={notifications || []} userId={user.id}>
      <main className="min-h-screen bg-[color:var(--app-bg)] text-[color:var(--text-primary)]">
        <div className="mx-auto w-full max-w-[var(--dashboard-content-max-width)] space-y-6 pb-12">
          <section className={`${PANEL} relative overflow-hidden px-6 py-6 sm:px-7`}>
            <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-[var(--radius-pill)] border border-[color:var(--border)]" />
            <div className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-[var(--radius-pill)] border border-[color:var(--border-subtle)]" />

            <div className="relative flex flex-col gap-6 2xl:flex-row 2xl:items-center 2xl:justify-between">
              <div className="max-w-2xl">
                <p className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--primary)]">
                  {company?.name || "Company"} · Executive command centre
                </p>
                <h1 className="mt-3 text-[30px] font-semibold leading-none tracking-[-0.045em] sm:text-[36px]">
                  Good {getDayPart()}, {getFirstName(profile.full_name || user.email || "Founder")}.
                </h1>
                <p className="mt-3 max-w-xl text-[12px] leading-5 text-[color:var(--text-secondary)]">
                  Your live financial position, operating performance and priority actions in one place.
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <DashboardQuickActions />
                  <CurrencySelector
                    companyId={profile.company_id}
                    currency={currency}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 2xl:min-w-[560px] 2xl:grid-cols-4">
                <CommandMetric
                  label="Health"
                  value={`${businessHealth.score}/100`}
                  note={businessHealth.label}
                  href="/dashboard/reports"
                />
                <CommandMetric
                  label="Available cash"
                  value={formatMoney(cashBalance, currency)}
                  note={`${activeAccountBalances.length} active accounts`}
                  href="/dashboard/accounts"
                />
                <CommandMetric
                  label="Current revenue"
                  value={formatMoney(latestPerformancePoint?.revenue || 0, currency)}
                  note={formatChange(revenueChange)}
                  href="/dashboard/sales"
                  positive={revenueChange >= 0}
                />
                <CommandMetric
                  label="Attention"
                  value={String(lowStock.length + outOfStock.length)}
                  note="stock alerts"
                  href="/dashboard/products"
                  positive={lowStock.length + outOfStock.length === 0}
                />
              </div>
            </div>
          </section>

          <section className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
            <KpiCard
              label="Revenue"
              value={formatMoney(totalRevenue, currency)}
              note={`${saleRows.length} recorded sales`}
              comparison={formatChange(revenueChange)}
              comparisonPositive={revenueChange >= 0}
              tone="cyan"
              href="/dashboard/sales"
              values={performanceData.map((point) => point.revenue)}
            />
            <KpiCard
              label="Gross Profit"
              value={formatMoney(grossProfit, currency)}
              note={`${grossMargin.toFixed(1)}% gross margin`}
              comparison={formatChange(grossProfitChange)}
              comparisonPositive={grossProfitChange >= 0}
              tone="green"
              href="/dashboard/sales"
              values={performanceData.map((point) => point.profit)}
            />
            <KpiCard
              label="Net Profit"
              value={formatMoney(netProfit, currency)}
              note={`${netMargin.toFixed(1)}% net margin`}
              comparison={formatChange(netProfitChange)}
              comparisonPositive={netProfitChange >= 0}
              tone={netProfit >= 0 ? "blue" : "red"}
              href="/dashboard/reports"
              values={performanceData.map(
                (point) => point.profit - point.expenses
              )}
            />
            <KpiCard
              label="Operating Expenses"
              value={formatMoney(totalExpenses, currency)}
              note={`${expenseRows.length} recorded expenses`}
              comparison={formatChange(expenseChange)}
              comparisonPositive={expenseChange <= 0}
              tone={expenseChange <= 0 ? "violet" : "red"}
              href="/dashboard/expenses"
              values={performanceData.map((point) => point.expenses)}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
            <FounderBrief
              items={executiveBrief}
              currency={currency}
              generatedAt={new Date()}
            />

            <FinancialPosition
              cashBalance={cashBalance}
              inventoryValue={inventoryValue}
              revenue={totalRevenue}
              expenses={totalExpenses}
              netProfit={netProfit}
              currency={currency}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.55fr)]">
            <FinancePanel title="Revenue vs Expenses" subtitle="Operating performance over time">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <PerformanceTabs active={period} />
                <div className="flex gap-5 text-[10px] text-[color:var(--text-secondary)]"><LegendDot color="bg-[color:var(--primary)]" label="Revenue" /><LegendDot color="bg-[color:var(--danger)]" label="Expenses" /><LegendDot color="bg-[color:var(--success)]" label="Profit" /></div>
              </div>
              <PerformanceChart data={performanceData} currency={currency} />
            </FinancePanel>
            <BusinessHealthCard score={businessHealth.score} label={businessHealth.label} grossMargin={grossMargin} netMargin={netMargin} expenseRatio={expenseRatio} stockHealth={productRows.length>0 ? ((productRows.length-lowStock.length)/productRows.length)*100 : 100} />
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <TopProductsPanel products={topProducts} currency={currency} />
            <InventoryHealthPanel healthy={Math.max(productRows.length-lowStock.length,0)} low={Math.max(lowStock.length-outOfStock.length,0)} out={outOfStock.length} total={productRows.length} inventoryValue={inventoryValue} currency={currency} />
            <RecentActivityPanel items={recentActivity} currency={currency} />
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <ExpenseBreakdownPanel rows={expenseBreakdown} total={totalExpenses} currency={currency} />
            <SupplierExposurePanel rows={supplierExposure} currency={currency} />
            <AlertsInsightsPanel lowStock={lowStock} netProfit={netProfit} expenseRatio={expenseRatio} grossMargin={grossMargin} topProducts={topProducts} currency={currency} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
            <DashboardAccountBalances
              accounts={activeAccountBalances}
              total={cashBalance}
              fallbackCurrency={currency}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <SummaryCard
                label="Expenses"
                value={formatMoney(totalExpenses, currency)}
                note={`${expenseRows.length} recorded expenses`}
                href="/dashboard/expenses"
              />
              <SummaryCard
                label="Inventory"
                value={formatMoney(inventoryValue, currency)}
                note={`${lowStock.length} products need attention`}
                href="/dashboard/products"
              />
              <SummaryCard
                label="Business Health"
                value={`${businessHealth.score}/100`}
                note={businessHealth.label}
                href="/dashboard/reports"
              />
              <SummaryCard
                label="Active Accounts"
                value={String(activeAccountBalances.length)}
                note="Open financial accounts"
                href="/dashboard/accounts"
              />
            </div>
          </section>
        </div>
      </main>
    </AdminShell>
  );
}


function CommandMetric({
  label,
  value,
  note,
  href,
  positive = true,
}: {
  label: string;
  value: string;
  note: string;
  href: string;
  positive?: boolean;
}) {
  return (
    <Link
      href={href}
      className="rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-4 transition hover:border-[color:var(--border-brand)] hover:bg-[color:var(--primary-soft)]"
    >
      <p className="text-[8px] uppercase tracking-[0.17em] text-[color:var(--text-muted)]">
        {label}
      </p>
      <p className="mt-2 truncate text-[15px] font-semibold tracking-[-0.025em] text-[color:var(--text-primary)]">
        {value}
      </p>
      <p
        className={`mt-1 truncate text-[9px] ${
          positive ? "text-[color:var(--primary)]" : "text-[color:var(--danger)]"
        }`}
      >
        {note}
      </p>
    </Link>
  );
}

function FounderBrief({
  items,
  generatedAt,
}: {
  items: ExecutiveBriefItem[];
  currency: string;
  generatedAt: Date;
}) {
  return (
    <FinancePanel
      title="Founder Brief"
      subtitle={`Derived from live company data · ${generatedAt.toLocaleDateString(
        "en-GB",
        { day: "numeric", month: "short", year: "numeric" }
      )}`}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item, index) => (
          <Link
            key={`${item.title}-${index}`}
            href={item.href}
            className={`group rounded-[var(--radius-md)] border px-4 py-4 transition ${
              item.tone === "warning"
                ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] hover:border-[color:var(--warning-border)]"
                : item.tone === "negative"
                  ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] hover:border-[color:var(--danger-border)]"
                  : "border-[color:var(--border)] bg-[color:var(--primary-soft)] hover:border-[color:var(--border-brand)]"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border text-[10px] font-semibold ${
                  item.tone === "warning"
                    ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning-foreground)]"
                    : item.tone === "negative"
                      ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
                      : "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
                }`}
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[color:var(--text-primary)]">
                  {item.title}
                </p>
                <p className="mt-1 text-[10px] leading-5 text-[color:var(--text-secondary)]">
                  {item.message}
                </p>
              </div>
              <span className="ml-auto text-[color:var(--text-muted)] transition group-hover:text-[color:var(--primary)]">
                →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </FinancePanel>
  );
}

function FinancialPosition({
  cashBalance,
  inventoryValue,
  revenue,
  expenses,
  netProfit,
  currency,
}: {
  cashBalance: number;
  inventoryValue: number;
  revenue: number;
  expenses: number;
  netProfit: number;
  currency: string;
}) {
  const positionRows = [
    {
      label: "Cash available",
      value: cashBalance,
      href: "/dashboard/accounts",
    },
    {
      label: "Inventory capital",
      value: inventoryValue,
      href: "/dashboard/products",
    },
    {
      label: "Revenue recorded",
      value: revenue,
      href: "/dashboard/sales",
    },
    {
      label: "Operating spend",
      value: expenses,
      href: "/dashboard/expenses",
    },
  ];

  return (
    <FinancePanel
      title="Financial Position"
      subtitle="Current company resources and operating result"
    >
      <div className="rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--primary-soft)] p-4">
        <p className="text-[9px] uppercase tracking-[0.15em] text-[color:var(--primary)]">
          Net operating result
        </p>
        <p
          className={`mt-2 text-[25px] font-semibold tracking-[-0.04em] ${
            netProfit >= 0 ? "text-[color:var(--success)]" : "text-[color:var(--danger)]"
          }`}
        >
          {formatMoney(netProfit, currency)}
        </p>
        <p className="mt-1 text-[9px] text-[color:var(--text-muted)]">
          Gross profit less recorded operating expenses
        </p>
      </div>

      <div className="mt-4 divide-y divide-[color:var(--divider)]">
        {positionRows.map((row) => (
          <Link
            key={row.label}
            href={row.href}
            className="flex items-center justify-between gap-4 py-3.5 transition hover:text-[color:var(--primary)]"
          >
            <span className="text-[11px] text-[color:var(--text-secondary)]">{row.label}</span>
            <span className="text-[12px] font-medium text-[color:var(--text-primary)]">
              {formatMoney(row.value, currency)}
            </span>
          </Link>
        ))}
      </div>
    </FinancePanel>
  );
}

function DashboardQuickActions() {
  const actions = [
    ["/dashboard/sales", "+ Record sale", true],
    ["/dashboard/expenses", "+ Add expense", false],
    ["/dashboard/products", "+ Add product", false],
    ["/dashboard/reports", "Generate report", false],
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map(([href, label, active]) => (
        <Link
          key={href}
          href={href}
          className={`rounded-[var(--radius-md)] border px-4 py-2.5 text-xs font-medium transition ${
            active
              ? "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)] hover:bg-[color:var(--primary-soft-hover)]"
              : "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-secondary)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)]"
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

function KpiCard({
  label,
  value,
  note,
  comparison,
  comparisonPositive,
  tone,
  href,
  values,
}: {
  label: string;
  value: string;
  note: string;
  comparison: string;
  comparisonPositive: boolean;
  tone: "cyan" | "green" | "blue" | "red" | "violet";
  href: string;
  values: number[];
}) {
  const toneClass = {
    cyan: "text-[color:var(--primary)] bg-[color:var(--primary-soft)] border-[color:var(--border-brand)]",
    green: "text-[color:var(--success)] bg-[color:var(--success-soft)] border-[color:var(--success-border)]",
    blue: "text-[color:var(--secondary)] bg-[color:var(--secondary-soft)] border-[color:var(--secondary-border)]",
    red: "text-[color:var(--danger)] bg-[color:var(--danger-soft)] border-[color:var(--danger-border)]",
    violet: "text-[color:var(--chart-5)] bg-[color:color-mix(in_srgb,var(--chart-5)_10%,transparent)] border-[color:color-mix(in_srgb,var(--chart-5)_28%,transparent)]",
  }[tone];

  return (
    <Link href={href} className="block">
      <div
        className={`${PANEL} min-h-[var(--kpi-card-min-height)] p-5 transition duration-[var(--duration-normal)] hover:translate-y-[var(--hover-lift)] hover:border-[color:var(--border-brand)]`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--text-secondary)]">
              {label}
            </p>
            <p className="mt-3 truncate text-[26px] font-semibold tracking-[-0.045em]">
              {value}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-[var(--radius-pill)] border px-2 py-1 text-[9px] font-medium ${
                  comparisonPositive
                    ? "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
                    : "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
                }`}
              >
                {comparison}
              </span>
              <span className="text-[10px] text-[color:var(--text-muted)]">{note}</span>
            </div>
          </div>

          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border ${toneClass}`}
          >
            <TrendIcon />
          </div>
        </div>

        <MiniChart values={values} tone={tone} />
      </div>
    </Link>
  );
}

function MiniChart({values,tone}:{values:number[];tone:"cyan"|"green"|"blue"|"red"|"violet"}){const color={cyan:"var(--chart-1)",green:"var(--chart-3)",blue:"var(--chart-2)",red:"var(--chart-6)",violet:"var(--chart-5)"}[tone];const data=values.length?values.slice(-12):[0];const max=Math.max(...data,1),min=Math.min(...data,0),range=Math.max(max-min,1);const points=data.map((v,i)=>`${data.length===1?110:(i/(data.length-1))*220},${58-((v-min)/range)*46}`).join(" ");return <svg viewBox="0 0 220 72" className="mt-5 h-[72px] w-full">{[14,36,58].map(y=><line key={y} x1="0" x2="220" y1={y} y2={y} stroke="var(--chart-grid)"/>)}<polyline points={points} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}

function PerformanceTabs({active}:{active:string}){return <div className="flex gap-2">{[{label:"Weekly",value:"weekly"},{label:"Monthly",value:"monthly"},{label:"Yearly",value:"yearly"}].map(tab=><Link key={tab.value} href={`/dashboard?period=${tab.value}`} className={`rounded-[var(--radius-md)] border px-4 py-2 text-xs font-medium transition ${active===tab.value?"border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]":"border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"}`}>{tab.label}</Link>)}</div>}

function PerformanceChart({data,currency}:{data:PerformancePoint[];currency:string}){const width=960,height=300,left=54,right=20,top=24,bottom=44,plotWidth=width-left-right,plotHeight=height-top-bottom;const values=data.flatMap(p=>[p.revenue,p.expenses,p.profit]);const max=Math.max(...values,1),min=Math.min(...values,0),range=Math.max(max-min,1);const path=(sel:(p:PerformancePoint)=>number)=>data.map((p,i)=>{const x=data.length===1?left+plotWidth/2:left+(i/(data.length-1))*plotWidth;const y=top+plotHeight-((sel(p)-min)/range)*plotHeight;return `${i===0?"M":"L"} ${x.toFixed(2)} ${y.toFixed(2)}`}).join(" ");return <svg viewBox={`0 0 ${width} ${height}`} className="mt-5 h-[300px] w-full">{[0,1,2,3,4].map(i=>{const y=top+(i/4)*plotHeight,value=max-(i/4)*range;return <g key={i}><line x1={left} x2={width-right} y1={y} y2={y} stroke="var(--chart-grid)"/><text x={left-8} y={y+3} textAnchor="end" fill="var(--chart-axis)" fontSize="9">{formatCompact(value,currency)}</text></g>})}<path d={path(p=>p.expenses)} fill="none" stroke="var(--chart-6)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><path d={path(p=>p.profit)} fill="none" stroke="var(--chart-3)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><path d={path(p=>p.revenue)} fill="none" stroke="var(--chart-1)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>{data.map((p,i)=>{const x=data.length===1?left+plotWidth/2:left+(i/(data.length-1))*plotWidth;return <text key={p.key} x={x} y={height-12} textAnchor="middle" fill="var(--chart-label)" fontSize="9">{p.label}</text>})}</svg>}

function BusinessHealthCard({score,label,grossMargin,netMargin,expenseRatio,stockHealth}:{score:number;label:string;grossMargin:number;netMargin:number;expenseRatio:number;stockHealth:number}){const ring=`conic-gradient(var(--chart-1) ${score*3.6}deg, var(--progress-track) 0deg)`;return <div className={`${PANEL} p-[var(--card-padding)]`}><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Business Health</p><p className="mt-1 text-[10px] text-[color:var(--text-tertiary)]">Live operating score</p></div><span className="text-[10px] text-[color:var(--primary)]">{label}</span></div><div className="mt-6 flex justify-center"><div className="relative h-40 w-40 rounded-[var(--radius-pill)]" style={{background:ring}}><div className="absolute inset-5 flex items-center justify-center rounded-[var(--radius-pill)] bg-[color:var(--surface)]"><div className="text-center"><p className="text-[34px] font-semibold tracking-[-0.05em]">{score}</p><p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-tertiary)]">out of 100</p></div></div></div></div><div className="mt-7 space-y-4"><MetricRow label="Gross Margin" value={`${grossMargin.toFixed(1)}%`}/><MetricRow label="Net Margin" value={`${netMargin.toFixed(1)}%`}/><MetricRow label="Expense Ratio" value={`${expenseRatio.toFixed(1)}%`}/><MetricRow label="Stock Health" value={`${stockHealth.toFixed(1)}%`}/></div></div>}
function MetricRow({label,value}:{label:string;value:string}){return <div className="flex items-center justify-between border-b border-[color:var(--border-subtle)] pb-3 last:border-b-0 last:pb-0"><span className="text-[11px] text-[color:var(--text-secondary)]">{label}</span><span className="text-[11px] font-medium text-[color:var(--text-primary)]">{value}</span></div>}

function TopProductsPanel({products,currency}:{products:TopProduct[];currency:string}){const max=Math.max(...products.map(p=>p.revenue),1);return <FinancePanel title="Top Selling Products" subtitle="Ranked by recorded revenue"><div className="space-y-5">{products.length?products.map((p,i)=><div key={`${p.name}-${i}`}><div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--primary-soft)] text-[11px] font-semibold text-[color:var(--primary)]">{i+1}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[12px] text-[color:var(--text-primary)]">{p.name}</p><p className="mt-1 text-[10px] text-[color:var(--text-muted)]">{p.quantity.toLocaleString("en-GB")} units sold</p></div><p className="shrink-0 text-[12px] font-medium text-[color:var(--primary)]">{formatMoney(p.revenue,currency)}</p></div><div className="mt-3 h-1.5 overflow-hidden rounded-[var(--radius-pill)] bg-[color:var(--surface-muted)]"><div className="h-full rounded-[var(--radius-pill)] bg-[image:linear-gradient(90deg,var(--chart-1),var(--chart-3))]" style={{width:`${Math.max((p.revenue/max)*100,2)}%`}}/></div></div></div></div>):<EmptyState text="No product sales recorded yet."/>}</div></FinancePanel>}

function InventoryHealthPanel({healthy,low,out,total,inventoryValue,currency}:{healthy:number;low:number;out:number;total:number;inventoryValue:number;currency:string}){return <FinancePanel title="Inventory Health" subtitle="Live stock position"><div className="space-y-5"><HealthBar label="Healthy" value={healthy} total={total} color="bg-[color:var(--success)]"/><HealthBar label="Low Stock" value={low} total={total} color="bg-[color:var(--progress-warning)]"/><HealthBar label="Out of Stock" value={out} total={total} color="bg-[color:var(--danger)]"/></div><div className="mt-6 rounded-[var(--radius-md)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-soft)] px-4 py-3"><p className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">Inventory value</p><p className="mt-2 text-lg font-semibold text-[color:var(--primary)]">{formatMoney(inventoryValue,currency)}</p></div></FinancePanel>}
function HealthBar({label,value,total,color}:{label:string;value:number;total:number;color:string}){const pct=total>0?(value/total)*100:0;return <div><div className="flex items-center justify-between text-[11px]"><span className="text-[color:var(--text-secondary)]">{label}</span><span className="font-medium text-[color:var(--text-primary)]">{value}</span></div><div className="mt-2 h-2 overflow-hidden rounded-[var(--radius-pill)] bg-[color:var(--surface-muted)]"><div className={`h-full rounded-[var(--radius-pill)] ${color}`} style={{width:`${Math.max(pct,value>0?3:0)}%`}}/></div></div>}

function RecentActivityPanel({items,currency}:{items:MoneyRow[];currency:string}){return <FinancePanel title="Recent Activity" subtitle="Latest business movements"><div className="space-y-4">{items.length?items.map(item=>{const isSale=item.total_amount!==undefined,amount=Number(item.total_amount||item.amount||0),date=new Date(item.sold_at||item.expense_date||item.created_at||"");return <div key={item.id} className="flex items-start gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-pill)] ${isSale?"bg-[color:var(--success-soft)] text-[color:var(--success)]":"bg-[color:var(--danger-soft)] text-[color:var(--danger)]"}`}>{isSale?<ArrowDownIcon/>:<ArrowUpIcon/>}</span><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><p className="truncate text-[12px] text-[color:var(--text-primary)]">{isSale?"Sale recorded":item.title||"Expense"}</p><p className="shrink-0 text-[11px] font-medium text-[color:var(--text-primary)]">{formatMoney(amount,currency)}</p></div><p className="mt-1 text-[10px] text-[color:var(--text-muted)]">{Number.isNaN(date.getTime())?"Recent":date.toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</p></div></div>}):<EmptyState text="No recent activity yet."/>}</div></FinancePanel>}

function ExpenseBreakdownPanel({rows,total,currency}:{rows:{name:string;value:number}[];total:number;currency:string}){const colors=["var(--chart-6)","var(--chart-4)","var(--warning)","var(--chart-5)","var(--chart-2)"];let cur=0;const gradient=rows.length&&total>0?rows.map((r,i)=>{const start=cur,end=start+(r.value/total)*360;cur=end;return `${colors[i]} ${start}deg ${end}deg`}).join(","):"var(--progress-track) 0deg 360deg";return <FinancePanel title="Expense Breakdown" subtitle="Top categories by spend"><div className="flex flex-col items-center gap-6"><div className="relative h-36 w-36 rounded-[var(--radius-pill)]" style={{background:`conic-gradient(${gradient})`}}><div className="absolute inset-5 flex items-center justify-center rounded-[var(--radius-pill)] bg-[color:var(--surface)]"><div className="text-center"><p className="text-[9px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">Total</p><p className="mt-1 text-xs font-semibold text-[color:var(--text-primary)]">{formatMoney(total,currency)}</p></div></div></div><div className="w-full space-y-3">{rows.map((r,i)=><div key={r.name} className="flex gap-2"><span className="mt-1.5 h-2 w-2 rounded-[var(--radius-pill)]" style={{backgroundColor:colors[i]}}/><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><p className="truncate text-[11px] text-[color:var(--text-secondary)]">{r.name}</p><p className="text-[11px] text-[color:var(--text-primary)]">{formatMoney(r.value,currency)}</p></div></div></div>)}</div></div></FinancePanel>}

function SupplierExposurePanel({rows,currency}:{rows:{supplier:string;value:number;products:number}[];currency:string}){const max=Math.max(...rows.map(r=>r.value),1);return <FinancePanel title="Supplier Exposure" subtitle="Inventory value by supplier"><div className="space-y-5">{rows.length?rows.map(r=><div key={r.supplier}><div className="flex justify-between gap-3"><div className="min-w-0"><p className="truncate text-[11px] text-[color:var(--text-secondary)]">{r.supplier}</p><p className="mt-1 text-[9px] text-[color:var(--text-muted)]">{r.products} product{r.products===1?"":"s"}</p></div><p className="text-[11px] font-medium text-[color:var(--chart-5)]">{formatMoney(r.value,currency)}</p></div><div className="mt-2 h-1.5 overflow-hidden rounded-[var(--radius-pill)] bg-[color:var(--surface-muted)]"><div className="h-full rounded-[var(--radius-pill)] bg-[image:linear-gradient(90deg,var(--chart-5),var(--chart-1))]" style={{width:`${Math.max((r.value/max)*100,2)}%`}}/></div></div>):<EmptyState text="No supplier data yet."/>}</div></FinancePanel>}

function AlertsInsightsPanel({lowStock,netProfit,expenseRatio,grossMargin,topProducts,currency}:{lowStock:ProductRow[];netProfit:number;expenseRatio:number;grossMargin:number;topProducts:TopProduct[];currency:string}){const insights=[netProfit<0?"Net profit is negative. Review expense growth and pricing.":`Net profit is positive at ${formatMoney(netProfit,currency)}.`,grossMargin<30?`Gross margin is ${grossMargin.toFixed(1)}%, which may indicate pricing or cost pressure.`:`Gross margin is healthy at ${grossMargin.toFixed(1)}%.`,expenseRatio>50?`Expenses consume ${expenseRatio.toFixed(1)}% of revenue and need attention.`:`Expense ratio is ${expenseRatio.toFixed(1)}% of revenue.`,topProducts[0]?`${topProducts[0].name} is currently the leading product by revenue.`:"No sales leader is available yet."];return <FinancePanel title="Alerts & Insights" subtitle="What needs your attention"><div className="space-y-4">{lowStock.slice(0,2).map(p=><div key={p.id} className="rounded-[var(--radius-md)] border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-4 py-3"><p className="text-[11px] font-medium text-[color:var(--warning-foreground)]">Stock alert · {p.item_name||p.name}</p><p className="mt-1 text-[10px] text-[color:var(--text-tertiary)]">On hand: {Number(p.quantity_on_hand||p.stock_quantity||0).toLocaleString("en-GB")}</p></div>)}{insights.map((insight,i)=><div key={insight} className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--primary-soft)] text-[10px] font-semibold text-[color:var(--primary)]">{i+1}</span><p className="text-[11px] leading-5 text-[color:var(--text-secondary)]">{insight}</p></div>)}</div></FinancePanel>}

function DashboardAccountBalances({
  accounts,
  total,
  fallbackCurrency,
}: {
  accounts: {
    id: string;
    name: string;
    accountType: string;
    currency: string;
    balance: number;
  }[];
  total: number;
  fallbackCurrency: string;
}) {
  return (
    <Link href="/dashboard/accounts" className="block">
      <div
        className={`${PANEL} h-full p-[var(--card-padding)] transition hover:border-[color:var(--border-brand)]`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Financial Accounts</p>
            <p className="mt-1 text-[10px] text-[color:var(--text-tertiary)]">
              Live balances from the cash ledger
            </p>
          </div>
          <span className="text-[10px] text-[color:var(--primary)]">
            {accounts.length} active
          </span>
        </div>

        <div className="mt-5 divide-y divide-[color:var(--divider)]">
          {accounts.length > 0 ? (
            accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center gap-3 py-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
                  <BankIcon />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-[color:var(--text-primary)]">
                    {account.name}
                  </p>
                  <p className="mt-1 text-[9px] capitalize text-[color:var(--text-muted)]">
                    {account.accountType.replaceAll("_", " ")} ·{" "}
                    {account.currency}
                  </p>
                </div>

                <p className="shrink-0 text-[13px] font-semibold text-[color:var(--text-primary)]">
                  {formatMoney(account.balance, account.currency)}
                </p>
              </div>
            ))
          ) : (
            <EmptyState text="No active financial accounts." />
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-[color:var(--border)] pt-4">
          <span className="text-sm font-semibold text-[color:var(--primary)]">
            Total cash
          </span>
          <span className="text-lg font-semibold text-[color:var(--primary)]">
            {formatMoney(total, fallbackCurrency)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function SummaryCard({label,value,note,href}:{label:string;value:string;note:string;href:string}){return <Link href={href} className="block"><div className={`${PANEL} p-[var(--card-padding)] transition hover:translate-y-[var(--hover-lift)] hover:border-[color:var(--border-brand)]`}><p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">{label}</p><p className="mt-3 text-xl font-semibold tracking-[-0.03em]">{value}</p><p className="mt-2 text-[10px] text-[color:var(--text-muted)]">{note}</p></div></Link>}
function FinancePanel({title,subtitle,children}:{title:string;subtitle:string;children:React.ReactNode}){return <div className={`${PANEL} p-[var(--card-padding)]`}><div className="mb-5"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-[10px] text-[color:var(--text-tertiary)]">{subtitle}</p></div>{children}</div>}
function LegendDot({color,label}:{color:string;label:string}){return <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-[var(--radius-pill)] ${color}`}/>{label}</span>}
function EmptyState({text}:{text:string}){return <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-6 text-sm text-[color:var(--text-secondary)]">{text}</div>}


type ExecutiveBriefItem = {
  title: string;
  message: string;
  href: string;
  tone: "positive" | "warning" | "negative";
};

function calculatePercentageChange(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function formatChange(value: number) {
  const normalized = Number.isFinite(value) ? value : 0;
  const prefix = normalized > 0 ? "▲ " : normalized < 0 ? "▼ " : "";
  return `${prefix}${Math.abs(normalized).toFixed(1)}% vs prior period`;
}

function getDayPart() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function getFirstName(value: string) {
  const normalized = String(value || "Founder").trim();
  if (normalized.includes("@")) return "Founder";
  return normalized.split(/\s+/)[0] || "Founder";
}

function buildExecutiveBrief({
  currency,
  totalRevenue,
  netProfit,
  cashBalance,
  grossMargin,
  expenseRatio,
  revenueChange,
  expenseChange,
  lowStockCount,
  outOfStockCount,
  topProduct,
}: {
  currency: string;
  totalRevenue: number;
  netProfit: number;
  cashBalance: number;
  grossMargin: number;
  expenseRatio: number;
  revenueChange: number;
  expenseChange: number;
  lowStockCount: number;
  outOfStockCount: number;
  topProduct?: TopProduct;
}): ExecutiveBriefItem[] {
  const brief: ExecutiveBriefItem[] = [];

  brief.push({
    title: revenueChange >= 0 ? "Revenue momentum is positive" : "Revenue momentum softened",
    message:
      revenueChange >= 0
        ? `Current-period revenue is ${Math.abs(revenueChange).toFixed(
            1
          )}% above the prior period. Total recorded revenue is ${formatMoney(
            totalRevenue,
            currency
          )}.`
        : `Current-period revenue is ${Math.abs(revenueChange).toFixed(
            1
          )}% below the prior period. Review sales activity and customer conversion.`,
    href: "/dashboard/sales",
    tone: revenueChange >= 0 ? "positive" : "warning",
  });

  brief.push({
    title: netProfit >= 0 ? "The company is operating profitably" : "Profitability requires attention",
    message:
      netProfit >= 0
        ? `Recorded net profit is ${formatMoney(
            netProfit,
            currency
          )}, with a ${grossMargin.toFixed(1)}% gross margin.`
        : `Recorded net profit is ${formatMoney(
            netProfit,
            currency
          )}. Pricing, cost of goods and operating spend should be reviewed.`,
    href: "/dashboard/reports",
    tone: netProfit >= 0 ? "positive" : "negative",
  });

  brief.push({
    title: expenseChange <= 0 ? "Expense pressure is controlled" : "Expenses increased",
    message:
      expenseChange <= 0
        ? `Current-period expenses are ${Math.abs(expenseChange).toFixed(
            1
          )}% lower than the prior period. The expense ratio is ${expenseRatio.toFixed(
            1
          )}%.`
        : `Current-period expenses increased ${Math.abs(
            expenseChange
          ).toFixed(1)}%. They now represent ${expenseRatio.toFixed(
            1
          )}% of recorded revenue.`,
    href: "/dashboard/expenses",
    tone: expenseChange <= 0 ? "positive" : "warning",
  });

  if (outOfStockCount > 0 || lowStockCount > 0) {
    brief.push({
      title: "Inventory action is required",
      message: `${outOfStockCount} products are out of stock and ${lowStockCount} products are at or below their stock threshold.`,
      href: "/dashboard/products",
      tone: outOfStockCount > 0 ? "negative" : "warning",
    });
  } else {
    brief.push({
      title: "Inventory levels are stable",
      message: "No products are currently at or below their configured stock threshold.",
      href: "/dashboard/products",
      tone: "positive",
    });
  }

  if (topProduct) {
    brief.push({
      title: `${topProduct.name} leads sales`,
      message: `${topProduct.name} has generated ${formatMoney(
        topProduct.revenue,
        currency
      )} from ${topProduct.quantity.toLocaleString("en-GB")} recorded units.`,
      href: "/dashboard/sales",
      tone: "positive",
    });
  }

  brief.push({
    title: cashBalance >= 0 ? "Cash position is visible" : "Cash balance is negative",
    message: `Active financial accounts currently total ${formatMoney(
      cashBalance,
      currency
    )}.`,
    href: "/dashboard/accounts",
    tone: cashBalance >= 0 ? "positive" : "negative",
  });

  return brief.slice(0, 6);
}

function sum(rows:MoneyRow[],key:keyof MoneyRow){return rows.reduce((t,r)=>t+Number(r[key]||0),0)}
function formatMoney(value:number,currency:string){return new Intl.NumberFormat("en-GB",{style:"currency",currency,maximumFractionDigits:0}).format(value)}
function formatCompact(value:number,currency:string){const symbol=new Intl.NumberFormat("en-GB",{style:"currency",currency,minimumFractionDigits:0,maximumFractionDigits:0}).formatToParts(0).find(p=>p.type==="currency")?.value;const a=Math.abs(value),sign=value<0?"-":"";if(a>=1_000_000)return `${sign}${symbol}${(a/1_000_000).toFixed(1)}m`;if(a>=1_000)return `${sign}${symbol}${(a/1_000).toFixed(1)}k`;return `${sign}${symbol}${Math.round(a)}`}
function deriveUnitCost(product:ProductRow){const saved=Number(product.price_per_piece||product.cost_price||0);return Number.isFinite(saved)?saved:0}
function getTopProducts(
  sales: MoneyRow[],
  products: ProductRow[]
): TopProduct[] {
  const productMap = new Map(
    products.map((product) => [product.id, product])
  );

  const totals = new Map<string, TopProduct>();

  for (const sale of sales) {
    const linkedProduct = sale.product_id
      ? productMap.get(sale.product_id)
      : undefined;

    const description = String(
      sale.description ||
        sale.title ||
        sale.product_name ||
        ""
    ).trim();

    const parsedDescription = description.match(
      /^\s*(\d+(?:\.\d+)?)\s*[×xX]\s*(.+?)\s*$/
    );

    const productName = (
      linkedProduct?.item_name ||
      linkedProduct?.name ||
      sale.product_name ||
      parsedDescription?.[2] ||
      description ||
      "Unknown product"
    ).trim();

    const directQuantity = Number(sale.quantity || 0);
    const parsedQuantity = parsedDescription
      ? Number(parsedDescription[1] || 0)
      : 0;

    const quantity =
      Number.isFinite(directQuantity) && directQuantity > 0
        ? directQuantity
        : Number.isFinite(parsedQuantity)
          ? parsedQuantity
          : 0;

    const productKey =
      sale.product_id ||
      linkedProduct?.id ||
      productName.toLowerCase();

    const current = totals.get(productKey) || {
      name: productName,
      revenue: 0,
      quantity: 0,
    };

    current.revenue += Number(sale.total_amount || 0);
    current.quantity += quantity;

    totals.set(productKey, current);
  }

  return Array.from(totals.values())
    .filter((product) => product.name !== "Unknown product")
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
}

function getExpenseBreakdown(expenses:MoneyRow[]){const totals=new Map<string,number>();expenses.forEach(e=>{const c=e.category||"Other";totals.set(c,(totals.get(c)||0)+Number(e.amount||0))});return Array.from(totals.entries()).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value).slice(0,5)}
function getSupplierExposure(products:ProductRow[]){const totals=new Map<string,{supplier:string;value:number;products:number}>();products.forEach(p=>{const supplier=p.supplier||"Unspecified",onHand=Number(p.quantity_on_hand||p.stock_quantity||0),value=onHand*deriveUnitCost(p),cur=totals.get(supplier)||{supplier,value:0,products:0};cur.value+=value;cur.products+=1;totals.set(supplier,cur)});return Array.from(totals.values()).sort((a,b)=>b.value-a.value).slice(0,5)}
function calculateBusinessHealth({totalRevenue,grossProfit,totalExpenses,netProfit,products,lowStock,outOfStock}:{totalRevenue:number;grossProfit:number;totalExpenses:number;netProfit:number;products:number;lowStock:number;outOfStock:number}){const gm=totalRevenue>0?grossProfit/totalRevenue:0,nm=totalRevenue>0?netProfit/totalRevenue:0,er=totalRevenue>0?totalExpenses/totalRevenue:0,sh=products>0?(products-lowStock-outOfStock)/products:1;const score=Math.max(0,Math.min(100,Math.round(gm*35+Math.max(nm,0)*30+Math.max(1-er,0)*20+Math.max(sh,0)*15)));const label=score>=85?"Excellent":score>=70?"Healthy":score>=50?"Needs attention":"At risk";return{score,label}}
function getPerformanceData(sales:MoneyRow[],expenses:MoneyRow[],period:string):PerformancePoint[]{const now=new Date();if(period==="weekly"){const days=Array.from({length:7},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()-(6-i));return{key:d.toISOString().slice(0,10),label:d.toLocaleDateString("en-GB",{weekday:"short"}),revenue:0,expenses:0,profit:0}});for(const s of sales){const d=new Date(s.sold_at||s.created_at||"");if(Number.isNaN(d.getTime()))continue;const row=days.find(x=>x.key===d.toISOString().slice(0,10));if(row){row.revenue+=Number(s.total_amount||0);row.profit+=Number(s.profit_amount||0)}}for(const e of expenses){const d=new Date(e.expense_date||e.created_at||"");if(Number.isNaN(d.getTime()))continue;const row=days.find(x=>x.key===d.toISOString().slice(0,10));if(row)row.expenses+=Number(e.amount||0)}return days}if(period==="yearly"){const years=Array.from({length:5},(_,i)=>{const y=now.getFullYear()-(4-i);return{key:String(y),label:String(y),revenue:0,expenses:0,profit:0}});for(const s of sales){const d=new Date(s.sold_at||s.created_at||"");if(Number.isNaN(d.getTime()))continue;const row=years.find(x=>x.key===String(d.getFullYear()));if(row){row.revenue+=Number(s.total_amount||0);row.profit+=Number(s.profit_amount||0)}}for(const e of expenses){const d=new Date(e.expense_date||e.created_at||"");if(Number.isNaN(d.getTime()))continue;const row=years.find(x=>x.key===String(d.getFullYear()));if(row)row.expenses+=Number(e.amount||0)}return years}const months=Array.from({length:12},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-(11-i),1);return{key:`${d.getFullYear()}-${d.getMonth()}`,label:d.toLocaleString("en-GB",{month:"short"}),revenue:0,expenses:0,profit:0}});for(const s of sales){const d=new Date(s.sold_at||s.created_at||"");if(Number.isNaN(d.getTime()))continue;const row=months.find(x=>x.key===`${d.getFullYear()}-${d.getMonth()}`);if(row){row.revenue+=Number(s.total_amount||0);row.profit+=Number(s.profit_amount||0)}}for(const e of expenses){const d=new Date(e.expense_date||e.created_at||"");if(Number.isNaN(d.getTime()))continue;const row=months.find(x=>x.key===`${d.getFullYear()}-${d.getMonth()}`);if(row)row.expenses+=Number(e.amount||0)}return months}
function SvgIcon({children,size=16}:{children:React.ReactNode;size?:number}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>}

function BankIcon() {
  return (
    <SvgIcon size={16}>
      <path d="m3 9 9-5 9 5" />
      <path d="M5 10v7M9 10v7M15 10v7M19 10v7M3 20h18" />
    </SvgIcon>
  );
}

function TrendIcon(){return <SvgIcon size={18}><path d="M4 17 9 12l4 4 7-9"/><path d="M15 7h5v5"/></SvgIcon>}
function ArrowDownIcon(){return <SvgIcon size={14}><path d="M12 4v16M6 14l6 6 6-6"/></SvgIcon>}
function ArrowUpIcon(){return <SvgIcon size={14}><path d="M12 20V4M6 10l6-6 6 6"/></SvgIcon>}