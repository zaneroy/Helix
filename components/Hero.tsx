import Link from "next/link";
import RevenueChart from "@/components/RevenueChart";

export default function Hero() {
  return (
    <section id="product" className="landing-hero">
      <div className="landing-hero-decoration" aria-hidden="true">
        <span className="landing-orb landing-orb-one" />
        <span className="landing-orb landing-orb-two" />
        <span className="landing-grid-lines" />
      </div>

      <div className="landing-container landing-hero-grid">
        <div className="landing-hero-copy landing-reveal">
          <div className="landing-pill">
            <span className="landing-pill-dot" aria-hidden="true" />
            AI Financial Operating System for growing businesses
          </div>

          <h1 className="landing-hero-title">
            Run your business.
            <span>Own every number.</span>
          </h1>

          <p className="landing-hero-description">
            Helix connects revenue, inventory, expenses, investors, documents,
            reports and financial intelligence inside one real-time operating system.
          </p>

          <div className="landing-hero-actions">
            <Link href="/signup" className="landing-button landing-button-primary landing-button-large">
              Start with Helix
              <span aria-hidden="true">→</span>
            </Link>
            <a href="#pricing" className="landing-button landing-button-secondary landing-button-large">
              View pricing
            </a>
            <a href="#features" className="landing-text-link">
              Explore features <span aria-hidden="true">↓</span>
            </a>
          </div>

          <div className="landing-trust-row" aria-label="Helix product highlights">
            <span><strong>3</strong> secure portals</span>
            <span><strong>Live</strong> financial intelligence</span>
            <span><strong>Role-based</strong> access</span>
          </div>
        </div>

        <div className="landing-hero-preview landing-reveal landing-reveal-delayed">
          <div className="landing-dashboard-frame">
            <div className="landing-dashboard-topbar">
              <div className="landing-dashboard-brand">
                <span className="landing-dashboard-brand-dot" />
                Executive command centre
              </div>
              <span className="landing-dashboard-period">GBP</span>
            </div>

            <div className="landing-dashboard-heading">
              <div>
                <p className="landing-dashboard-eyebrow">Good afternoon, Founder.</p>
                <p className="landing-dashboard-subcopy">Your business at a glance</p>
              </div>
              <span className="landing-status landing-status-success">Healthy · 82/100</span>
            </div>

            <div className="landing-kpi-grid">
              <PreviewKpi label="Revenue" value="£24.8k" note="+18.4%" tone="brand" />
              <PreviewKpi label="Net profit" value="£8.7k" note="35.2% margin" tone="success" />
              <PreviewKpi label="Available cash" value="£62.4k" note="3 accounts" tone="blue" />
            </div>

            <RevenueChart />

            <div className="landing-dashboard-bottom">
              <div className="landing-preview-list-card">
                <div className="landing-preview-card-title">
                  <span>Financial position</span><span>Live</span>
                </div>
                <PreviewRow label="Inventory capital" value="£18,240" />
                <PreviewRow label="Operating spend" value="£7,310" />
                <PreviewRow label="Investor capital" value="£42,000" />
              </div>

              <div className="landing-health-card">
                <div className="landing-health-ring"><span>82</span></div>
                <p>Business health</p>
                <span>Strong operating position</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewKpi({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "brand" | "success" | "blue";
}) {
  return (
    <div className={`landing-preview-kpi landing-preview-kpi-${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{note}</span>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="landing-preview-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
