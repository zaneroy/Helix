const stack = ["Next.js", "Supabase", "Stripe", "OpenAI", "TypeScript", "Vercel"];

export default function TrustedLogos() {
  return (
    <section className="landing-trusted-section" aria-label="Technology stack">
      <div className="landing-container">
        <div className="landing-trusted-card">
          <p>Built on modern infrastructure for ambitious businesses</p>
          <div className="landing-trusted-logos">
            {stack.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
