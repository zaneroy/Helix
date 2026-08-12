import Link from "next/link";
import Logo from "@/components/Logo";

const navItems = [
  { label: "Product", href: "#product" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Testimonials", href: "#testimonials" },
  { label: "FAQ", href: "#faq" },
];

export default function Navbar() {
  return (
    <header className="landing-nav-shell">
      <nav className="landing-nav" aria-label="Main navigation">
        <Link href="/" className="landing-nav-brand" aria-label="Helix home">
          <Logo />
        </Link>

        <div className="landing-nav-links">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="landing-nav-link">
              {item.label}
            </a>
          ))}
        </div>

        <div className="landing-nav-actions">
          <Link
  href="/login"
  className="landing-button landing-button-secondary landing-nav-login"
>
  Login
</Link>
          <Link
            href="/signup"
            className="landing-button landing-button-primary landing-nav-start"
          >
            Start now
          </Link>
        </div>
      </nav>
    </header>
  );
}
