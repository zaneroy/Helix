const features = [
  {
    number: "01",
    title: "One financial command centre",
    copy: "See revenue, profit, cash, expenses, inventory and company health without stitching together separate tools.",
    visual: "metrics",
  },
  {
    number: "02",
    title: "Investors stay informed",
    copy: "Give investors a dedicated portal for holdings, reports, documents, certificates and company performance.",
    visual: "investor",
  },
  {
    number: "03",
    title: "Your team works with control",
    copy: "Employees get role-based access to the workflows they need while founders keep visibility and oversight.",
    visual: "team",
  },
  {
    number: "04",
    title: "Intelligence built into the numbers",
    copy: "Surface profitability, liquidity, inventory and operating signals from the same live financial data.",
    visual: "insights",
  },
];

const testimonials = [
  {
    quote: "Helix replaces the feeling of checking five different systems before I know what is actually happening in the business.",
    name: "Growth-stage founder",
    role: "E-commerce operations",
  },
  {
    quote: "The investor view is the difference. Financial reporting and ownership information finally live in the same place.",
    name: "Private investor",
    role: "Multi-company portfolio",
  },
  {
    quote: "The interface makes finance usable for the rest of the team without giving everyone unrestricted access.",
    name: "Operations lead",
    role: "Small business team",
  },
];

export default function FeaturesTestimonials() {
  return (
    <section id="features" className="landing-features-section">
      <div className="landing-container">
        <div className="landing-section-heading">
          <div>
            <span className="landing-pill">Why Helix</span>
            <h2>Financial control without the fragmentation.</h2>
          </div>
          <p>
            One connected system for the people running the company, the people working inside it,
            and the people who have invested in it.
          </p>
        </div>

        <div className="landing-feature-grid">
          {features.map((feature) => (
            <article key={feature.number} className="landing-feature-card">
              <div className="landing-feature-card-head">
                <span className="landing-feature-number">{feature.number}</span>
                <FeatureIcon type={feature.visual} />
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
              <FeatureVisual type={feature.visual} />
            </article>
          ))}
        </div>

        <div id="testimonials" className="landing-testimonials-block">
          <div className="landing-testimonials-heading">
            <span className="landing-pill">Built for clarity</span>
            <h2>Different roles. One version of the numbers.</h2>
          </div>
          <div className="landing-testimonial-grid">
            {testimonials.map((item) => (
              <figure key={item.name} className="landing-testimonial-card">
                <div className="landing-quote-mark" aria-hidden="true">“</div>
                <blockquote>{item.quote}</blockquote>
                <figcaption>
                  <span className="landing-avatar">{item.name.charAt(0)}</span>
                  <span><strong>{item.name}</strong><small>{item.role}</small></span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureIcon({ type }: { type: string }) {
  const glyph = type === "metrics" ? "↗" : type === "investor" ? "%" : type === "team" ? "◎" : "✦";
  return <span className="landing-feature-icon" aria-hidden="true">{glyph}</span>;
}

function FeatureVisual({ type }: { type: string }) {
  if (type === "metrics") {
    return (
      <div className="landing-feature-visual landing-feature-metrics">
        <span><small>Revenue</small><strong>£24.8k</strong></span>
        <span><small>Net profit</small><strong>£8.7k</strong></span>
        <div className="landing-feature-spark"><i /><i /><i /><i /><i /></div>
      </div>
    );
  }

  if (type === "investor") {
    return (
      <div className="landing-feature-visual landing-feature-investor">
        <div className="landing-feature-donut"><span>10%</span></div>
        <div><small>Your position</small><strong>£15,000</strong><em>Book value</em></div>
      </div>
    );
  }

  if (type === "team") {
    return (
      <div className="landing-feature-visual landing-feature-team">
        {["PJ", "SA", "KT"].map((name, index) => <span key={name} data-index={index}>{name}</span>)}
        <div><strong>Role-based workspace</strong><small>Admin · Employee · Investor</small></div>
      </div>
    );
  }

  return (
    <div className="landing-feature-visual landing-feature-insights">
      <span className="landing-insight-dot" />
      <div><strong>Cash position remains healthy</strong><small>Available cash covers current operating spend.</small></div>
    </div>
  );
}
