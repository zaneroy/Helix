"use client";

export type InvestorsSqlHealth = {
  name?: string;
  scope?: string;
  total_tests?: number;
  passed_tests?: number;
  failed_tests?: number;
  critical_passed?: boolean;
  important_passed?: boolean;
};

export type CompanyInvestorOverview = {
  company_id?: string;
  source_kind?: string;
  snapshot_run_id?: string | null;
  snapshot_number?: string | null;
  as_of_at?: string | null;
  investor_count?: number;
  total_shares_held?: number | string | null;
  investors?: Array<{
    investor_id?: string;
    position_count?: number;
    total_shares_held?: number | string | null;
    company_ownership_percent?: number | string | null;
    fully_diluted_ownership_percent?: number | string | null;
    estimated_cost_basis?: number | string | null;
    last_transaction_at?: string | null;
  }>;
};

export type CompanyCapTableSummary = {
  company_id?: string;
  source_kind?: string;
  snapshot_run_id?: string | null;
  snapshot_number?: string | null;
  snapshot_status?: string | null;
  as_of_at?: string | null;
  calculation_basis?: string | null;
  class_count?: number;
  shareholder_position_count?: number;
  total_issued_shares?: number | string | null;
  total_positive_shares?: number | string | null;
  total_negative_shares?: number | string | null;
  fully_diluted_shares?: number | string | null;
  reserved_shares?: number | string | null;
  option_pool_shares?: number | string | null;
  convertible_shares?: number | string | null;
  classes?: Array<{
    equity_class_id?: string;
    issued_shares?: number | string | null;
    holder_count?: number;
    active_holder_count?: number;
    company_ownership_percent?: number | string | null;
    fully_diluted_shares?: number | string | null;
    fully_diluted_ownership_percent?: number | string | null;
    estimated_cost_basis?: number | string | null;
    last_transaction_at?: string | null;
  }>;
};

type Props = {
  health: InvestorsSqlHealth | null;
  investorOverview: CompanyInvestorOverview | null;
  capTableSummary: CompanyCapTableSummary | null;
  currency: string;
};

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number | string | null | undefined) {
  return numberValue(value).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number | string | null | undefined) {
  return `${numberValue(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}%`;
}

function formatMoney(value: number | string | null | undefined, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(numberValue(value));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No snapshot yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No snapshot yet";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(value: string | null | undefined) {
  if (!value) return "—";
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function labelize(value: string | null | undefined) {
  return String(value || "not available").replaceAll("_", " ");
}

function HealthBadge({ health }: { health: InvestorsSqlHealth | null }) {
  const healthy =
    health?.critical_passed === true &&
    health?.important_passed === true &&
    Number(health?.failed_tests || 0) === 0;

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        healthy
          ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
          : "border-amber-300/30 bg-amber-400/10 text-amber-200",
      ].join(" ")}
    >
      <span
        className={[
          "mr-2 h-1.5 w-1.5 rounded-full",
          healthy ? "bg-emerald-300" : "bg-amber-300",
        ].join(" ")}
      />
      {healthy ? "SQL 100% healthy" : "Needs review"}
    </span>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.22)]">
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-400">{note}</p>
    </div>
  );
}

export default function InvestorsCommandCenter({
  health,
  investorOverview,
  capTableSummary,
  currency,
}: Props) {
  const investors = investorOverview?.investors || [];
  const classes = capTableSummary?.classes || [];

  const healthy =
    health?.critical_passed === true &&
    health?.important_passed === true &&
    Number(health?.failed_tests || 0) === 0;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#03080a] shadow-[0_24px_90px_rgba(0,0,0,0.45)]">
      <div className="relative border-b border-white/10 p-6 md:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.18),transparent_36%),radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.12),transparent_30%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
                Investors Command Center
              </p>
              <HealthBadge health={health} />
            </div>

            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Enterprise investor ownership system
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Live admin view powered by the completed Investors SQL backend:
              immutable ledger, holdings projection, cap table snapshots,
              fully diluted scenarios, and investor/admin read APIs.
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] px-5 py-4 text-sm">
            <p className="text-slate-400">Backend health</p>
            <p className="mt-1 text-xl font-semibold text-cyan-100">
              {health?.passed_tests || 0}/{health?.total_tests || 0} tests
            </p>
            <p className={healthy ? "mt-1 text-emerald-300" : "mt-1 text-amber-300"}>
              {health?.failed_tests || 0} failed
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-6 md:grid-cols-2 md:p-7 xl:grid-cols-4">
        <MetricCard
          label="Investors"
          value={investorOverview?.investor_count || 0}
          note="Mapped investor holders"
        />
        <MetricCard
          label="Issued shares"
          value={formatNumber(capTableSummary?.total_issued_shares)}
          note="From cap table summary"
        />
        <MetricCard
          label="Total investor shares"
          value={formatNumber(investorOverview?.total_shares_held)}
          note="From investor overview API"
        />
        <MetricCard
          label="Snapshot"
          value={capTableSummary?.snapshot_number || "Live"}
          note={`${labelize(capTableSummary?.source_kind)} · ${formatDate(
            capTableSummary?.as_of_at
          )}`}
        />
      </div>

      <div className="grid gap-5 border-t border-white/10 p-6 md:p-7 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.025]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <h3 className="font-semibold text-white">Investor ownership</h3>
              <p className="mt-1 text-xs text-slate-500">
                Admin overview from api_get_company_investor_overview
              </p>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">
              {investors.length} rows
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr className="border-b border-white/10">
                  <th className="px-5 py-3 font-medium">Investor</th>
                  <th className="px-5 py-3 font-medium">Positions</th>
                  <th className="px-5 py-3 font-medium">Shares</th>
                  <th className="px-5 py-3 font-medium">Ownership</th>
                  <th className="px-5 py-3 font-medium">Fully diluted</th>
                  <th className="px-5 py-3 font-medium">Cost basis</th>
                </tr>
              </thead>
              <tbody>
                {investors.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-slate-500" colSpan={6}>
                      No investor ownership rows yet. Create/post equity ledger
                      transactions, then run holdings and cap table snapshots.
                    </td>
                  </tr>
                ) : (
                  investors.slice(0, 12).map((investor) => (
                    <tr
                      key={investor.investor_id}
                      className="border-b border-white/[0.06] last:border-0"
                    >
                      <td className="px-5 py-4 font-medium text-white">
                        {shortId(investor.investor_id)}
                      </td>
                      <td className="px-5 py-4 text-slate-300">
                        {investor.position_count || 0}
                      </td>
                      <td className="px-5 py-4 text-slate-300">
                        {formatNumber(investor.total_shares_held)}
                      </td>
                      <td className="px-5 py-4 text-cyan-200">
                        {formatPercent(investor.company_ownership_percent)}
                      </td>
                      <td className="px-5 py-4 text-slate-300">
                        {investor.fully_diluted_ownership_percent == null
                          ? "—"
                          : formatPercent(investor.fully_diluted_ownership_percent)}
                      </td>
                      <td className="px-5 py-4 text-slate-300">
                        {formatMoney(investor.estimated_cost_basis, currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.025]">
          <div className="border-b border-white/10 px-5 py-4">
            <h3 className="font-semibold text-white">Class summary</h3>
            <p className="mt-1 text-xs text-slate-500">
              Ownership by equity class
            </p>
          </div>

          <div className="divide-y divide-white/[0.06]">
            {classes.length === 0 ? (
              <div className="px-5 py-8 text-sm text-slate-500">
                No cap table classes available yet.
              </div>
            ) : (
              classes.slice(0, 8).map((item) => (
                <div key={item.equity_class_id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-white">
                        {shortId(item.equity_class_id)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.active_holder_count || 0} active holders
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-cyan-200">
                        {formatPercent(item.company_ownership_percent)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatNumber(item.issued_shares)} shares
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
