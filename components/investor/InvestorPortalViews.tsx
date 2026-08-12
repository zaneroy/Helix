import type { ReactNode } from "react";
import type {
  InvestorCapitalRequest,
  InvestorPortalCertificate,
  InvestorPortalDocument,
  InvestorPortalNotification,
  InvestorPortalOffer,
  InvestorPortalReadModel,
  InvestorPortalTrendPoint,
} from "@/types/investor-portal";
import ProfileAppearanceCard from "@/components/theme/ProfileAppearanceCard";
import {
  Activity,
  BadgeCheck,
  Banknote,
  Bell,
  BookOpen,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  Fingerprint,
  KeyRound,
  Landmark,
  LineChart,
  Mail,
  PieChart,
  ShieldCheck,
  TrendingUp,
  UserRound,
  WalletCards,
} from "lucide-react";
import {
  InvestorCertificatePdfButton,
  InvestorOfferPdfButton,
  InvestorReportPdfButton,
  SecureUploadedDocumentButton,
} from "@/components/investor/InvestorPortalPdfButtons";
import InvestorCapitalRequestForm from "@/components/investor/InvestorCapitalRequestForm";
import { markInvestorNotificationRead } from "@/lib/actions/investor-portal";

function money(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `${currency} ${Number(value || 0).toFixed(2)}`;
  }
}

function percent(value: number): string {
  return `${Number(value || 0).toFixed(2).replace(/\.00$/, "")}%`;
}

function returnLabel(summary: InvestorPortalReadModel["summary"]): string {
  if (summary.totalInvestment <= 0) return "No completed investment";

  return "Unrealised";
}

function valuationLabel(summary: InvestorPortalReadModel["summary"]): string {
  if (summary.companyValue <= 0) return "Not set";

  return money(summary.companyValue, summary.currency);
}

function dateLabel(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function SectionTitle({
  eyebrow,
  subtitle,
  title,
}: {
  eyebrow: string;
  subtitle: string;
  title: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--primary)]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
        {title}
      </h2>
      <p className="mt-1 max-w-4xl text-sm leading-6 text-[var(--text-tertiary)]">{subtitle}</p>
    </div>
  );
}

function MetricCard({
  caption,
  label,
  value,
}: {
  caption: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-4 shadow-[var(--shadow-card)]">
      <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
        {label}
      </p>
      <p className="mt-3 text-[24px] font-semibold tracking-[-0.045em] text-[var(--text-primary)]">{value}</p>
      <p className="mt-2 min-h-[32px] text-[11px] leading-4 text-[var(--primary)]">{caption}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const clean = status.toLowerCase();
  const good = ["completed", "payment_received", "issued", "read"].includes(clean);
  const bad = ["cancelled", "rejected", "failed"].includes(clean);

  return (
    <span
      className={[
        "inline-flex w-fit rounded-full border px-2.5 py-1 text-[10px] font-semibold capitalize",
        good
          ? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]"
          : bad
            ? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]"
            : "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]",
      ].join(" ")}
    >
      {statusLabel(status)}
    </span>
  );
}

function ChartCard({
  title,
  subtitle,
  trends,
}: {
  title: string;
  subtitle: string;
  trends: {
    revenue: InvestorPortalTrendPoint[];
    profit: InvestorPortalTrendPoint[];
    expenses: InvestorPortalTrendPoint[];
  };
}) {
  const revenue = linePath(trends.revenue);
  const profit = linePath(trends.profit);
  const expenses = linePath(trends.expenses);

  return (
    <section className="rounded-[1.5rem] border border-[var(--primary-border)] bg-[var(--surface-soft)] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
        {title}
      </p>
      <p className="mt-1 text-sm text-[var(--text-tertiary)]">{subtitle}</p>

      <div className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--surface-soft)] p-5">
        <div className="mb-5 flex flex-wrap gap-5 text-sm text-[var(--text-tertiary)]">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
            Revenue
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--success)]" />
            Profit
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--danger)]" />
            Expenses
          </span>
        </div>

        <svg className="h-64 w-full overflow-visible" viewBox="0 0 780 300" aria-hidden="true">
          {[60, 120, 180, 240].map((y) => (
            <line key={y} x1="0" y1={y} x2="780" y2={y} stroke="var(--chart-grid)" />
          ))}
          <polyline points={revenue} fill="none" stroke="var(--chart-1)" strokeWidth="3" />
          <polyline points={profit} fill="none" stroke="var(--chart-3)" strokeWidth="2" />
          <polyline points={expenses} fill="none" stroke="var(--chart-6)" strokeWidth="2" />
        </svg>
      </div>
    </section>
  );
}

function linePath(points: InvestorPortalTrendPoint[]): string {
  const values = points.map((point) => Number(point.value || 0));
  const max = values.reduce((largest, value) => Math.max(largest, Math.abs(value)), 1);
  const step = values.length > 1 ? 780 / (values.length - 1) : 780;

  return values
    .map((value, index) => {
      const x = Math.round(index * step);
      const y = Math.round(280 - (Math.abs(value) / max) * 240);

      return `${x},${y}`;
    })
    .join(" ");
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-4 last:border-b-0">
      <span className="text-sm text-[var(--text-tertiary)]">{label}</span>
      <span className="text-right text-sm font-semibold text-[var(--primary)]">{value}</span>
    </div>
  );
}


type DashboardIcon = (props: { className?: string }) => ReactNode;

function DashboardHero({ model }: { model: InvestorPortalReadModel }) {
  const { summary } = model;

  return (
    <section className="rounded-2xl border border-[var(--primary-border)] bg-[image:var(--gradient-hero)] p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr] xl:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">
              {summary.companyName}
            </span>
            <span className="rounded-full border border-[var(--success-border)] bg-[var(--success-soft)] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--success)]">
              {percent(summary.equityPercent)} equity owned
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
              {summary.currency} reporting
            </span>
          </div>

          <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.055em] text-[#0b1f3a] sm:text-[34px]">
  Investment overview
</h2>

<p className="mt-2 max-w-3xl text-[12px] leading-5 text-[#61778d]">
  Read-only view of your completed equity, capital contributed, company performance,
  documents and investor activity.
</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <HeroMiniStat
            icon={WalletCards}
            label="Total invested"
            value={money(summary.totalInvestment, summary.currency)}
          />
          <HeroMiniStat
            icon={BookOpen}
            label="Book value"
            value={money(summary.estimatedHoldingValue, summary.currency)}
          />
          <HeroMiniStat icon={Activity} label="Return status" value={returnLabel(summary)} />
        </div>
      </div>
    </section>
  );
}

function HeroMiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: DashboardIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-[78px] items-center justify-between gap-4 rounded-xl border border-[var(--primary-border)] bg-[var(--surface-soft)] px-4 py-3">
      <div>
        <p className="text-[8px] font-semibold uppercase tracking-[0.19em] text-[var(--text-tertiary)]">
          {label}
        </p>
        <p className="mt-2 text-[17px] font-semibold tracking-[-0.035em] text-[var(--text-primary)]">{value}</p>
      </div>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]">
        <Icon className="h-[19px] w-[19px]" />
      </span>
    </div>
  );
}

function DashboardMetricGrid({ model }: { model: InvestorPortalReadModel }) {
  const { summary } = model;
  const currency = summary.currency;

  const metrics = [
    {
      icon: PieChart,
      label: "My equity",
      value: percent(summary.equityPercent),
      caption: "Your completed equity",
    },
    {
      icon: CircleDollarSign,
      label: "Total invested",
      value: money(summary.totalInvestment, currency),
      caption: "Total capital you have invested",
    },
    {
      icon: FileText,
      label: "Valuation basis",
      value: valuationLabel(summary),
      caption: "Based on completed investment terms",
    },
    {
      icon: BookOpen,
      label: "Book value",
      value: money(summary.estimatedHoldingValue, currency),
      caption: `Your investment carried at cost (${currency})`,
    },
    {
      icon: Landmark,
      label: "Company cash",
      value: money(summary.companyCash, currency),
      caption: "Linked from accounts. Not used for ROI.",
    },
    {
      icon: LineChart,
      label: "Company sales",
      value: money(summary.companySales, currency),
      caption: "From live sales records",
    },
    {
      icon: TrendingUp,
      label: "Capital raised",
      value: money(summary.companyCapitalRaised, currency),
      caption: "Total capital raised to date",
    },
    {
      icon: CheckCircle2,
      label: "Open offers",
      value: `${summary.pendingOfferCount}`,
      caption: "Pending offers requiring action",
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <DashboardMetricCard key={metric.label} {...metric} />
      ))}
    </div>
  );
}

function DashboardMetricCard({
  caption,
  icon: Icon,
  label,
  value,
}: {
  caption: string;
  icon: DashboardIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-3.5 shadow-[var(--shadow-card)]">
      <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-[var(--primary-soft)] opacity-0 transition group-hover:opacity-100" />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
            {label}
          </p>
          <p className="mt-2.5 text-[22px] font-semibold tracking-[-0.045em] text-[var(--text-primary)]">{value}</p>
          <p className="mt-2 min-h-[28px] text-[10px] leading-4 text-[var(--text-tertiary)]">{caption}</p>
        </div>

        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]">
          <Icon className="h-[17px] w-[17px]" />
        </span>
      </div>
    </div>
  );
}

function InvestorPositionPanel({ model }: { model: InvestorPortalReadModel }) {
  const { summary } = model;
  const completedEquity = Math.max(
    Math.min(Number(summary.equityPercent || 0), 100),
    summary.equityPercent > 0 ? 4 : 0,
  );

  return (
    <section className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-[17px] font-semibold tracking-[-0.035em] text-[var(--text-primary)]">
            Your position
          </h3>
          <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">Your completed equity</p>
        </div>
        <span className="text-[12px] font-semibold text-[var(--primary)]">
          {percent(summary.equityPercent)}
        </span>
      </div>

      <div className="mt-4 h-2.5 rounded-full bg-[var(--surface-soft)]">
        <div
          className="h-full rounded-full bg-[var(--primary)] shadow-[var(--glow-brand)]"
          style={{ width: `${completedEquity}%` }}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
        <MiniPosition label="Capital into company" value={money(summary.capitalContributed, summary.currency)} />
        <MiniPosition label="Secondary purchase" value={money(summary.founderPurchaseAmount, summary.currency)} />
        <MiniPosition label="Book value" value={money(summary.estimatedHoldingValue, summary.currency)} />
      </div>
    </section>
  );
}

function MiniPosition({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
      <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-3 text-[15px] font-semibold tracking-[-0.035em] text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function PerformanceReportingPanel({ model }: { model: InvestorPortalReadModel }) {
  return (
    <section className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-hero)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-[19px] font-semibold tracking-[-0.045em] text-[#0b1f3a]">
  Performance & reporting
</h3>

<p className="mt-2 text-[11px] leading-5 text-[#61778d]">
  Investor-visible sales and cash movement from live company records.
</p>
        </div>
        <span className="w-fit rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-[10px] text-[var(--text-tertiary)]">
          6M
        </span>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <SalesTrendChart points={model.trends.companySales.length ? model.trends.companySales : model.trends.revenue} />
        <CashMovementChart points={model.trends.companyCash} currency={model.summary.currency} />
      </div>
    </section>
  );
}


function SalesTrendChart({ points }: { points: InvestorPortalTrendPoint[] }) {
  const safePoints = points.length ? points : [{ key: "empty", label: "Now", value: 0 }];
  const visiblePoints = safePoints.slice(-6);
  const path = dashboardLinePath(visiblePoints);
  const values = visiblePoints.map((point) => Number(point.value || 0));
  const max = values.reduce((largest, value) => Math.max(largest, value), 1);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3.5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
            Company sales trend (GBP)
          </p>
          <p className="mt-1 text-[10px] text-[var(--text-muted)]">Recognised sales across the last six periods</p>
        </div>
        <span className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[9px] text-[var(--text-tertiary)]">6M</span>
      </div>

      <div className="grid grid-cols-[38px_1fr] gap-3">
        <div className="flex h-[160px] flex-col justify-between pb-6 pt-2 text-right text-[8px] text-[var(--text-muted)]">
          <span>{compactMoney(max)}</span>
          <span>{compactMoney(max * 0.66)}</span>
          <span>{compactMoney(max * 0.33)}</span>
          <span>£0</span>
        </div>

        <div>
          <svg className="h-[160px] w-full overflow-visible" viewBox="0 0 720 160" preserveAspectRatio="none" aria-hidden="true">
            {[24, 61, 98, 135].map((y) => (
              <line key={y} x1="0" y1={y} x2="720" y2={y} stroke="var(--chart-grid)" />
            ))}
            <path
              d={linePathD(path)}
              fill="none"
              stroke="var(--chart-1)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="4"
              vectorEffect="non-scaling-stroke"
            />
            {path.split(" ").map((point) => {
              const [x, y] = point.split(",");
              return (
                <circle
                  key={point}
                  cx={x}
                  cy={y}
                  r="4"
                  fill="var(--primary-soft)"
                  stroke="var(--chart-1)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>

          <div className="mt-2 flex justify-between text-[9px] text-[var(--text-tertiary)]">
            {visiblePoints.map((point) => (
              <span key={point.key}>{point.label}</span>
            ))}
          </div>

          <p className="mt-3 text-center text-[10px] text-[var(--primary)]">Sales</p>
        </div>
      </div>
    </div>
  );
}


function CashMovementChart({
  currency,
  points,
}: {
  currency: string;
  points: InvestorPortalTrendPoint[];
}) {
  const bars = cashMovement(points).slice(-6);
  const max = bars.reduce((largest, point) => Math.max(largest, Math.abs(point.value)), 1);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3.5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
            Monthly cash movement ({currency})
          </p>
          <p className="mt-1 text-[10px] text-[var(--text-muted)]">Net movement between monthly account balances</p>
        </div>
        <span className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[9px] text-[var(--text-tertiary)]">6M</span>
      </div>

      <div className="grid grid-cols-[38px_1fr] gap-3">
        <div className="flex h-[160px] flex-col justify-between pb-6 pt-2 text-right text-[8px] text-[var(--text-muted)]">
          <span>{compactMoney(max)}</span>
          <span>{compactMoney(max * 0.5)}</span>
          <span>£0</span>
          <span>-{compactMoney(max * 0.5).replace("-", "")}</span>
          <span>-{compactMoney(max).replace("-", "")}</span>
        </div>

        <div>
          <div className="relative flex h-[160px] items-end gap-3 border-b border-[var(--border)] pb-6">
            <div className="absolute left-0 right-0 top-1/2 h-px bg-[var(--surface-soft)]" />
            {[24, 58, 102, 138].map((top) => (
              <div key={top} className="absolute left-0 right-0 h-px bg-[var(--surface-subtle)]" style={{ top }} />
            ))}

            {bars.map((bar) => {
              const height = Math.max(10, Math.round((Math.abs(bar.value) / max) * 52));
              const positive = bar.value >= 0;

              return (
                <div key={bar.key} className="relative z-10 flex flex-1 flex-col items-center justify-end gap-3">
                  <div className="relative h-[110px] w-full">
                    <div
                      className={[
                        "absolute left-1/2 w-[62%] -translate-x-1/2 rounded-md shadow-[var(--glow-brand)]",
                        positive ? "bottom-1/2 bg-[var(--success-soft)]" : "top-1/2 bg-[var(--danger-soft)]",
                      ].join(" ")}
                      style={{ height: `${height}px` }}
                    />
                  </div>
                  <span className="text-[9px] text-[var(--text-tertiary)]">{bar.label}</span>
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-center text-[10px] text-[var(--primary)]">Net cash movement</p>
        </div>
      </div>
    </div>
  );
}


function DashboardBottomPanel({ model }: { model: InvestorPortalReadModel }) {
  const completedOffer = model.offers.find((offer) => offer.status === "completed") || model.offers[0] || null;
  const certificate = model.certificates[0] || null;

  return (
    <section className="rounded-2xl border border-[var(--primary-border)] bg-[image:var(--gradient-hero)] p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(390px,0.75fr)]">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-[19px] font-semibold tracking-[-0.04em] text-[#0b1f3a]">
  Documents & updates
</h3>

<p className="mt-2 text-[11px] text-[#61778d]">
  Investor reports, agreements and certificates approved for your account.
</p>
            </div>
            <span className="hidden rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-2 text-[9px] font-medium text-[var(--primary)] sm:block">
              Investor document centre
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <DashboardDocumentCard
              icon={FileText}
              title="Latest report"
              subtitle={`${model.summary.companyName} investor report`}
              meta="Generated PDF"
              dateLabel="Live report"
            >
              <InvestorReportPdfButton
                companyId={model.summary.companyId}
                companyName={model.summary.companyName}
                currency={model.summary.currency}
                report={model.reports}
                type="investor_report_pdf"
              />
            </DashboardDocumentCard>

            <DashboardDocumentCard
              icon={FileCheck2}
              title="Investment agreement"
              subtitle={completedOffer ? completedOffer.title : "No completed agreement yet"}
              meta="Agreement PDF"
              dateLabel={completedOffer ? dateLabel(completedOffer.completedAt || completedOffer.createdAt) : "Pending"}
            >
              {completedOffer ? (
                <InvestorOfferPdfButton
                  companyId={model.summary.companyId}
                  companyName={model.summary.companyName}
                  currency={model.summary.currency}
                  offer={completedOffer}
                  type="agreement_pdf"
                />
              ) : (
                <span className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-[10px] text-[var(--text-tertiary)]">
                  Not available
                </span>
              )}
            </DashboardDocumentCard>

            <DashboardDocumentCard
              icon={ShieldCheck}
              title="Share certificate"
              subtitle={certificate ? certificate.certificateNumber : "No certificate issued yet"}
              meta="Certificate PDF"
              dateLabel={certificate ? dateLabel(certificate.issuedAt) : "Pending"}
            >
              {certificate ? (
                <InvestorCertificatePdfButton
                  certificate={certificate}
                  companyId={model.summary.companyId}
                  companyName={model.summary.companyName}
                  currency={model.summary.currency}
                />
              ) : (
                <span className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-[10px] text-[var(--text-tertiary)]">
                  Not available
                </span>
              )}
            </DashboardDocumentCard>
          </div>
        </div>

        <RecentActivityPanel model={model} />
      </div>
    </section>
  );
}

function DashboardDocumentCard({
  children,
  dateLabel: date,
  icon: Icon,
  meta,
  subtitle,
  title,
}: {
  children: ReactNode;
  dateLabel: string;
  icon: DashboardIcon;
  meta: string;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="flex min-h-[188px] min-w-0 flex-col justify-between rounded-xl border border-[var(--primary-border)] bg-[var(--surface-soft)] p-4">
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]">
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-[var(--text-primary)]">{title}</p>
            <p className="mt-1 line-clamp-2 min-h-[34px] text-[10px] leading-4 text-[var(--text-tertiary)]">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <p className="mb-3 truncate text-[10px] text-[var(--primary)]">{meta}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-[9px] text-[var(--text-tertiary)]">{date}</span>
          <div className="shrink-0 [&_a]:h-9 [&_a]:rounded-lg [&_a]:px-3 [&_a]:py-2 [&_a]:text-[10px] [&_button]:h-9 [&_button]:rounded-lg [&_button]:px-3 [&_button]:py-2 [&_button]:text-[10px]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function RecentActivityPanel({ model }: { model: InvestorPortalReadModel }) {
  const activity = model.activity.slice(0, 6);
  const fallback = model.notifications.slice(0, 6).map((notice) => ({
    id: notice.id,
    type: notice.type || "notification",
    title: notice.title,
    description: notice.message,
    createdAt: notice.createdAt,
  }));
  const items = activity.length ? activity : fallback;

  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-[19px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">Recent activity</h3>
          <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">Latest investor-visible events.</p>
        </div>
        <span className="text-[10px] font-medium text-[var(--primary)]">View all</span>
      </div>

      <div className="mt-5 space-y-3.5">
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-start gap-3">
            <ActivityDot type={item.type} />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-[var(--text-primary)]">{item.title}</p>
              <p className="mt-1 line-clamp-1 text-[9px] leading-4 text-[var(--text-tertiary)]">{item.description}</p>
            </div>
            <span className="shrink-0 pt-0.5 text-right text-[9px] text-[var(--text-tertiary)]">
              {dateLabel(item.createdAt)}
            </span>
          </div>
        ))}

        {!items.length && (
          <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-[10px] text-[var(--text-tertiary)]">
            No investor activity yet.
          </p>
        )}
      </div>
    </div>
  );
}


function ActivityDot({ type }: { type: string }) {
  const clean = type.toLowerCase();
  const Icon =
    clean.includes("download")
      ? Download
      : clean.includes("certificate")
        ? ShieldCheck
        : clean.includes("payment")
          ? Banknote
          : clean.includes("document") || clean.includes("report")
            ? FileText
            : CheckCircle2;

  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]">
      <Icon className="h-[14px] w-[14px]" />
    </span>
  );
}

function dashboardLinePath(points: InvestorPortalTrendPoint[]): string {
  const safePoints = points.length ? points.slice(-6) : [{ key: "empty", label: "Now", value: 0 }];
  const values = safePoints.map((point) => Number(point.value || 0));
  const max = values.reduce((largest, value) => Math.max(largest, Math.abs(value)), 1);
  const step = safePoints.length > 1 ? 720 / (safePoints.length - 1) : 720;

  return safePoints
    .map((point, index) => {
      const value = Number(point.value || 0);
      const x = Math.round(index * step);
      const y = Math.round(135 - (value / max) * 92);

      return `${x},${Math.max(20, Math.min(145, y))}`;
    })
    .join(" ");
}

function linePathD(points: string): string {
  const parts = points.split(" ").filter(Boolean);

  if (!parts.length) return "";

  return parts
    .map((point, index) => {
      const [x, y] = point.split(",");

      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function compactMoney(value: number): string {
  const amount = Math.abs(Number(value || 0));

  if (amount >= 1000) return `£${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}k`;

  return `£${Math.round(amount)}`;
}

function cashMovement(points: InvestorPortalTrendPoint[]): InvestorPortalTrendPoint[] {
  const source = points.length ? points.slice(-6) : [{ key: "empty", label: "Now", value: 0 }];

  return source.map((point, index) => {
    const previous = index > 0 ? Number(source[index - 1].value || 0) : 0;
    const current = Number(point.value || 0);

    return {
      ...point,
      value: current - previous,
    };
  });
}

export function InvestorDashboardView({ model }: { model: InvestorPortalReadModel }) {
  return (
    <section className="space-y-4">
      <DashboardHero model={model} />

      <DashboardMetricGrid model={model} />

      <div className="grid gap-4 xl:grid-cols-[0.46fr_1.54fr]">
        <InvestorPositionPanel model={model} />
        <PerformanceReportingPanel model={model} />
      </div>

      <DashboardBottomPanel model={model} />
    </section>
  );
}


function TopProducts({ model }: { model: InvestorPortalReadModel }) {
  const currency = model.summary.currency;

  return (
    <section className="rounded-[1.5rem] border border-[var(--primary-border)] bg-[var(--surface-soft)] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
        Top selling products
      </p>
      <p className="mt-1 text-sm text-[var(--text-tertiary)]">Ranked by revenue</p>

      <div className="mt-5 space-y-3">
        {model.reports.topProducts.map((product, index) => (
          <div
            key={product.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4"
          >
            <div>
              <p className="font-semibold text-[var(--text-primary)]">#{index + 1} {product.name}</p>
              <p className="mt-1 text-sm text-[var(--text-tertiary)]">
                SKU: {product.sku || "—"} · Qty sold: {product.quantitySold}
              </p>
            </div>
            <p className="font-semibold text-[var(--primary)]">{money(product.revenue, currency)}</p>
          </div>
        ))}

        {!model.reports.topProducts.length && (
          <EmptyState text="No product sales data is available yet." />
        )}
      </div>
    </section>
  );
}

function LatestDocuments({ model }: { model: InvestorPortalReadModel }) {
  const latestOffer = model.offers[0] || null;
  const latestCertificate = model.certificates[0] || null;

  return (
    <section className="rounded-[1.5rem] border border-[var(--primary-border)] bg-[var(--surface-soft)] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
        Investor documents
      </p>
      <p className="mt-1 text-sm text-[var(--text-tertiary)]">Your offer, agreement and certificate documents</p>

      <div className="mt-5 space-y-3">
        {latestOffer && (
          <DocumentActionRow
            title="Latest offer and agreement"
            subtitle={`${money(latestOffer.amount, model.summary.currency)} for ${percent(latestOffer.equityPercent)}`}
          >
            <InvestorOfferPdfButton
              companyId={model.summary.companyId}
              companyName={model.summary.companyName}
              currency={model.summary.currency}
              offer={latestOffer}
              type="offer_pdf"
            />
            {latestOffer.canDownloadAgreementPdf && (
              <InvestorOfferPdfButton
                companyId={model.summary.companyId}
                companyName={model.summary.companyName}
                currency={model.summary.currency}
                offer={latestOffer}
                type="agreement_pdf"
              />
            )}
          </DocumentActionRow>
        )}

        {latestCertificate && (
          <DocumentActionRow
            title="Latest certificate"
            subtitle={`${latestCertificate.certificateNumber} · ${percent(latestCertificate.equityPercent)}`}
          >
            <InvestorCertificatePdfButton
              certificate={latestCertificate}
              companyId={model.summary.companyId}
              companyName={model.summary.companyName}
              currency={model.summary.currency}
            />
          </DocumentActionRow>
        )}

        {!latestOffer && !latestCertificate && (
          <EmptyState text="No investor offer or certificate documents are available yet." />
        )}
      </div>
    </section>
  );
}

function DocumentActionRow({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
      <p className="font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--text-tertiary)]">{subtitle}</p>
      <div className="mt-4 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function InvestorInvestmentsView({ model }: { model: InvestorPortalReadModel }) {
  const currency = model.summary.currency;
  const pending = model.offers.filter((offer) =>
    ["draft", "pending", "sent", "accepted", "payment_received"].includes(offer.status),
  );
  const completed = model.offers
    .filter((offer) => offer.status === "completed")
    .sort((a, b) => dateSortValue(b.completedAt || b.createdAt) - dateSortValue(a.completedAt || a.createdAt));
  const latestCompleted = completed[0] || null;

  return (
    <section className="space-y-4">
      <InvestmentRecordHero model={model} />

      <InvestmentMetricGrid
        completed={completed}
        latestCompleted={latestCompleted}
        model={model}
        pending={pending}
      />

      <InvestmentPositionPanel model={model} />

      <div
        className="grid items-start gap-4"
        style={{ gridTemplateColumns: "360px minmax(0, 1fr)" }}
      >
        <CapitalRequestPanel currency={currency} />
        <CapitalLedgerPanel
          capitalRequests={model.capitalRequests}
          completed={completed}
          currency={currency}
          pending={pending}
        />
      </div>

      <div
        className="grid items-start gap-4"
        style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}
      >
        <InvestmentHistoryPanel completed={completed} currency={currency} />
        <InvestmentDocumentsUpdatesPanel completed={completed} model={model} />
      </div>
    </section>
  );
}

function InvestmentRecordHero({ model }: { model: InvestorPortalReadModel }) {
  const { summary } = model;

  return (
    <section className="rounded-2xl border border-[var(--primary-border)] bg-[image:var(--gradient-hero)] p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr] xl:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">
              {summary.companyName}
            </span>
            <span className="rounded-full border border-[var(--success-border)] bg-[var(--success-soft)] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--success)]">
              {percent(summary.equityPercent)} equity owned
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
              {summary.currency} reporting
            </span>
          </div>

          <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.055em] text-[#0b1f3a] sm:text-[34px]">
  Your investment record
</h2>

<p className="mt-2 max-w-3xl text-[12px] leading-5 text-[#61778d]">
  This page shows your completed investment activity, capital requests,
  ownership records and available investment documents.
</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <HeroMiniStat
            icon={WalletCards}
            label="Invested"
            value={money(summary.totalInvestment, summary.currency)}
          />
          <HeroMiniStat
            icon={BookOpen}
            label="Book value"
            value={money(summary.estimatedHoldingValue, summary.currency)}
          />
          <HeroMiniStat icon={Activity} label="Return status" value={returnLabel(summary)} />
        </div>
      </div>
    </section>
  );
}

function InvestmentMetricGrid({
  completed,
  latestCompleted,
  model,
  pending,
}: {
  completed: InvestorPortalOffer[];
  latestCompleted: InvestorPortalOffer | null;
  model: InvestorPortalReadModel;
  pending: InvestorPortalOffer[];
}) {
  const { summary } = model;
  const currency = summary.currency;

  const metrics = [
    {
      icon: PieChart,
      label: "Equity owned",
      value: percent(summary.equityPercent),
      caption: "Completed offers only",
    },
    {
      icon: CircleDollarSign,
      label: "Total invested",
      value: money(summary.totalInvestment, currency),
      caption: "Across all completed investments",
    },
    {
      icon: TrendingUp,
      label: "Capital into company",
      value: money(summary.capitalContributed, currency),
      caption: "Total capital contributed to the company",
    },
    {
      icon: Activity,
      label: "Secondary purchase",
      value: money(summary.founderPurchaseAmount, currency),
      caption: "Secondary purchases completed",
    },
    {
      icon: LineChart,
      label: "Average entry valuation",
      value: valuationLabel(summary),
      caption: "Weighted average entry valuation",
    },
    {
      icon: FileCheck2,
      label: "Certificates issued",
      value: `${summary.certificateCount}`,
      caption: "Share certificates issued to you",
    },
    {
      icon: CheckCircle2,
      label: "Active requests",
      value: `${model.summary.activeCapitalRequestCount}`,
      caption: "Pending capital requests awaiting review",
    },
    {
      icon: FileText,
      label: "Latest completed investment",
      value: latestCompleted ? dateLabel(latestCompleted.completedAt || latestCompleted.createdAt) : "—",
      caption: "Most recent completed investment date",
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <DashboardMetricCard key={metric.label} {...metric} />
      ))}
    </div>
  );
}

function InvestmentPositionPanel({ model }: { model: InvestorPortalReadModel }) {
  const { summary } = model;
  const completedEquity = Math.max(
    Math.min(Number(summary.equityPercent || 0), 100),
    summary.equityPercent > 0 ? 4 : 0,
  );

  return (
    <section className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-4 shadow-[var(--shadow-card)]">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.55fr)] xl:items-center">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Your position
          </p>
          <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
            Your completed equity position in {summary.companyName}.
          </p>

          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="h-2.5 rounded-full bg-[var(--surface-soft)]">
              <div
                className="h-full rounded-full bg-[var(--primary)] shadow-[var(--glow-brand)]"
                style={{ width: `${completedEquity}%` }}
              />
            </div>
            <span className="text-[22px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
              {percent(summary.equityPercent)}
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <MiniPosition label="Capital into company" value={money(summary.capitalContributed, summary.currency)} />
          <MiniPosition label="Secondary purchase" value={money(summary.founderPurchaseAmount, summary.currency)} />
          <MiniPosition label="Book value" value={money(summary.estimatedHoldingValue, summary.currency)} />
        </div>
      </div>
    </section>
  );
}

function CapitalRequestPanel({ currency }: { currency: string }) {
  return (
    <section className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-4 shadow-[var(--shadow-card)]">
      <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
        Capital request
      </p>
      <p className="mt-2 text-[11px] leading-5 text-[var(--text-tertiary)]">
        Submit a capital in or withdrawal request for company review. The admin team receives an alert immediately.
      </p>

      <InvestorCapitalRequestForm currency={currency} />
    </section>
  );
}


function CapitalLedgerPanel({
  capitalRequests,
  completed,
  currency,
  pending,
}: {
  capitalRequests: InvestorCapitalRequest[];
  completed: InvestorPortalOffer[];
  currency: string;
  pending: InvestorPortalOffer[];
}) {
  const requestRows = capitalRequests.slice(0, 5).map((request) => ({
    id: `request-${request.id}`,
    type: request.requestType === "withdrawal_request" ? "Withdrawal Request" : "Capital In Request",
    amount: money(request.amount, request.currency || currency),
    status: statusLabel(request.status),
    date: dateLabel(request.createdAt),
    description: request.notes || request.adminNote || "Submitted for admin review",
  }));

  const completedRows = completed.slice(0, 3).map((offer, index) => ({
    id: `offer-${offer.id}`,
    type: offer.moneyRecipient === "company" ? "Capital In" : "Secondary Purchase",
    amount: money(offer.amount, currency),
    status: "Completed",
    date: dateLabel(offer.completedAt || offer.createdAt),
    description: index === 0 ? "Initial investment" : "Follow-on investment",
  }));

  const pendingOfferRows = pending.slice(0, 2).map((offer) => ({
    id: `offer-pending-${offer.id}`,
    type: offer.moneyRecipient === "company" ? "Capital Offer" : "Secondary Offer",
    amount: money(offer.amount, currency),
    status: statusLabel(offer.status),
    date: dateLabel(offer.createdAt),
    description: offer.note || "Awaiting company completion",
  }));

  const displayRows = [...requestRows, ...completedRows, ...pendingOfferRows];
  const rows = displayRows.length
    ? displayRows
    : [
        {
          id: "empty",
          type: "Withdrawal Request",
          amount: money(0, currency),
          status: "None",
          date: "—",
          description: "No pending request",
        },
      ];

  return (
    <section className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Capital ledger
          </p>
          <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
            History of your submitted requests, completed investments and pending offer actions.
          </p>
        </div>
        <span className="rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-2 text-[9px] font-medium text-[var(--primary)]">
          {capitalRequests.filter((request) => ["pending", "approved"].includes(request.status)).length} active
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)]">
        <div className="grid grid-cols-[1fr_0.8fr_0.78fr_0.85fr_1.35fr] bg-[var(--primary-soft)] px-3 py-3 text-[8px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          <span>Type</span>
          <span>Amount</span>
          <span>Status</span>
          <span>Date</span>
          <span>Description</span>
        </div>

        {rows.slice(0, 6).map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[1fr_0.8fr_0.78fr_0.85fr_1.35fr] items-center border-t border-[var(--border)] px-3 py-3 text-[11px] text-[var(--text-secondary)]"
          >
            <span className="truncate font-medium text-[var(--text-primary)]">{row.type}</span>
            <span className="truncate">{row.amount}</span>
            <StatusBadge status={row.status} />
            <span className="truncate text-[var(--text-tertiary)]">{row.date}</span>
            <span className="truncate text-[var(--text-secondary)]">{row.description}</span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-center text-[9px] text-[var(--text-tertiary)]">
        Showing {Math.min(rows.length, 6)} of {rows.length} records
      </p>
    </section>
  );
}


function InvestmentHistoryPanel({
  completed,
  currency,
}: {
  completed: InvestorPortalOffer[];
  currency: string;
}) {
  const rows = completed.slice(0, 4);

  return (
    <section className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-4 shadow-[var(--shadow-card)]">
      <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
        Investment history
      </p>
      <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
        Your completed investments and equity allocations.
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)]">
        <div className="grid grid-cols-[0.9fr_0.85fr_0.75fr_1fr_0.78fr] bg-[var(--primary-soft)] px-3 py-3 text-[8px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          <span>Date</span>
          <span>Amount</span>
          <span>Equity %</span>
          <span>Deal type</span>
          <span>Status</span>
        </div>

        {rows.map((offer) => (
          <div
            key={offer.id}
            className="grid grid-cols-[0.9fr_0.85fr_0.75fr_1fr_0.78fr] items-center border-t border-[var(--border)] px-3 py-3 text-[11px] text-[var(--text-secondary)]"
          >
            <span className="truncate font-medium text-[var(--text-primary)]">{dateLabel(offer.completedAt || offer.createdAt)}</span>
            <span className="truncate">{money(offer.amount, currency)}</span>
            <span className="truncate text-[var(--primary)]">{percent(offer.equityPercent)}</span>
            <span className="truncate">{offer.moneyRecipient === "company" ? "Company raise" : "Secondary purchase"}</span>
            <StatusBadge status={offer.status} />
          </div>
        ))}

        {!rows.length && (
          <div className="border-t border-[var(--border)] p-5">
            <EmptyState text="No completed investments yet." />
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-[9px] text-[var(--text-tertiary)]">
        Showing {rows.length} of {completed.length} records
      </p>
    </section>
  );
}

function InvestmentDocumentsUpdatesPanel({
  completed,
  model,
}: {
  completed: InvestorPortalOffer[];
  model: InvestorPortalReadModel;
}) {
  const latestOffer = completed[0] || model.offers[0] || null;
  const certificate = model.certificates[0] || null;
  const latestUpdates = model.notifications.slice(0, 3);

  return (
    <section className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-4 shadow-[var(--shadow-card)]">
      <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0, 1fr) 260px" }}>
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Documents & updates
          </p>
          <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
            Important documents and the latest updates.
          </p>

          <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)]">
            <InvestmentDocumentRow
              icon={FileCheck2}
              title="Investment agreement"
              subtitle="Agreement PDF"
            >
              {latestOffer ? (
                <InvestorOfferPdfButton
                  companyId={model.summary.companyId}
                  companyName={model.summary.companyName}
                  currency={model.summary.currency}
                  offer={latestOffer}
                  type="agreement_pdf"
                />
              ) : (
                <span className="text-[10px] text-[var(--text-tertiary)]">Pending</span>
              )}
            </InvestmentDocumentRow>

            <InvestmentDocumentRow
              icon={ShieldCheck}
              title="Share certificate"
              subtitle="Certificate PDF"
            >
              {certificate ? (
                <InvestorCertificatePdfButton
                  certificate={certificate}
                  companyId={model.summary.companyId}
                  companyName={model.summary.companyName}
                  currency={model.summary.currency}
                />
              ) : (
                <span className="text-[10px] text-[var(--text-tertiary)]">Pending</span>
              )}
            </InvestmentDocumentRow>

            <InvestmentDocumentRow
              icon={FileText}
              title="Latest investor report"
              subtitle="Download PDF"
            >
              <InvestorReportPdfButton
                companyId={model.summary.companyId}
                companyName={model.summary.companyName}
                currency={model.summary.currency}
                report={model.reports}
                type="investor_report_pdf"
              />
            </InvestmentDocumentRow>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              Recent updates
            </p>
            <span className="text-[9px] font-medium text-[var(--primary)]">View all</span>
          </div>

          <div className="mt-4 space-y-4 border-l border-[var(--primary-border)] pl-4">
            {latestUpdates.map((notice) => (
              <div key={notice.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border border-[var(--primary-border)] bg-[var(--primary)] shadow-[var(--glow-success)]" />
                <p className="truncate text-[11px] font-medium text-[var(--text-primary)]">{notice.title}</p>
                <p className="mt-1 text-[9px] text-[var(--text-tertiary)]">{dateLabel(notice.createdAt)}</p>
              </div>
            ))}

            {!latestUpdates.length && (
              <p className="rounded-xl border border-dashed border-[var(--border)] p-4 text-center text-[10px] text-[var(--text-tertiary)]">
                No recent investment updates.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function InvestmentDocumentRow({
  children,
  icon: Icon,
  subtitle,
  title,
}: {
  children: ReactNode;
  icon: DashboardIcon;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 border-t border-[var(--border)] px-3 py-2.5 first:border-t-0">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--primary)]">
        <Icon className="h-[15px] w-[15px]" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-[var(--text-primary)]">{title}</p>
        <p className="mt-0.5 truncate text-[9px] text-[var(--text-tertiary)]">{subtitle}</p>
      </div>
      <div className="shrink-0 [&_a]:h-8 [&_a]:rounded-lg [&_a]:px-2.5 [&_a]:py-1 [&_a]:text-[9px] [&_button]:h-8 [&_button]:rounded-lg [&_button]:px-2.5 [&_button]:py-1 [&_button]:text-[9px]">
        {children}
      </div>
    </div>
  );
}

function dateSortValue(value?: string | null): number {
  if (!value) return 0;

  const parsed = new Date(value).getTime();

  return Number.isNaN(parsed) ? 0 : parsed;
}

export function InvestorReportsView({ model }: { model: InvestorPortalReadModel }) {
  const { reports, summary } = model;
  const currency = summary.currency;

  return (
    <section className="space-y-4">
      <ReportsHero model={model} />

      <ReportsMetricGrid model={model} />

      <FinancialPerformanceReportsPanel model={model} />

      <div
        className="grid items-start gap-4"
        style={{ gridTemplateColumns: "minmax(0, 1.45fr) minmax(380px, 0.75fr)" }}
      >
        <PublishedReportsPanel model={model} />
        <ExecutiveInvestorSummaryPanel model={model} />
      </div>

      <div
        className="grid items-start gap-4"
        style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(420px, 0.62fr)" }}
      >
        <KeyRatiosPanel model={model} />
        <ReportActivityTimeline model={model} />
      </div>
    </section>
  );
}

function ReportsHero({ model }: { model: InvestorPortalReadModel }) {
  const { reports, summary } = model;

  return (
    <section className="rounded-2xl border border-[var(--primary-border)] bg-[image:var(--gradient-hero)] p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr] xl:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">
              {summary.companyName}
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
              {summary.currency} reporting
            </span>
            <span className="rounded-full border border-[var(--success-border)] bg-[var(--success-soft)] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--success)]">
              Investor view
            </span>
          </div>

          <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.055em] text-[#0b1f3a] sm:text-[34px]">
  Investor reports
</h2>

<p className="mt-2 max-w-3xl text-[12px] leading-5 text-[#61778d]">
  Read-only reporting built from company performance, cash movement, sales
  and approved investor documents.
</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <HeroMiniStat icon={FileText} label="Latest report" value="Live report" />
          <HeroMiniStat icon={LineChart} label="Revenue" value={money(reports.revenue, summary.currency)} />
          <HeroMiniStat icon={ShieldCheck} label="Business health" value={`${reports.businessHealthScore}/100`} />
        </div>
      </div>
    </section>
  );
}

function ReportsMetricGrid({ model }: { model: InvestorPortalReadModel }) {
  const { reports, summary } = model;
  const currency = summary.currency;

  const metrics = [
    {
      icon: LineChart,
      label: "Revenue",
      value: money(reports.revenue, currency),
      caption: "From sales records",
    },
    {
      icon: TrendingUp,
      label: "Gross profit",
      value: money(reports.grossProfit, currency),
      caption: "Revenue minus COGS",
    },
    {
      icon: Activity,
      label: "Net profit",
      value: money(reports.netProfit, currency),
      caption: "After operating expenses",
    },
    {
      icon: PieChart,
      label: "Gross margin",
      value: percent(reports.grossMarginPercent),
      caption: "Gross profitability",
    },
    {
      icon: CheckCircle2,
      label: "Net margin",
      value: percent(reports.netMarginPercent),
      caption: "Net profitability",
    },
    {
      icon: Landmark,
      label: "Company cash",
      value: money(summary.companyCash, currency),
      caption: "From accounts",
    },
    {
      icon: BookOpen,
      label: "Inventory value",
      value: money(reports.inventoryValue, currency),
      caption: "Stock value estimate",
    },
    {
      icon: WalletCards,
      label: "Cash runway",
      value: reports.cashRunwayLabel,
      caption: "Based on available cash",
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <DashboardMetricCard key={metric.label} {...metric} />
      ))}
    </div>
  );
}

function FinancialPerformanceReportsPanel({ model }: { model: InvestorPortalReadModel }) {
  return (
    <section className="rounded-2xl border border-[var(--primary-border)] bg-[image:var(--gradient-hero)] p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-[20px] font-semibold tracking-[-0.045em] text-[#0b1f3a]">
  Financial performance
</h3>

<p className="mt-2 text-[11px] leading-5 text-[#61778d]">
  Investor-visible trends from live sales, profit and expense records.
</p>
        </div>
        <span className="w-fit rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-[10px] text-[var(--text-tertiary)]">
          6M
        </span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <ReportRevenueTrendChart points={model.trends.revenue.length ? model.trends.revenue : model.trends.companySales} currency={model.summary.currency} />
        <ReportProfitExpenseChart
          currency={model.summary.currency}
          expenses={model.trends.expenses}
          profit={model.trends.profit}
        />
      </div>
    </section>
  );
}

function ReportRevenueTrendChart({
  currency,
  points,
}: {
  currency: string;
  points: InvestorPortalTrendPoint[];
}) {
  const visible = normaliseReportPoints(points);
  const path = reportLinePath(visible);
  const max = reportMax(visible);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
            Revenue trend ({currency})
          </p>
          <p className="mt-1 text-[10px] text-[var(--text-muted)]">Revenue across the last six periods</p>
        </div>
        <span className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[9px] text-[var(--text-tertiary)]">6M</span>
      </div>

      <div className="grid grid-cols-[42px_1fr] gap-3">
        <div className="flex h-[178px] flex-col justify-between pb-6 pt-2 text-right text-[8px] text-[var(--text-muted)]">
          <span>{compactMoney(max)}</span>
          <span>{compactMoney(max * 0.66)}</span>
          <span>{compactMoney(max * 0.33)}</span>
          <span>£0</span>
        </div>

        <div>
          <svg className="h-[178px] w-full overflow-visible" viewBox="0 0 720 178" preserveAspectRatio="none" aria-hidden="true">
            {[24, 62, 100, 138].map((y) => (
              <line key={y} x1="0" y1={y} x2="720" y2={y} stroke="var(--chart-grid)" />
            ))}
            <path
              d={reportLinePathD(path)}
              fill="none"
              stroke="var(--chart-1)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="4"
              vectorEffect="non-scaling-stroke"
            />
            {path.split(" ").map((point) => {
              const [x, y] = point.split(",");
              return (
                <circle
                  key={point}
                  cx={x}
                  cy={y}
                  r="4"
                  fill="var(--primary-soft)"
                  stroke="var(--chart-1)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>

          <div className="mt-2 flex justify-between text-[9px] text-[var(--text-tertiary)]">
            {visible.map((point) => (
              <span key={point.key}>{point.label}</span>
            ))}
          </div>

          <p className="mt-3 text-center text-[10px] text-[var(--primary)]">Revenue</p>
        </div>
      </div>
    </div>
  );
}

function ReportProfitExpenseChart({
  currency,
  expenses,
  profit,
}: {
  currency: string;
  expenses: InvestorPortalTrendPoint[];
  profit: InvestorPortalTrendPoint[];
}) {
  const profitPoints = normaliseReportPoints(profit);
  const expensePoints = normaliseReportPoints(expenses);
  const max = reportMax([...profitPoints, ...expensePoints]);
  const profitPath = reportLinePath(profitPoints, max);
  const expensePath = reportLinePath(expensePoints, max);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
            Profit & expenses ({currency})
          </p>
          <p className="mt-1 text-[10px] text-[var(--text-muted)]">Profitability compared with operating spend</p>
        </div>
        <span className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[9px] text-[var(--text-tertiary)]">6M</span>
      </div>

      <div className="grid grid-cols-[42px_1fr] gap-3">
        <div className="flex h-[178px] flex-col justify-between pb-6 pt-2 text-right text-[8px] text-[var(--text-muted)]">
          <span>{compactMoney(max)}</span>
          <span>{compactMoney(max * 0.66)}</span>
          <span>{compactMoney(max * 0.33)}</span>
          <span>£0</span>
        </div>

        <div>
          <svg className="h-[178px] w-full overflow-visible" viewBox="0 0 720 178" preserveAspectRatio="none" aria-hidden="true">
            {[24, 62, 100, 138].map((y) => (
              <line key={y} x1="0" y1={y} x2="720" y2={y} stroke="var(--chart-grid)" />
            ))}
            <path
              d={reportLinePathD(expensePath)}
              fill="none"
              stroke="var(--chart-6)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={reportLinePathD(profitPath)}
              fill="none"
              stroke="var(--chart-1)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="4"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div className="mt-2 flex justify-between text-[9px] text-[var(--text-tertiary)]">
            {profitPoints.map((point) => (
              <span key={point.key}>{point.label}</span>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-center gap-5 text-[10px]">
            <span className="flex items-center gap-2 text-[var(--primary)]">
              <span className="h-1.5 w-4 rounded-full bg-[var(--primary)]" />
              Profit
            </span>
            <span className="flex items-center gap-2 text-[var(--danger)]">
              <span className="h-1.5 w-4 rounded-full bg-[var(--danger)]" />
              Expenses
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PublishedReportsPanel({ model }: { model: InvestorPortalReadModel }) {
  const { reports, summary } = model;
  const currency = summary.currency;
  const rows = [
    {
      icon: FileText,
      title: "Investor performance report",
      subtitle: "Live PDF",
      date: "Generated today",
      type: "investor_report_pdf",
    },
    {
      icon: WalletCards,
      title: "Cash flow & liquidity report",
      subtitle: "PDF",
      date: "Latest",
      type: "cash_flow_pdf",
    },
    {
      icon: PieChart,
      title: "Ownership summary",
      subtitle: "PDF",
      date: "Live position",
      type: "investor_report_pdf",
    },
    {
      icon: Download,
      title: "Documents access log",
      subtitle: "PDF",
      date: "Latest",
      type: "investor_report_pdf",
    },
  ];

  return (
    <section className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Report centre
          </p>
          <h3 className="mt-2 text-[18px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
            Published reports
          </h3>
          <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
            Download investor-ready exports generated from live company records.
          </p>
        </div>
        <span className="hidden rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-2 text-[9px] font-medium text-[var(--primary)] sm:block">
          {currency}
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)]">
        {rows.map((row) => (
          <ReportDownloadRow
            key={row.title}
            date={row.date}
            icon={row.icon}
            subtitle={row.subtitle}
            title={row.title}
          >
            <InvestorReportPdfButton
              companyId={summary.companyId}
              companyName={summary.companyName}
              currency={currency}
              report={reports}
              type={row.type as any}
            />
          </ReportDownloadRow>
        ))}
      </div>
    </section>
  );
}

function ReportDownloadRow({
  children,
  date,
  icon: Icon,
  subtitle,
  title,
}: {
  children: ReactNode;
  date: string;
  icon: DashboardIcon;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="grid grid-cols-[38px_minmax(0,1fr)_118px_auto] items-center gap-3 border-t border-[var(--border)] px-3 py-3 first:border-t-0">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]">
        <Icon className="h-[16px] w-[16px]" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-[var(--text-primary)]">{title}</p>
        <p className="mt-0.5 truncate text-[9px] text-[var(--text-tertiary)]">{subtitle}</p>
      </div>
      <span className="truncate text-[9px] text-[var(--text-tertiary)]">{date}</span>
      <div className="shrink-0 [&_button]:h-8 [&_button]:rounded-lg [&_button]:px-2.5 [&_button]:py-1 [&_button]:text-[9px]">
        {children}
      </div>
    </div>
  );
}

function ExecutiveInvestorSummaryPanel({ model }: { model: InvestorPortalReadModel }) {
  const { reports, summary } = model;
  const items = [
    "Revenue is generated from live sales records.",
    "Company cash is reported separately from valuation.",
    "Investor book value is carried at completed investment cost.",
    "No realised return, dividend, buyback or exit has been recorded.",
  ];

  return (
    <section className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-4 shadow-[var(--shadow-card)]">
      <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
        Executive summary
      </p>
      <h3 className="mt-2 text-[18px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
        Investor-ready insights
      </h3>
      <p className="mt-2 text-[11px] leading-5 text-[var(--text-tertiary)]">
        {summary.companyName} currently has {money(summary.companyCash, summary.currency)} in
        account cash and {money(reports.revenue, summary.currency)} in recorded revenue.
      </p>

      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div key={item} className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]">
              <CheckCircle2 className="h-[13px] w-[13px]" />
            </span>
            <p className="text-[11px] leading-5 text-[var(--text-secondary)]">{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function KeyRatiosPanel({ model }: { model: InvestorPortalReadModel }) {
  const { reports, summary } = model;
  const currency = summary.currency;

  const ratios = [
    { label: "Gross margin", value: percent(reports.grossMarginPercent), caption: "Gross profitability" },
    { label: "Net margin", value: percent(reports.netMarginPercent), caption: "Net profitability" },
    { label: "Cash inflows", value: money(reports.cashInflows, currency), caption: "Incoming cash" },
    { label: "Cash outflows", value: money(reports.cashOutflows, currency), caption: "Outgoing cash" },
    { label: "Monthly burn", value: money(reports.monthlyBurnRate, currency), caption: "Average net spend" },
  ];

  return (
    <section className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-4 shadow-[var(--shadow-card)]">
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
          Key ratios
        </p>
        <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
          Compact financial indicators used for investor reporting.
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {ratios.map((ratio) => (
          <div key={ratio.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
            <p className="text-[8px] font-semibold uppercase tracking-[0.17em] text-[var(--text-tertiary)]">
              {ratio.label}
            </p>
            <p className="mt-3 text-[17px] font-semibold tracking-[-0.035em] text-[var(--text-primary)]">
              {ratio.value}
            </p>
            <p className="mt-1 text-[9px] text-[var(--primary)]">{ratio.caption}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReportActivityTimeline({ model }: { model: InvestorPortalReadModel }) {
  const items = [
    ...model.activity.slice(0, 4),
    ...model.notifications.slice(0, 4).map((notice) => ({
      id: `notice-${notice.id}`,
      type: notice.type || "notification",
      title: notice.title,
      description: notice.message,
      createdAt: notice.createdAt,
    })),
  ].slice(0, 5);

  return (
    <section className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Recent report activity
          </p>
          <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">Latest report and document events.</p>
        </div>
        <span className="text-[10px] font-medium text-[var(--primary)]">View all</span>
      </div>

      <div className="mt-5 space-y-3.5">
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-start gap-3">
            <ActivityDot type={item.type} />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-[var(--text-primary)]">{item.title}</p>
              <p className="mt-1 line-clamp-1 text-[9px] leading-4 text-[var(--text-tertiary)]">{item.description}</p>
            </div>
            <span className="shrink-0 pt-0.5 text-right text-[9px] text-[var(--text-tertiary)]">
              {dateLabel(item.createdAt)}
            </span>
          </div>
        ))}

        {!items.length && (
          <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-[10px] text-[var(--text-tertiary)]">
            No report activity yet.
          </p>
        )}
      </div>
    </section>
  );
}

function normaliseReportPoints(points: InvestorPortalTrendPoint[]): InvestorPortalTrendPoint[] {
  const fallback = [
    { key: "mar", label: "Mar", value: 0 },
    { key: "apr", label: "Apr", value: 0 },
    { key: "may", label: "May", value: 0 },
    { key: "jun", label: "Jun", value: 0 },
    { key: "jul", label: "Jul", value: 0 },
    { key: "aug", label: "Aug", value: 0 },
  ];

  return (points.length ? points : fallback).slice(-6);
}

function reportMax(points: InvestorPortalTrendPoint[]): number {
  return points.reduce((largest, point) => Math.max(largest, Math.abs(Number(point.value || 0))), 1);
}

function reportLinePath(points: InvestorPortalTrendPoint[], forcedMax?: number): string {
  const safePoints = normaliseReportPoints(points);
  const max = forcedMax || reportMax(safePoints);
  const step = safePoints.length > 1 ? 720 / (safePoints.length - 1) : 720;

  return safePoints
    .map((point, index) => {
      const value = Math.max(0, Number(point.value || 0));
      const x = Math.round(index * step);
      const y = Math.round(148 - (value / max) * 108);

      return `${x},${Math.max(20, Math.min(158, y))}`;
    })
    .join(" ");
}

function reportLinePathD(points: string): string {
  const parts = points.split(" ").filter(Boolean);

  if (!parts.length) return "";

  return parts
    .map((point, index) => {
      const [x, y] = point.split(",");

      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export function InvestorDocumentsView({ model }: { model: InvestorPortalReadModel }) {
  const financialDocs = model.documents.filter((doc) => isFinancialDocument(doc));
  const legalDocs = model.documents.filter((doc) => isLegalDocument(doc));
  const governanceDocs = model.documents.filter((doc) => isGovernanceDocument(doc));
  const otherDocs = model.documents.filter(
    (doc) =>
      !isFinancialDocument(doc) &&
      !isLegalDocument(doc) &&
      !isGovernanceDocument(doc),
  );

  return (
    <section className="space-y-4">
      <DocumentsHero model={model} />

      <DocumentsMetricGrid
        financialDocs={financialDocs}
        governanceDocs={governanceDocs}
        legalDocs={legalDocs}
        model={model}
        otherDocs={otherDocs}
      />

      <CoreInvestmentPackPanel model={model} />

      <div
        className="grid items-start gap-4"
        style={{ gridTemplateColumns: "minmax(0, 1.1fr) minmax(420px, 0.72fr)" }}
      >
        <GeneratedReportsPanel model={model} />
        <DocumentSecurityPanel model={model} />
      </div>

      <UploadedDataRoomPanel
        financialDocs={financialDocs}
        governanceDocs={governanceDocs}
        legalDocs={legalDocs}
        otherDocs={otherDocs}
      />

      <DocumentActivityPanel model={model} />
    </section>
  );
}

function DocumentsHero({ model }: { model: InvestorPortalReadModel }) {
  const { summary } = model;

  return (
    <section className="rounded-2xl border border-[var(--primary-border)] bg-[image:var(--gradient-hero)] p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.84fr)_minmax(520px,1fr)] xl:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">
              {summary.companyName}
            </span>
            <span className="rounded-full border border-[var(--success-border)] bg-[var(--success-soft)] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--success)]">
              Secure document vault
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
              {summary.currency} reporting
            </span>
          </div>

          <h2 className="mt-4 text-[30px] font-semibold tracking-[-0.055em] text-[#0b1f3a] sm:text-[38px]">
  Investor documents
</h2>

<p className="mt-2 max-w-3xl text-[12px] leading-5 text-[#61778d]">
  Access your offer records, investment agreements, certificates, reports and
  company-approved data room documents in one investor-safe vault.
</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <HeroMiniStat
            icon={FileCheck2}
            label="Investment docs"
            value={`${model.offers.length + model.certificates.length}`}
          />
          <HeroMiniStat
            icon={FileText}
            label="Uploaded files"
            value={`${model.documents.length}`}
          />
          <HeroMiniStat
            icon={ShieldCheck}
            label="Vault status"
            value="Secure"
          />
        </div>
      </div>
    </section>
  );
}

function DocumentsMetricGrid({
  financialDocs,
  governanceDocs,
  legalDocs,
  model,
  otherDocs,
}: {
  financialDocs: InvestorPortalDocument[];
  governanceDocs: InvestorPortalDocument[];
  legalDocs: InvestorPortalDocument[];
  model: InvestorPortalReadModel;
  otherDocs: InvestorPortalDocument[];
}) {
  const generatedReportsCount = 4;
  const offerAgreementCount = model.offers.length * 2;
  const totalDocumentCount =
    offerAgreementCount +
    model.certificates.length +
    generatedReportsCount +
    model.documents.length;

  const metrics = [
    {
      icon: FileCheck2,
      label: "Offer & agreement docs",
      value: `${offerAgreementCount}`,
      caption: "Offer PDF and agreement PDF records",
    },
    {
      icon: ShieldCheck,
      label: "Certificates",
      value: `${model.certificates.length}`,
      caption: "Issued ownership certificate PDFs",
    },
    {
      icon: LineChart,
      label: "Report exports",
      value: `${generatedReportsCount}`,
      caption: "Investor, P&L, cash flow and inventory reports",
    },
    {
      icon: Download,
      label: "Total vault items",
      value: `${totalDocumentCount}`,
      caption: "Generated and uploaded investor files",
    },
    {
      icon: Landmark,
      label: "Financial files",
      value: `${financialDocs.length}`,
      caption: "Statements, reports and financial uploads",
    },
    {
      icon: BookOpen,
      label: "Legal files",
      value: `${legalDocs.length}`,
      caption: "Contracts, agreements and legal records",
    },
    {
      icon: BadgeCheck,
      label: "Governance files",
      value: `${governanceDocs.length}`,
      caption: "Approvals, consents and board records",
    },
    {
      icon: FileText,
      label: "Other files",
      value: `${otherDocs.length}`,
      caption: "Additional company-approved documents",
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <DashboardMetricCard key={metric.label} {...metric} />
      ))}
    </div>
  );
}

function CoreInvestmentPackPanel({ model }: { model: InvestorPortalReadModel }) {
  const latestOffer =
    model.offers.find((offer) => offer.status === "completed") ||
    model.offers.find((offer) => offer.canDownloadAgreementPdf) ||
    model.offers[0] ||
    null;
  const latestCertificate = model.certificates[0] || null;

  return (
    <section className="rounded-2xl border border-[var(--primary-border)] bg-[image:var(--gradient-hero)] p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Core investment pack
          </p>
          <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.045em] text-[#0b1f3a]">
  Required investor documents
</h3>

<p className="mt-2 text-[11px] leading-5 text-[#61778d]">
  The documents every investor account should have once an investment is completed.
</p>
        </div>
        <span className="w-fit rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-[10px] text-[var(--text-tertiary)]">
          Offer · Agreement · Certificate
        </span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <CoreDocumentCard
          icon={FileCheck2}
          label="01"
          title="Offer letter"
          subtitle="Commercial terms, amount, equity percentage and recipient basis."
          status={latestOffer ? statusLabel(latestOffer.status) : "Pending"}
          meta={latestOffer ? `${money(latestOffer.amount, model.summary.currency)} · ${percent(latestOffer.equityPercent)}` : "No offer available"}
        >
          {latestOffer ? (
            <InvestorOfferPdfButton
              companyId={model.summary.companyId}
              companyName={model.summary.companyName}
              currency={model.summary.currency}
              offer={latestOffer}
              type="offer_pdf"
            />
          ) : (
            <UnavailableDocumentAction />
          )}
        </CoreDocumentCard>

        <CoreDocumentCard
          icon={BookOpen}
          label="02"
          title="Investment agreement"
          subtitle="Agreement PDF generated after the offer is accepted or completed."
          status={latestOffer?.canDownloadAgreementPdf ? "Available" : "Pending"}
          meta={latestOffer ? dateLabel(latestOffer.completedAt || latestOffer.createdAt) : "Awaiting completed investment"}
        >
          {latestOffer?.canDownloadAgreementPdf ? (
            <InvestorOfferPdfButton
              companyId={model.summary.companyId}
              companyName={model.summary.companyName}
              currency={model.summary.currency}
              offer={latestOffer}
              type="agreement_pdf"
            />
          ) : (
            <UnavailableDocumentAction />
          )}
        </CoreDocumentCard>

        <CoreDocumentCard
          icon={ShieldCheck}
          label="03"
          title="Ownership certificate"
          subtitle="Certificate PDF confirming your issued ownership record."
          status={latestCertificate ? "Issued" : "Pending"}
          meta={latestCertificate ? `${latestCertificate.certificateNumber} · ${dateLabel(latestCertificate.issuedAt)}` : "Issued after completion"}
        >
          {latestCertificate ? (
            <InvestorCertificatePdfButton
              certificate={latestCertificate}
              companyId={model.summary.companyId}
              companyName={model.summary.companyName}
              currency={model.summary.currency}
            />
          ) : (
            <UnavailableDocumentAction />
          )}
        </CoreDocumentCard>
      </div>
    </section>
  );
}

function GeneratedReportsPanel({ model }: { model: InvestorPortalReadModel }) {
  const { reports, summary } = model;
  const rows = [
    {
      icon: FileText,
      title: "Investor performance report",
      subtitle: "Company performance, book value, cash and investor-safe summary.",
      type: "investor_report_pdf",
      tag: "Live PDF",
    },
    {
      icon: LineChart,
      title: "Profit & loss report",
      subtitle: "Revenue, COGS, gross profit, operating expenses and net profit.",
      type: "profit_loss_pdf",
      tag: "P&L PDF",
    },
    {
      icon: WalletCards,
      title: "Cash flow & liquidity report",
      subtitle: "Cash inflows, outflows, burn rate, runway and account liquidity.",
      type: "cash_flow_pdf",
      tag: "Cash PDF",
    },
    {
      icon: Landmark,
      title: "Inventory valuation report",
      subtitle: "Stock value, turnover and inventory-linked financial context.",
      type: "inventory_pdf",
      tag: "Inventory PDF",
    },
  ];

  return (
    <section className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Report library
          </p>
          <h3 className="mt-2 text-[18px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
            Generated investor reports
          </h3>
          <p className="mt-2 text-[11px] leading-5 text-[var(--text-tertiary)]">
            PDFs generated from live company records. Downloads are tracked in investor activity.
          </p>
        </div>
        <span className="hidden rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-2 text-[9px] font-medium text-[var(--primary)] sm:block">
          {summary.currency}
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)]">
        {rows.map((row) => (
          <DocumentDownloadRow
            key={row.title}
            icon={row.icon}
            meta={row.tag}
            subtitle={row.subtitle}
            title={row.title}
          >
            <InvestorReportPdfButton
              companyId={summary.companyId}
              companyName={summary.companyName}
              currency={summary.currency}
              report={reports}
              type={row.type as any}
            />
          </DocumentDownloadRow>
        ))}
      </div>
    </section>
  );
}

function DocumentSecurityPanel({ model }: { model: InvestorPortalReadModel }) {
  const { summary } = model;
  const latestNotice = model.notifications[0] || null;

  const controls = [
    {
      icon: ShieldCheck,
      label: "Access scope",
      value: "Investor-only read access",
      status: "Restricted",
    },
    {
      icon: BadgeCheck,
      label: "Visibility",
      value: "Only company-approved documents are shown",
      status: "Approved",
    },
    {
      icon: Download,
      label: "Download tracking",
      value: "PDF downloads create investor activity",
      status: "Tracked",
    },
    {
      icon: Bell,
      label: "Latest document update",
      value: latestNotice ? latestNotice.title : "No recent document notification",
      status: latestNotice ? dateLabel(latestNotice.createdAt) : "—",
    },
  ];

  return (
    <section className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-4 shadow-[var(--shadow-card)]">
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
          Document security
        </p>
        <h3 className="mt-2 text-[18px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
          Access controls
        </h3>
        <p className="mt-2 text-[11px] leading-5 text-[var(--text-tertiary)]">
          {summary.investorName} can view and download only documents approved for this investor account.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {controls.map((control) => (
          <SecurityRow
            key={control.label}
            icon={control.icon}
            label={control.label}
            status={control.status}
            value={control.value}
          />
        ))}
      </div>
    </section>
  );
}

function UploadedDataRoomPanel({
  financialDocs,
  governanceDocs,
  legalDocs,
  otherDocs,
}: {
  financialDocs: InvestorPortalDocument[];
  governanceDocs: InvestorPortalDocument[];
  legalDocs: InvestorPortalDocument[];
  otherDocs: InvestorPortalDocument[];
}) {
  return (
    <section className="rounded-2xl border border-[var(--primary-border)] bg-[image:var(--gradient-hero)] p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Investor data room
          </p>
          <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.045em] text-[#0b1f3a]">
  Uploaded company documents
</h3>

<p className="mt-2 text-[11px] leading-5 text-[#61778d]">
  Company-uploaded files grouped by document type. These are controlled by admin visibility rules.
</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <UploadedDocumentCategory
          docs={financialDocs}
          icon={Landmark}
          title="Financial statements"
          emptyText="No investor-visible financial statements are available yet."
        />
        <UploadedDocumentCategory
          docs={legalDocs}
          icon={BookOpen}
          title="Legal documents"
          emptyText="No investor-visible legal documents are available yet."
        />
        <UploadedDocumentCategory
          docs={governanceDocs}
          icon={BadgeCheck}
          title="Governance documents"
          emptyText="No investor-visible governance documents are available yet."
        />
        <UploadedDocumentCategory
          docs={otherDocs}
          icon={FileText}
          title="Other documents"
          emptyText="No additional investor-visible documents are available yet."
        />
      </div>
    </section>
  );
}

function DocumentActivityPanel({ model }: { model: InvestorPortalReadModel }) {
  const items = [
    ...model.activity.slice(0, 5),
    ...model.notifications.slice(0, 5).map((notice) => ({
      id: `notice-${notice.id}`,
      type: notice.type || "notification",
      title: notice.title,
      description: notice.message,
      createdAt: notice.createdAt,
    })),
  ].slice(0, 6);

  return (
    <section className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Document activity
          </p>
          <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
            Recent downloads, document notifications and investor file activity.
          </p>
        </div>
        <span className="text-[10px] font-medium text-[var(--primary)]">Latest</span>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3"
          >
            <ActivityDot type={item.type} />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-[var(--text-primary)]">{item.title}</p>
              <p className="mt-1 line-clamp-1 text-[9px] leading-4 text-[var(--text-tertiary)]">{item.description}</p>
              <p className="mt-2 text-[9px] text-[var(--text-muted)]">{dateLabel(item.createdAt)}</p>
            </div>
          </div>
        ))}

        {!items.length && (
          <div className="xl:col-span-3">
            <EmptyState text="No document activity has been recorded yet." />
          </div>
        )}
      </div>
    </section>
  );
}

function CoreDocumentCard({
  children,
  icon: Icon,
  label,
  meta,
  status,
  subtitle,
  title,
}: {
  children: ReactNode;
  icon: DashboardIcon;
  label: string;
  meta: string;
  status: string;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="flex min-h-[220px] min-w-0 flex-col justify-between rounded-xl border border-[var(--primary-border)] bg-[var(--surface-soft)] p-4">
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-4">
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1 text-[9px] font-semibold text-[var(--text-tertiary)]">
            {label}
          </span>
          <StatusBadge status={status} />
        </div>

        <div className="mt-4 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]">
            <Icon className="h-[20px] w-[20px]" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</p>
            <p className="mt-1 line-clamp-3 text-[10px] leading-5 text-[var(--text-tertiary)]">{subtitle}</p>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-3 truncate text-[10px] text-[var(--primary)]">{meta}</p>
        <div className="[&_button]:h-9 [&_button]:rounded-lg [&_button]:px-3 [&_button]:py-2 [&_button]:text-[10px]">
          {children}
        </div>
      </div>
    </div>
  );
}

function DocumentDownloadRow({
  children,
  icon: Icon,
  meta,
  subtitle,
  title,
}: {
  children: ReactNode;
  icon: DashboardIcon;
  meta: string;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="grid grid-cols-[38px_minmax(0,1fr)_112px_auto] items-center gap-3 border-t border-[var(--border)] px-3 py-3 first:border-t-0">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]">
        <Icon className="h-[16px] w-[16px]" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-[var(--text-primary)]">{title}</p>
        <p className="mt-0.5 truncate text-[9px] text-[var(--text-tertiary)]">{subtitle}</p>
      </div>
      <span className="truncate text-[9px] text-[var(--text-tertiary)]">{meta}</span>
      <div className="shrink-0 [&_button]:h-8 [&_button]:rounded-lg [&_button]:px-2.5 [&_button]:py-1 [&_button]:text-[9px]">
        {children}
      </div>
    </div>
  );
}

function UploadedDocumentCategory({
  docs,
  emptyText,
  icon: Icon,
  title,
}: {
  docs: InvestorPortalDocument[];
  emptyText: string;
  icon: DashboardIcon;
  title: string;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]">
          <Icon className="h-[16px] w-[16px]" />
        </span>
        <div>
          <p className="text-[12px] font-semibold text-[var(--text-primary)]">{title}</p>
          <p className="mt-0.5 text-[9px] text-[var(--text-tertiary)]">{docs.length} file{docs.length === 1 ? "" : "s"}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {docs.slice(0, 5).map((doc) => (
          <UploadedDocumentVaultRow key={doc.id} doc={doc} />
        ))}

        {!docs.length && (
          <p className="rounded-xl border border-dashed border-[var(--border)] p-5 text-center text-[10px] text-[var(--text-tertiary)]">
            {emptyText}
          </p>
        )}
      </div>
    </section>
  );
}

function UploadedDocumentVaultRow({ doc }: { doc: InvestorPortalDocument }) {
  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--primary)]">
        <FileText className="h-[15px] w-[15px]" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-[var(--text-primary)]">{doc.title}</p>
        <p className="mt-0.5 truncate text-[9px] text-[var(--text-tertiary)]">
          {doc.fileName || "Secure document"} {doc.sizeLabel ? `· ${doc.sizeLabel}` : ""}
        </p>
        <p className="mt-1 text-[9px] text-[var(--text-muted)]">Uploaded {dateLabel(doc.uploadedAt)}</p>
      </div>
      <div className="shrink-0 [&_a]:h-8 [&_a]:rounded-lg [&_a]:px-2.5 [&_a]:py-1 [&_a]:text-[9px] [&_button]:h-8 [&_button]:rounded-lg [&_button]:px-2.5 [&_button]:py-1 [&_button]:text-[9px]">
        <SecureUploadedDocumentButton
          documentId={doc.id}
          documentLabel={doc.title}
          downloadUrl={doc.downloadUrl}
        />
      </div>
    </div>
  );
}

function UnavailableDocumentAction() {
  return (
    <span className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-[10px] text-[var(--text-tertiary)]">
      Not available
    </span>
  );
}

function isFinancialDocument(doc: InvestorPortalDocument): boolean {
  const haystack = `${doc.category} ${doc.title} ${doc.fileName || ""}`.toLowerCase();

  return [
    "financial",
    "finance",
    "report",
    "statement",
    "p&l",
    "profit",
    "loss",
    "cash",
    "balance",
    "accounts",
    "valuation",
  ].some((token) => haystack.includes(token));
}

function isLegalDocument(doc: InvestorPortalDocument): boolean {
  const haystack = `${doc.category} ${doc.title} ${doc.fileName || ""}`.toLowerCase();

  return [
    "legal",
    "agreement",
    "contract",
    "subscription",
    "share purchase",
    "safe",
    "convertible",
    "terms",
    "consent",
  ].some((token) => haystack.includes(token));
}

function isGovernanceDocument(doc: InvestorPortalDocument): boolean {
  const haystack = `${doc.category} ${doc.title} ${doc.fileName || ""}`.toLowerCase();

  return [
    "governance",
    "board",
    "resolution",
    "approval",
    "minutes",
    "certificate",
    "register",
  ].some((token) => haystack.includes(token));
}

export function InvestorNotificationsView({ model }: { model: InvestorPortalReadModel }) {
  return (
    <section className="space-y-6">
      <SectionTitle
        eyebrow="Investor"
        title="Notifications"
        subtitle="Investor updates from offers, documents, certificates and company activity."
      />

      <section className="rounded-[1.5rem] border border-[var(--primary-border)] bg-[var(--surface-soft)] p-5">
        <div className="space-y-3">
          {model.notifications.map((notice) => (
            <div key={notice.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--text-primary)]">{notice.title}</p>
                    <StatusBadge status={notice.readAt ? "read" : "pending"} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-tertiary)]">{notice.message}</p>
                  <p className="mt-2 text-xs text-[var(--text-tertiary)]">{dateLabel(notice.createdAt)}</p>
                </div>
                {!notice.readAt && (
                  <form action={markInvestorNotificationRead}>
                    <input type="hidden" name="notification_id" value={notice.id} />
                    <button
                      type="submit"
                      className="rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-2 text-xs font-semibold text-[var(--primary)]"
                    >
                      Mark read
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}

          {!model.notifications.length && <EmptyState text="No investor notifications yet." />}
        </div>
      </section>
    </section>
  );
}

export function InvestorProfileView({
  model,
}: {
  model: InvestorPortalReadModel;
}) {
  return (
    <section className="space-y-4">
      <ProfileHero model={model} />

      <ProfileMetricGrid model={model} />

      <div
        className="grid items-start gap-4"
        style={{
          gridTemplateColumns:
            "minmax(0, 1.08fr) minmax(420px, 0.68fr)",
        }}
      >
        <ProfileAccountDetailsPanel model={model} />
        <ProfileSecurityAccessPanel model={model} />
      </div>

      <div
        className="grid items-start gap-4"
        style={{
          gridTemplateColumns:
            "minmax(0, 0.92fr) minmax(0, 1.08fr)",
        }}
      >
        <ProfilePositionPanel model={model} />
        <ProfileDocumentsActivityPanel model={model} />
      </div>

      <ProfileAppearanceCard portal="Investor" />
    </section>
  );
}

function ProfileHero({ model }: { model: InvestorPortalReadModel }) {
  const { summary } = model;

  return (
    <section className="rounded-2xl border border-[var(--primary-border)] bg-[image:var(--gradient-hero)] p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(520px,0.9fr)] xl:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[24px] font-semibold text-[var(--primary)] shadow-[var(--glow-brand)]">
            {summary.investorInitials}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">
                Investor profile
              </span>
              <span className="rounded-full border border-[var(--success-border)] bg-[var(--success-soft)] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--success)]">
                Active account
              </span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                {summary.currency} reporting
              </span>
            </div>

            <h2 className="mt-4 truncate text-[30px] font-semibold tracking-[-0.055em] text-[#0b1f3a] sm:text-[38px]">
  {summary.investorName}
</h2>

<p className="mt-2 truncate text-[12px] text-[#61778d]">
  {summary.investorEmail || "No email recorded"} · Investor workspace for {summary.companyName}
</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <HeroMiniStat
            icon={PieChart}
            label="Equity owned"
            value={percent(summary.equityPercent)}
          />
          <HeroMiniStat
            icon={WalletCards}
            label="Total invested"
            value={money(summary.totalInvestment, summary.currency)}
          />
          <HeroMiniStat
            icon={ShieldCheck}
            label="Access status"
            value="Active"
          />
        </div>
      </div>
    </section>
  );
}

function ProfileMetricGrid({ model }: { model: InvestorPortalReadModel }) {
  const { summary } = model;

  const metrics = [
    {
      icon: Building2,
      label: "Company",
      value: summary.companyName,
      caption: "Investor workspace",
    },
    {
      icon: PieChart,
      label: "Equity owned",
      value: percent(summary.equityPercent),
      caption: "Completed ownership only",
    },
    {
      icon: WalletCards,
      label: "Book value",
      value: money(summary.estimatedHoldingValue, summary.currency),
      caption: "Carried at completed investment cost",
    },
    {
      icon: Bell,
      label: "Unread notices",
      value: `${summary.unreadNotificationCount}`,
      caption: "Investor notifications",
    },
    {
      icon: FileCheck2,
      label: "Certificates",
      value: `${summary.certificateCount}`,
      caption: "Issued ownership records",
    },
    {
      icon: FileText,
      label: "Documents",
      value: `${summary.documentCount}`,
      caption: "Investor-visible files",
    },
    {
      icon: CheckCircle2,
      label: "Completed offers",
      value: `${summary.completedOfferCount}`,
      caption: "Finalised investments",
    },
    {
      icon: Clock3,
      label: "Pending offers",
      value: `${summary.pendingOfferCount}`,
      caption: "Awaiting completion",
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <DashboardMetricCard key={metric.label} {...metric} />
      ))}
    </div>
  );
}

function ProfileAccountDetailsPanel({ model }: { model: InvestorPortalReadModel }) {
  const { summary } = model;

  return (
    <section className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Account details
          </p>
          <h3 className="mt-2 text-[18px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
            Investor identity
          </h3>
          <p className="mt-2 text-[11px] leading-5 text-[var(--text-tertiary)]">
            Read-only account information connected to this investor workspace.
          </p>
        </div>

        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]">
          <UserRound className="h-[18px] w-[18px]" />
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <ProfileDetailTile icon={UserRound} label="Full name" value={summary.investorName} />
        <ProfileDetailTile icon={Mail} label="Email" value={summary.investorEmail || "—"} />
        <ProfileDetailTile icon={Building2} label="Company" value={summary.companyName} />
        <ProfileDetailTile icon={BadgeCheck} label="Role" value="Investor" />
        <ProfileDetailTile icon={Fingerprint} label="Investor ID" value={summary.investorId} mono />
        <ProfileDetailTile icon={Fingerprint} label="Company ID" value={summary.companyId} mono />
      </div>
    </section>
  );
}

function ProfileSecurityAccessPanel({ model }: { model: InvestorPortalReadModel }) {
  const { summary } = model;
  const latestNotice = model.notifications[0] || null;
  const latestActivity = model.activity[0] || null;

  return (
    <section className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Access & security
          </p>
          <h3 className="mt-2 text-[18px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
            Portal access
          </h3>
          <p className="mt-2 text-[11px] leading-5 text-[var(--text-tertiary)]">
            Investor access is limited to your own profile, investment records and approved documents.
          </p>
        </div>

        <ProfileStatusPill label="Active" />
      </div>

      <div className="mt-5 space-y-3">
        <SecurityRow
          icon={ShieldCheck}
          label="Account status"
          value="Active investor access"
          status="Connected"
        />
        <SecurityRow
          icon={KeyRound}
          label="Permissions"
          value="Read-only investor workspace"
          status="Restricted"
        />
        <SecurityRow
          icon={Bell}
          label="Notifications"
          value={`${summary.unreadNotificationCount} unread investor notices`}
          status={summary.unreadNotificationCount > 0 ? "Unread" : "Clear"}
        />
        <SecurityRow
          icon={Clock3}
          label="Latest notice"
          value={latestNotice ? latestNotice.title : "No notifications yet"}
          status={latestNotice ? dateLabel(latestNotice.createdAt) : "—"}
        />
        <SecurityRow
          icon={Activity}
          label="Latest activity"
          value={latestActivity ? latestActivity.title : "No investor activity recorded"}
          status={latestActivity ? dateLabel(latestActivity.createdAt) : "—"}
        />
      </div>
    </section>
  );
}

function ProfilePositionPanel({ model }: { model: InvestorPortalReadModel }) {
  const { summary } = model;
  const completedEquity = Math.max(
    Math.min(Number(summary.equityPercent || 0), 100),
    summary.equityPercent > 0 ? 4 : 0,
  );

  return (
    <section className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-hero)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Investor position
          </p>
          <h3 className="mt-2 text-[18px] font-semibold tracking-[-0.04em] text-[#0b1f3a]">
  Your ownership record
</h3>

<p className="mt-2 text-[11px] leading-5 text-[#61778d]">
  This section only shows your completed equity. It does not reveal founder or other investor ownership.
</p>
        </div>
        <span className="text-[22px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
          {percent(summary.equityPercent)}
        </span>
      </div>

      <div className="mt-5 h-2.5 rounded-full bg-[var(--surface-soft)]">
        <div
          className="h-full rounded-full bg-[var(--primary)] shadow-[var(--glow-brand)]"
          style={{ width: `${completedEquity}%` }}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <ProfilePositionTile
          label="Capital into company"
          value={money(summary.capitalContributed, summary.currency)}
          detail="Company-account investment"
        />
        <ProfilePositionTile
          label="Secondary purchase"
          value={money(summary.founderPurchaseAmount, summary.currency)}
          detail="Existing-equity purchase"
        />
        <ProfilePositionTile
          label="Book value"
          value={money(summary.estimatedHoldingValue, summary.currency)}
          detail="Carried at investment cost"
        />
        <ProfilePositionTile
          label="Return status"
          value={returnLabel(summary)}
          detail="No realised exit/dividend recorded"
        />
      </div>
    </section>
  );
}

function ProfileDocumentsActivityPanel({ model }: { model: InvestorPortalReadModel }) {
  const latestDocs = [
    ...model.certificates.slice(0, 2).map((certificate) => ({
      id: certificate.id,
      icon: ShieldCheck,
      title: "Share certificate",
      subtitle: certificate.certificateNumber,
      date: dateLabel(certificate.issuedAt),
    })),
    ...model.documents.slice(0, 2).map((document) => ({
      id: document.id,
      icon: FileText,
      title: document.title,
      subtitle: document.fileName || document.category,
      date: dateLabel(document.uploadedAt),
    })),
  ].slice(0, 4);

  const timeline = [
    ...model.activity.slice(0, 4),
    ...model.notifications.slice(0, 4).map((notice) => ({
      id: `notice-${notice.id}`,
      type: notice.type || "notification",
      title: notice.title,
      description: notice.message,
      createdAt: notice.createdAt,
    })),
  ].slice(0, 5);

  return (
    <section className="rounded-xl border border-[var(--primary-border)] bg-[image:var(--gradient-card)] p-4 shadow-[var(--shadow-card)]">
      <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0, 0.9fr) minmax(360px, 0.8fr)" }}>
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Documents access
          </p>
          <h3 className="mt-2 text-[18px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
            Profile-linked files
          </h3>
          <p className="mt-2 text-[11px] leading-5 text-[var(--text-tertiary)]">
            Approved investor documents connected to your account.
          </p>

          <div className="mt-4 space-y-2.5">
            {latestDocs.map((doc) => (
              <ProfileDocumentAccessRow
                key={doc.id}
                date={doc.date}
                icon={doc.icon}
                subtitle={doc.subtitle}
                title={doc.title}
              />
            ))}

            {!latestDocs.length && (
              <EmptyState text="No investor documents are currently linked to this profile." />
            )}
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
              Account timeline
            </p>
            <span className="text-[9px] font-medium text-[var(--primary)]">Latest</span>
          </div>

          <div className="mt-4 space-y-3.5">
            {timeline.map((item) => (
              <div key={item.id} className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-start gap-3">
                <ActivityDot type={item.type} />
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium text-[var(--text-primary)]">{item.title}</p>
                  <p className="mt-1 line-clamp-1 text-[9px] leading-4 text-[var(--text-tertiary)]">{item.description}</p>
                </div>
                <span className="shrink-0 pt-0.5 text-right text-[9px] text-[var(--text-tertiary)]">
                  {dateLabel(item.createdAt)}
                </span>
              </div>
            ))}

            {!timeline.length && (
              <p className="rounded-xl border border-dashed border-[var(--border)] p-5 text-center text-[10px] text-[var(--text-tertiary)]">
                No profile activity yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfileDetailTile({
  icon: Icon,
  label,
  mono = false,
  value,
}: {
  icon: DashboardIcon;
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[34px_minmax(0,1fr)] gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]">
        <Icon className="h-[15px] w-[15px]" />
      </span>
      <div className="min-w-0">
        <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{label}</p>
        <p
          className={[
            "mt-1 truncate text-[11px] font-medium text-[var(--text-primary)]",
            mono ? "font-mono text-[10px]" : "",
          ].join(" ")}
          title={value}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function SecurityRow({
  icon: Icon,
  label,
  status,
  value,
}: {
  icon: DashboardIcon;
  label: string;
  status: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--primary-border)] bg-[var(--primary-soft)] text-[var(--primary)]">
        <Icon className="h-[15px] w-[15px]" />
      </span>
      <div className="min-w-0">
        <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{label}</p>
        <p className="mt-1 truncate text-[11px] font-medium text-[var(--text-secondary)]">{value}</p>
      </div>
      <span className="shrink-0 rounded-full border border-[var(--primary-border)] bg-[var(--primary-soft)] px-2.5 py-1 text-[9px] font-medium text-[var(--primary)]">
        {status}
      </span>
    </div>
  );
}

function ProfileStatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--success-border)] bg-[var(--success-soft)] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--success)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)] shadow-[var(--glow-success)]" />
      {label}
    </span>
  );
}

function ProfilePositionTile({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
      <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-3 text-[18px] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{value}</p>
      <p className="mt-1 text-[9px] text-[var(--primary)]">{detail}</p>
    </div>
  );
}

function ProfileDocumentAccessRow({
  date,
  icon: Icon,
  subtitle,
  title,
}: {
  date: string;
  icon: DashboardIcon;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--primary)]">
        <Icon className="h-[15px] w-[15px]" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-[var(--text-primary)]">{title}</p>
        <p className="mt-0.5 truncate text-[9px] text-[var(--text-tertiary)]">{subtitle}</p>
      </div>
      <span className="shrink-0 text-[9px] text-[var(--text-tertiary)]">{date}</span>
    </div>
  );
}


function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
      {text}
    </div>
  );
}