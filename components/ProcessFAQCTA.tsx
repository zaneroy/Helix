"use client";

import Link from "next/link";
import { useState } from "react";

const faqs = [
  {
    question: "How long does it take to set up Helix?",
    answer:
      "Most businesses can create a workspace, add company details, invite users and start tracking products, sales and expenses the same day.",
  },
  {
    question: "Can investors see company reports?",
    answer:
      "Yes. Admins can publish reports and documents to the investor portal so investors can securely view company updates.",
  },
  {
    question: "Does Helix include financial intelligence?",
    answer:
      "Yes. Helix includes business health, profitability, liquidity, inventory and valuation intelligence inside its reporting engine.",
  },
  {
    question: "Is my financial data secure?",
    answer:
      "Helix uses role-based access, Supabase authentication, secure storage and company-level data separation.",
  },
  {
    question: "Can I upgrade or downgrade anytime?",
    answer:
      "Subscription management can be connected through Stripe so customers can manage upgrades, downgrades and cancellations.",
  },
];

const steps = [
  { number: "01", title: "Create your company", copy: "Set your workspace, currency, company details and financial starting position." },
  { number: "02", title: "Connect the operation", copy: "Add products, accounts, sales, expenses, documents and the people who need access." },
  { number: "03", title: "Run from one system", copy: "Use live dashboards, reporting, investor visibility and financial intelligence as the business moves." },
];

export default function ProcessFAQCTA() {
  const [open, setOpen] = useState(0);

  return (
    <>
      <section className="landing-process-section">
        <div className="landing-container landing-process-grid">
          <div className="landing-process-card">
            <span className="landing-pill">The process</span>
            <h2>From setup to operating clarity.</h2>
            <p className="landing-process-intro">
              Helix is designed to become useful quickly, then grow with the financial complexity of the business.
            </p>

            <div className="landing-process-steps">
              {steps.map((step) => (
                <div key={step.number} className="landing-process-step">
                  <span>{step.number}</span>
                  <div><strong>{step.title}</strong><p>{step.copy}</p></div>
                </div>
              ))}
            </div>
          </div>

          <div id="faq" className="landing-faq-card">
            <span className="landing-pill">FAQ</span>
            <h2>Questions? We’ve got answers.</h2>
            <p className="landing-faq-intro">The key things businesses need to know before using Helix.</p>

            <div className="landing-faq-list">
              {faqs.map((item, index) => {
                const isOpen = open === index;
                return (
                  <button
                    key={item.question}
                    type="button"
                    className={`landing-faq-item${isOpen ? " landing-faq-item-open" : ""}`}
                    onClick={() => setOpen(isOpen ? -1 : index)}
                    aria-expanded={isOpen}
                  >
                    <span className="landing-faq-question"><strong>{item.question}</strong><i>{isOpen ? "−" : "+"}</i></span>
                    {isOpen && <span className="landing-faq-answer">{item.answer}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-final-cta-section">
        <div className="landing-container">
          <div className="landing-final-cta">
            <div className="landing-final-cta-orb" aria-hidden="true" />
            <span className="landing-pill landing-pill-on-gradient">Ready when you are</span>
            <h2>Run the company with the numbers in front of you.</h2>
            <p>Bring operations, finance, investors and your team into one connected Helix workspace.</p>
            <div className="landing-final-cta-actions">
              <Link href="/signup" className="landing-button landing-button-inverse landing-button-large">Start with Helix</Link>
              <Link href="/admin/login" className="landing-button landing-button-glass landing-button-large">Sign in</Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <div>
            <strong>Helix</strong>
            <span>Financial operating system</span>
          </div>
          <p>Built for businesses that want clarity, control and better financial visibility.</p>
          <div className="landing-footer-links">
            <a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a><Link href="/admin/login">Login</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
