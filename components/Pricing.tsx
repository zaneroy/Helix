import Link from "next/link";

const plans = [
  {
    id: "starter",
    name: "Starter",
    desc: "For new businesses getting financial clarity.",
    price: "$29",
    period: "/month",
    cta: "Start Starter",
    features: [
      "1 business workspace",
      "Dashboard KPIs",
      "Inventory tracking",
      "Sales & expenses",
      "Basic reports",
      "Company documents",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    desc: "The complete Helix Financial OS for growing companies.",
    price: "$99",
    period: "/month",
    cta: "Start Professional",
    popular: true,
    features: [
      "Everything in Starter",
      "Investor portal",
      "Employee portal",
      "Business health intelligence",
      "Financial insights",
      "Premium PDF reports",
      "Investor document publishing",
      "Multi-currency support",
      "Role-based access",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    desc: "For larger teams, advisors and multi-company operations.",
    price: "Custom",
    period: "",
    cta: "Contact Sales",
    features: [
      "Multiple businesses",
      "Advanced permissions",
      "Priority support",
      "Audit-ready ledgers",
      "Custom onboarding",
      "API access future-ready",
    ],
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="landing-pricing-section">
      <div className="landing-container">
        <div className="landing-section-heading landing-section-heading-centered">
          <div>
            <span className="landing-pill">Pricing</span>
            <h2>Simple pricing for serious operators.</h2>
          </div>
          <p>
            Start lean, then move into the full Helix experience with investor reporting,
            team workflows and financial intelligence.
          </p>
        </div>

        <div className="landing-pricing-grid">
          {plans.map((plan) => (
            <article key={plan.id} className={`landing-price-card${plan.popular ? " landing-price-card-featured" : ""}`}>
              {plan.popular && <span className="landing-popular-badge">Most popular</span>}
              <span className="landing-plan-icon" aria-hidden="true">△</span>
              <h3>{plan.name}</h3>
              <p className="landing-plan-description">{plan.desc}</p>

              <div className="landing-plan-price">
                <strong>{plan.price}</strong>
                {plan.period && <span>{plan.period}</span>}
              </div>

              <div className="landing-price-divider" />

              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>
                ))}
              </ul>

              <Link
                href={plan.id === "enterprise" ? "/contact" : `/signup?plan=${plan.id}`}
                className={`landing-button landing-price-button ${plan.popular ? "landing-button-primary" : "landing-button-secondary"}`}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>

        <p className="landing-pricing-note">
          Billing, trials and subscription management can connect through Stripe during launch.
        </p>
      </div>
    </section>
  );
}
