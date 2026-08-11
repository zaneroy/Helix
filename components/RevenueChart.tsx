"use client";

export default function RevenueChart() {
  return (
    <div className="landing-mini-chart" aria-label="Revenue growth chart">
      <div className="landing-mini-chart-head">
        <div>
          <p className="landing-mini-label">Revenue</p>
          <p className="landing-mini-value">£24,860</p>
        </div>
        <span className="landing-status landing-status-success">+18.4%</span>
      </div>

      <div className="landing-mini-chart-canvas" aria-hidden="true">
        <span className="landing-chart-grid landing-chart-grid-one" />
        <span className="landing-chart-grid landing-chart-grid-two" />
        <svg viewBox="0 0 360 130" role="presentation" className="landing-mini-chart-svg">
          <defs>
            <linearGradient id="landingRevenueArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M8 108 C48 104 62 92 96 95 C130 97 142 72 176 78 C214 85 225 49 255 58 C292 68 308 26 352 18 L352 126 L8 126 Z"
            fill="url(#landingRevenueArea)"
          />
          <path
            d="M8 108 C48 104 62 92 96 95 C130 97 142 72 176 78 C214 85 225 49 255 58 C292 68 308 26 352 18"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="landing-mini-chart-months" aria-hidden="true">
        <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
      </div>
    </div>
  );
}
