"use client";

import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { useState } from "react";

type BillingCycle = "monthly" | "yearly";

type Plan = {
  name: string;
  description: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  admins: string;
  employees: string;
  investors: string;
  featured?: boolean;
  features: {
    label: string;
    included: boolean;
  }[];
};

const plans: Plan[] = [
  {
    name: "Launch",
    description:
      "For small businesses that want to manage their finances and operations in one place.",
    monthlyPrice: 19,
    yearlyPrice: 190,
    admins: "1 admin",
    employees: "Up to 3 employees",
    investors: "No investor access",
    features: [
      { label: "Admin dashboard", included: true },
      { label: "Sales management", included: true },
      { label: "Products & inventory", included: true },
      { label: "Customer management", included: true },
      { label: "Expense management", included: true },
      { label: "Accounts & cash management", included: true },
      { label: "Invoice management", included: true },
      { label: "Import & export", included: true },
      { label: "Financial reports & PDFs", included: true },
      { label: "Company documents", included: true },
      { label: "Basic employee management", included: true },
      { label: "Investor management", included: false },
      { label: "Advanced equity management", included: false },
    ],
  },

  {
    name: "Growth",
    description:
      "For growing companies managing their finances, employees and investor relationships.",
    monthlyPrice: 49,
    yearlyPrice: 490,
    admins: "Up to 5 admins",
    employees: "Up to 15 employees",
    investors: "Up to 5 investors",
    featured: true,
    features: [
      { label: "Everything in Launch", included: true },
      { label: "Full employee portal", included: true },
      { label: "Employee sales & expenses", included: true },
      { label: "Employee inventory & tasks", included: true },
      { label: "Workforce management", included: true },
      { label: "Investor management", included: true },
      { label: "Investor invitations & accounts", included: true },
      { label: "Investor portal", included: true },
      { label: "Investment records", included: true },
      { label: "Investor reports & documents", included: true },
      { label: "Investor notifications", included: true },
      { label: "Investment offer workflow", included: true },
      { label: "Basic ownership records", included: true },
      { label: "Certificate access", included: true },
      { label: "Advanced equity management", included: false },
    ],
  },

  {
    name: "Scale",
    description:
      "For companies that need advanced ownership, equity and corporate-action management.",
    monthlyPrice: 99,
    yearlyPrice: 990,
    admins: "Up to 15 admins",
    employees: "Up to 50 employees",
    investors: "Up to 10 investors",
    features: [
      { label: "Everything in Growth", included: true },
      { label: "Advanced ownership records", included: true },
      { label: "Full certificate management", included: true },
      { label: "Company valuations", included: true },
      { label: "Cap table", included: true },
      { label: "Equity transaction ledger", included: true },
      { label: "Company equity setup", included: true },
      { label: "Share classes", included: true },
      { label: "Opening ownership balances", included: true },
      { label: "Share issuance & transfers", included: true },
      { label: "Conversions & cancellations", included: true },
      { label: "Redemptions & buybacks", included: true },
      { label: "Share splits & reversals", included: true },
      { label: "Corporate actions", included: true },
      { label: "Priority support", included: true },
    ],
  },

  {
    name: "Enterprise",
    description:
      "For larger organisations that need tailored limits, migration and dedicated support.",
    monthlyPrice: null,
    yearlyPrice: null,
    admins: "Custom admins",
    employees: "Custom employees",
    investors: "Custom investors",
    features: [
      { label: "Everything in Scale", included: true },
      { label: "Custom company limits", included: true },
      { label: "Custom admin limits", included: true },
      { label: "Custom employee limits", included: true },
      { label: "Custom investor limits", included: true },
      { label: "Full investor & equity system", included: true },
      { label: "Assisted onboarding", included: true },
      { label: "Data migration assistance", included: true },
      { label: "Priority support", included: true },
      { label: "Custom commercial agreement", included: true },
    ],
  },
];

function getPlanHref(planName: string) {
  return `/signup?plan=${planName.toLowerCase()}`;
}

export default function Pricing() {
  const [billingCycle, setBillingCycle] =
    useState<BillingCycle>("monthly");

  return (
    <section
      id="pricing"
      className="landing-pricing-section"
    >
      <div className="landing-container">
        <div className="landing-pricing-header">
          <span className="landing-section-eyebrow">
            Pricing
          </span>

          <h2>
            Plans that grow with your business.
          </h2>

          <p>
            Start with what you need today and move up as your
            team, investors and ownership structure become more
            complex.
          </p>
        </div>

        <div
          className="landing-billing-toggle"
          role="group"
          aria-label="Billing cycle"
        >
          <button
            type="button"
            className={
              billingCycle === "monthly"
                ? "landing-billing-option landing-billing-option-active"
                : "landing-billing-option"
            }
            onClick={() => setBillingCycle("monthly")}
          >
            Monthly
          </button>

          <button
            type="button"
            className={
              billingCycle === "yearly"
                ? "landing-billing-option landing-billing-option-active"
                : "landing-billing-option"
            }
            onClick={() => setBillingCycle("yearly")}
          >
            Yearly
            <span>Save 17%</span>
          </button>
        </div>

        <div className="landing-pricing-grid">
          {plans.map((plan) => {
            const isEnterprise =
              plan.monthlyPrice === null;

            const displayedPrice =
              billingCycle === "monthly"
                ? plan.monthlyPrice
                : plan.yearlyPrice;

            return (
              <article
                key={plan.name}
                className={
                  plan.featured
                    ? "landing-price-card landing-price-card-featured"
                    : "landing-price-card"
                }
              >
                <div className="landing-price-card-header">
                  <div className="landing-price-name-row">
                    <h3>{plan.name}</h3>

                    {plan.featured && (
                      <span className="landing-popular-badge">
                        Most Popular
                      </span>
                    )}
                  </div>

                  <div className="landing-price-main">
                    {isEnterprise ? (
                      <strong className="landing-price-custom">
                        Custom
                      </strong>
                    ) : (
                      <>
                        <strong>
                          ${displayedPrice}
                        </strong>

                        <span>
                          /
                          {billingCycle === "monthly"
                            ? "month"
                            : "year"}
                        </span>
                      </>
                    )}
                  </div>

                  {!isEnterprise && (
                    <p className="landing-price-renewal">
                      {billingCycle === "monthly"
                        ? "Billed monthly. Cancel anytime."
                        : `Equivalent to about $${(
                            Number(plan.yearlyPrice) / 12
                          ).toFixed(2)}/month. Billed yearly.`}
                    </p>
                  )}

                  {isEnterprise && (
                    <p className="landing-price-renewal">
                      Tailored pricing for your organisation.
                    </p>
                  )}

                  <p className="landing-price-description">
                    {plan.description}
                  </p>

                  <div className="landing-plan-limits">
                    <div>
                      <span>Admins</span>
                      <strong>{plan.admins}</strong>
                    </div>

                    <div>
                      <span>Employees</span>
                      <strong>{plan.employees}</strong>
                    </div>

                    <div>
                      <span>Investors</span>
                      <strong>{plan.investors}</strong>
                    </div>
                  </div>
                </div>

                <Link
                  href={getPlanHref(plan.name)}
                  className={
                    plan.featured
                      ? "landing-price-button landing-price-button-primary"
                      : "landing-price-button"
                  }
                >
                  {isEnterprise
                    ? "Contact Sales"
                    : "Start 14-Day Trial"}
                </Link>

                {!isEnterprise && (
                  <p className="landing-price-trial-copy">
                    $0 today · Card required
                  </p>
                )}

                <div className="landing-price-features">
                  <h4>
                    {plan.name === "Launch"
                      ? "Features you can use:"
                      : `Everything in ${
                          plan.name === "Growth"
                            ? "Launch"
                            : plan.name === "Scale"
                              ? "Growth"
                              : "Scale"
                        }, plus:`}
                  </h4>

                  <ul>
                    {plan.features.map((feature) => (
                      <li
                        key={feature.label}
                        className={
                          feature.included
                            ? ""
                            : "landing-price-feature-disabled"
                        }
                      >
                        <span className="landing-price-feature-icon">
                          {feature.included ? (
                            <Check
                              size={15}
                              strokeWidth={2}
                            />
                          ) : (
                            <Minus
                              size={15}
                              strokeWidth={2}
                            />
                          )}
                        </span>

                        <span>{feature.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>

        <div className="landing-pricing-bottom">
          <p>
            All trials require a valid payment method. Your
            subscription begins automatically after 14 days
            unless cancelled before the trial ends.
          </p>

          <p>
            One free trial per email address and payment card.
          </p>

          <Link href="/signup">
            Compare all plan features
          </Link>
        </div>
      </div>
    </section>
  );
}