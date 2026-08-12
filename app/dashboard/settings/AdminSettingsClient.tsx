"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Activity,
  BadgeDollarSign,
  Bell,
  Boxes,
  Building2,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileText,
  Fingerprint,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LockKeyhole,
  MailCheck,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserRound,
  UsersRound,
  WalletCards,
  Palette,
} from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import LogoutButton from "@/components/auth/LogoutButton";
import { createClient } from "@/lib/supabase/client";
import type {
  AccountSecuritySummary,
  AdminCompanySettings,
  AdminSettingsProfile,
  WorkspaceMetric,
} from "./page";
import type { Notification } from "@/types/notifications";
import ThemeSwitcher from "@/components/theme/ThemeSwitcher";

type Props = {
  adminName: string;
  email: string;
  profile: AdminSettingsProfile;
  company: AdminCompanySettings;
  metrics: WorkspaceMetric[];
  security: AccountSecuritySummary;
  error?: string;
  success?: string;
  updateCompanySettings: (formData: FormData) => void;
  updateAdminProfile: (formData: FormData) => void;
  notifications: Notification[];
  userId: string;
};

type Section =
  | "overview"
  | "company"
  | "appearance"
  | "account"
  | "security";

const currencies = ["USD", "CAD", "GBP", "EUR", "AUD", "PKR", "AED"];

const metricIcons: Record<WorkspaceMetric["key"], typeof UsersRound> = {
  employees: UsersRound,
  investors: Landmark,
  customers: UserRound,
  products: Boxes,
  sales: ShoppingBag,
  expenses: WalletCards,
  invoices: ReceiptText,
  documents: FileText,
  tasks: Activity,
};

export default function AdminSettingsClient({
  adminName,
  email,
  profile,
  company,
  metrics,
  security,
  error,
  success,
  updateCompanySettings,
  updateAdminProfile,
  notifications,
  userId,
}: Props) {
  const supabase = createClient();
  const [section, setSection] = useState<Section>("overview");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  const availableMetrics = metrics.filter((metric) => metric.available);
  const workspaceObjects = availableMetrics.reduce(
    (total, metric) => total + metric.count,
    0
  );
  const connectedModules = availableMetrics.length;

  const healthScore = useMemo(() => {
    const identity = company.name.trim() ? 25 : 0;
    const currency = company.currency ? 15 : 0;
    const founder = profile.full_name?.trim() ? 20 : 0;
    const emailVerified = security.emailConfirmedAt ? 20 : 0;
    const modules = Math.round((connectedModules / Math.max(metrics.length, 1)) * 20);
    return Math.min(identity + currency + founder + emailVerified + modules, 100);
  }, [company, profile, security, connectedModules, metrics.length]);

  async function sendPasswordReset() {
    setResetLoading(true);
    setResetMessage("");

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/reset-password` }
    );

    if (resetError) {
      setResetMessage(resetError.message);
      setResetLoading(false);
      return;
    }

    setResetMessage("Password reset email sent securely.");
    setResetLoading(false);
  }

  return (
    <AdminShell
      title="Settings"
      adminName={adminName}
      adminRole="Founder"
      showPageHeader={false}
      notifications={notifications}
      userId={userId}
    >
      <div className="min-h-full text-[color:var(--text-primary)]">
        <header className="relative overflow-hidden rounded-[28px] border border-[color:var(--border)] bg-[image:var(--gradient-brand-soft)] p-6 shadow-2xl shadow-[var(--shadow-card)] lg:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-[color:var(--border-brand)]" />
          <div className="pointer-events-none absolute -right-8 -top-8 h-44 w-44 rounded-full border border-[color:var(--border-brand)]" />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-[color:var(--primary)]">
                <Sparkles className="h-3.5 w-3.5" />
                Company control centre
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)] sm:text-4xl">
                Run your Helix workspace.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">
                Manage company identity, founder access, security and live
                workspace infrastructure from one executive control surface.
              </p>
            </div>

            <div className="grid min-w-full gap-3 sm:grid-cols-3 xl:min-w-[520px]">
              <HeroMetric label="Workspace health" value={`${healthScore}/100`} note="Live configuration" />
              <HeroMetric label="Connected modules" value={`${connectedModules}/${metrics.length}`} note="Database-backed" />
              <HeroMetric label="Workspace records" value={formatNumber(workspaceObjects)} note="Across live modules" />
            </div>
          </div>
        </header>

        {(error || success) && (
          <div
            className={`mt-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
              error
                ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
                : "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
            }`}
          >
            {error ? <LockKeyhole className="mt-0.5 h-4 w-4" /> : <Check className="mt-0.5 h-4 w-4" />}
            <span>{error || success}</span>
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="h-fit rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3 xl:sticky xl:top-6">
            <div className="px-3 pb-3 pt-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-tertiary)]">Settings navigation</p>
            </div>
            <nav className="space-y-1">
              <NavButton active={section === "overview"} icon={LayoutDashboard} label="Executive overview" onClick={() => setSection("overview")} />
              <NavButton active={section === "company"} icon={Building2} label="Company identity" onClick={() => setSection("company")} />
              <NavButton active={section === "appearance"} icon={Palette} label="Appearance" onClick={() => setSection("appearance")} />
              <NavButton active={section === "account"} icon={UserRound} label="Founder account" onClick={() => setSection("account")} />
              <NavButton active={section === "security"} icon={ShieldCheck} label="Security centre" onClick={() => setSection("security")} />
            </nav>

            <div className="mt-4 rounded-2xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--primary)]">
                <Fingerprint className="h-4 w-4" />
                Founder access
              </div>
              <p className="mt-2 text-xs leading-5 text-[color:var(--text-tertiary)]">
                You are signed in with the highest workspace permission level.
              </p>
              <div className="mt-3 inline-flex rounded-full border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--primary)]">
                Admin · Active
              </div>
            </div>
          </aside>

          <main className="min-w-0">
            {section === "overview" && (
              <OverviewSection
                company={company}
                adminName={adminName}
                email={email}
                metrics={metrics}
                security={security}
                healthScore={healthScore}
                onOpenCompany={() => setSection("company")}
                onOpenAccount={() => setSection("account")}
                onOpenSecurity={() => setSection("security")}
              />
            )}

            {section === "company" && (
              <CompanySection company={company} updateCompanySettings={updateCompanySettings} />
            )}

            {section === "appearance" && (
  <AppearanceSection />
)}

            {section === "account" && (
              <AccountSection
                adminName={adminName}
                email={email}
                profile={profile}
                security={security}
                updateAdminProfile={updateAdminProfile}
              />
            )}

            {section === "security" && (
              <SecuritySection
                email={email}
                security={security}
                resetLoading={resetLoading}
                resetMessage={resetMessage}
                onReset={sendPasswordReset}
              />
            )}
          </main>
        </div>
      </div>
    </AdminShell>
  );
}

function OverviewSection({
  company,
  adminName,
  email,
  metrics,
  security,
  healthScore,
  onOpenCompany,
  onOpenAccount,
  onOpenSecurity,
}: {
  company: AdminCompanySettings;
  adminName: string;
  email: string;
  metrics: WorkspaceMetric[];
  security: AccountSecuritySummary;
  healthScore: number;
  onOpenCompany: () => void;
  onOpenAccount: () => void;
  onOpenSecurity: () => void;
}) {
  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="Executive overview" title="Your operating environment at a glance" description="Every figure below is calculated from your authenticated account and connected company data." />

      <div className="grid gap-4 md:grid-cols-3">
        <ExecutiveCard icon={Building2} eyebrow="Company" title={company.name} detail={`${company.currency || "USD"} reporting currency`} action="Manage identity" onClick={onOpenCompany} />
        <ExecutiveCard icon={UserRound} eyebrow="Founder" title={adminName} detail={email} action="Manage profile" onClick={onOpenAccount} />
        <ExecutiveCard icon={ShieldCheck} eyebrow="Security" title={security.emailConfirmedAt ? "Verified" : "Action required"} detail={security.lastSignInAt ? `Last sign-in ${formatDateTime(security.lastSignInAt)}` : "No sign-in history available"} action="Open security" onClick={onOpenSecurity} />
      </div>

      <Surface>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--primary)]">Workspace health</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em]">Live business infrastructure</h2>
            <p className="mt-2 text-sm text-[color:var(--text-tertiary)]">Counts are loaded directly from each company-scoped module.</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3">
            <HealthRing value={healthScore} />
            <div>
              <p className="text-sm font-medium">Configuration score</p>
              <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">Identity, security and modules</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric) => {
            const Icon = metricIcons[metric.key];
            return (
              <Link
                key={metric.key}
                href={metric.href}
                className="group rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 transition hover:border-[color:var(--border-brand)] hover:bg-[color:var(--primary-soft)]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--primary)]">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-[color:var(--text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--primary)]" />
                </div>
                <div className="mt-5 text-2xl font-semibold tracking-[-0.04em]">
                  {metric.available ? formatNumber(metric.count) : "—"}
                </div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="text-sm text-[color:var(--text-secondary)]">{metric.label}</p>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${metric.available ? "bg-[color:var(--success-soft)] text-[color:var(--success)]" : "bg-[color:var(--warning-soft)] text-[color:var(--warning)]"}`}>
                    {metric.available ? "Connected" : "Unavailable"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </Surface>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Surface>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--primary)]">System integrity</p>
          <h2 className="mt-2 text-xl font-semibold">Verified services</h2>
          <div className="mt-5 space-y-3">
            <SystemRow icon={Fingerprint} title="Authentication" detail="Authenticated founder session" status="Verified" />
            <SystemRow icon={Bell} title="Notification centre" detail={`${formatNumber(0)} unread state managed by AdminShell`} status="Connected" />
            <SystemRow icon={Activity} title="Activity engine" detail="Settings changes emit auditable events" status="Connected" />
            <SystemRow icon={CircleDollarSign} title="Financial defaults" detail={`${company.currency || "USD"} company reporting currency`} status="Configured" />
          </div>
        </Surface>

        <Surface>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--primary)]">Quick access</p>
          <h2 className="mt-2 text-xl font-semibold">Founder actions</h2>
          <div className="mt-5 space-y-3">
            <QuickLink href="/dashboard/activity" icon={Activity} title="Review activity" detail="Audit company events" />
            <QuickLink href="/dashboard/reports" icon={BadgeDollarSign} title="Open reports" detail="Generate investor-grade reporting" />
            <QuickLink href="/dashboard/documents" icon={FileText} title="Open document vault" detail="Manage published company files" />
          </div>
        </Surface>
      </div>
    </div>
  );
}

function CompanySection({ company, updateCompanySettings }: { company: AdminCompanySettings; updateCompanySettings: (formData: FormData) => void }) {
  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="Company identity" title="The financial identity behind every Helix record" description="Company name and reporting currency flow through dashboards, reports and finance modules." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Surface>
          <form action={updateCompanySettings} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <Field name="company_name" label="Legal or trading name" defaultValue={company.name} required icon={Building2} />
              <SelectField name="currency" label="Reporting currency" defaultValue={company.currency || "USD"} options={currencies} icon={CircleDollarSign} />
            </div>
            <ReadOnly label="Company identifier" value={company.id} icon={Fingerprint} />
            <div className="flex justify-end border-t border-[color:var(--border)] pt-5">
              <SubmitButton label="Save company settings" />
            </div>
          </form>
        </Surface>

        <div className="space-y-4">
          <InsightCard icon={CircleDollarSign} title="Reporting currency" text="Your selected currency is used as the company-wide financial display default." />
          <InsightCard icon={RefreshCw} title="Platform refresh" text="Saving automatically refreshes connected admin, investor and employee views." />
          <InsightCard icon={Activity} title="Audit trail" text="Every visible change is recorded through the Helix event engine." />
        </div>
      </div>
    </div>
  );
}

function AppearanceSection() {
  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Appearance"
        title="Choose how Helix looks"
        description="Select the appearance Helix should use on this device. Light is the default, Dark uses the Helix midnight theme, and System follows your device appearance."
      />

      <Surface>
        <ThemeSwitcher />
      </Surface>
    </div>
  );
}

function AccountSection({ adminName, email, profile, security, updateAdminProfile }: { adminName: string; email: string; profile: AdminSettingsProfile; security: AccountSecuritySummary; updateAdminProfile: (formData: FormData) => void }) {
  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="Founder account" title="Your executive identity and account record" description="Manage the founder name shown throughout Helix while keeping immutable access details visible." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Surface>
          <form action={updateAdminProfile} className="space-y-5">
            <Field name="full_name" label="Founder full name" defaultValue={profile.full_name || adminName} required icon={UserRound} />
            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnly label="Email address" value={email} icon={MailCheck} />
              <ReadOnly label="Access role" value={profile.role || "admin"} icon={ShieldCheck} />
            </div>
            <ReadOnly label="User identifier" value={profile.id} icon={Fingerprint} />
            <div className="flex justify-end border-t border-[color:var(--border)] pt-5">
              <SubmitButton label="Save founder profile" />
            </div>
          </form>
        </Surface>

        <Surface>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--primary)]">Account timeline</p>
          <div className="mt-5 space-y-5">
            <TimelineItem icon={UserRound} label="Account created" value={formatDateTime(security.createdAt)} />
            <TimelineItem icon={Clock3} label="Last successful sign-in" value={formatDateTime(security.lastSignInAt)} />
            <TimelineItem icon={MailCheck} label="Email verification" value={security.emailConfirmedAt ? formatDateTime(security.emailConfirmedAt) : "Not verified"} />
          </div>
        </Surface>
      </div>
    </div>
  );
}

function SecuritySection({ email, security, resetLoading, resetMessage, onReset }: { email: string; security: AccountSecuritySummary; resetLoading: boolean; resetMessage: string; onReset: () => void }) {
  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="Security centre" title="Protect founder access to your financial operating system" description="Review verified account signals, issue a secure password reset and end the current session." />

      <div className="grid gap-4 md:grid-cols-3">
        <SecurityCard icon={MailCheck} label="Email verification" value={security.emailConfirmedAt ? "Verified" : "Not verified"} positive={Boolean(security.emailConfirmedAt)} />
        <SecurityCard icon={Clock3} label="Last sign-in" value={formatDateTime(security.lastSignInAt)} positive={Boolean(security.lastSignInAt)} />
        <SecurityCard icon={ShieldCheck} label="Access level" value="Founder admin" positive />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <Surface>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
            <KeyRound className="h-5 w-5" />
          </div>
          <h2 className="mt-5 text-xl font-semibold">Password recovery</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--text-tertiary)]">
            Send a secure Supabase password-reset link to <span className="text-[color:var(--text-primary)]">{email}</span>. The current password is never exposed to Helix.
          </p>
          <button type="button" onClick={onReset} disabled={resetLoading || !email} className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-5 py-3 text-sm font-medium text-[color:var(--primary)] transition hover:bg-[color:var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-50">
            {resetLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
            {resetLoading ? "Sending secure link..." : "Send password reset email"}
          </button>
          {resetMessage && <p className="mt-4 text-sm text-[color:var(--primary)]">{resetMessage}</p>}
        </Surface>

        <Surface>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-primary)]">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <h2 className="mt-5 text-xl font-semibold">Current session</h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-tertiary)]">End access to this device. Your company data remains secured in Helix.</p>
          <div className="mt-6"><LogoutButton /></div>
        </Surface>
      </div>
    </div>
  );
}

function Surface({ children }: { children: React.ReactNode }) {
  return <section className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5 shadow-xl shadow-[var(--shadow-card)] sm:p-6">{children}</section>;
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div><p className="text-xs uppercase tracking-[0.22em] text-[color:var(--primary)]">{eyebrow}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">{title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-tertiary)]">{description}</p></div>;
}

function HeroMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 backdrop-blur"><p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-tertiary)]">{label}</p><p className="mt-2 text-xl font-semibold tracking-[-0.03em]">{value}</p><p className="mt-1 text-[11px] text-[color:var(--text-tertiary)]">{note}</p></div>;
}

function NavButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof LayoutDashboard; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${active ? "border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]" : "border border-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--text-primary)]"}`}><Icon className="h-4 w-4" />{label}</button>;
}

function ExecutiveCard({ icon: Icon, eyebrow, title, detail, action, onClick }: { icon: typeof Building2; eyebrow: string; title: string; detail: string; action: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="group rounded-[22px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5 text-left transition hover:-translate-y-0.5 hover:border-[color:var(--border-brand)] hover:bg-[color:var(--primary-soft)]"><div className="flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--primary)]"><Icon className="h-4.5 w-4.5" /></div><ChevronRight className="h-4 w-4 text-[color:var(--text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--primary)]" /></div><p className="mt-5 text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">{eyebrow}</p><p className="mt-2 truncate text-lg font-semibold">{title}</p><p className="mt-1 truncate text-xs text-[color:var(--text-tertiary)]">{detail}</p><p className="mt-4 text-xs font-medium text-[color:var(--primary)]">{action}</p></button>;
}

function HealthRing({ value }: { value: number }) {
  return <div className="relative grid h-12 w-12 place-items-center rounded-full" style={{ background: `conic-gradient(var(--chart-1) ${value * 3.6}deg, var(--progress-track) 0deg)` }}><div className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--surface)] text-[11px] font-semibold text-[color:var(--primary)]">{value}</div></div>;
}

function SystemRow({ icon: Icon, title, detail, status }: { icon: typeof Activity; title: string; detail: string; status: string }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3.5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--primary)]"><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-medium">{title}</p><p className="mt-0.5 truncate text-xs text-[color:var(--text-tertiary)]">{detail}</p></div><span className="rounded-full bg-[color:var(--success-soft)] px-2.5 py-1 text-[10px] font-medium text-[color:var(--success)]">{status}</span></div>;
}

function QuickLink({ href, icon: Icon, title, detail }: { href: string; icon: typeof Activity; title: string; detail: string }) {
  return <Link href={href} className="group flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3.5 transition hover:border-[color:var(--border-brand)]"><div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--primary)]"><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-medium">{title}</p><p className="mt-0.5 truncate text-xs text-[color:var(--text-tertiary)]">{detail}</p></div><ChevronRight className="h-4 w-4 text-[color:var(--text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--primary)]" /></Link>;
}

function Field({ name, label, defaultValue, required, icon: Icon }: { name: string; label: string; defaultValue?: string; required?: boolean; icon: typeof Building2 }) {
  return <label className="block"><span className="text-xs font-medium text-[color:var(--text-secondary)]">{label}</span><div className="mt-2 flex items-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 transition focus-within:border-[color:var(--border-brand)] focus-within:bg-[color:var(--primary-soft)]"><Icon className="h-4 w-4 text-[color:var(--text-muted)]" /><input name={name} defaultValue={defaultValue} required={required} className="w-full bg-transparent px-3 py-3 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]" /></div></label>;
}

function SelectField({ name, label, defaultValue, options, icon: Icon }: { name: string; label: string; defaultValue: string; options: string[]; icon: typeof CircleDollarSign }) {
  return <label className="block"><span className="text-xs font-medium text-[color:var(--text-secondary)]">{label}</span><div className="mt-2 flex items-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 transition focus-within:border-[color:var(--border-brand)]"><Icon className="h-4 w-4 text-[color:var(--text-muted)]" /><select name={name} defaultValue={defaultValue} className="w-full bg-transparent px-3 py-3 text-sm text-[color:var(--text-primary)] outline-none">{options.map((option) => <option key={option} value={option} className="bg-[color:var(--surface-soft)]">{option}</option>)}</select></div></label>;
}

function ReadOnly({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Fingerprint }) {
  return <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3"><div className="flex items-center gap-2 text-xs text-[color:var(--text-tertiary)]"><Icon className="h-3.5 w-3.5" />{label}</div><p className="mt-2 break-all text-sm text-[color:var(--text-primary)]">{value}</p></div>;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="inline-flex min-w-[190px] items-center justify-center gap-2 rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-5 py-3 text-sm font-medium text-[color:var(--primary)] transition hover:bg-[color:var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-50">{pending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{pending ? "Saving changes..." : label}</button>;
}

function InsightCard({ icon: Icon, title, text }: { icon: typeof Activity; title: string; text: string }) {
  return <div className="rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5"><div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--primary)]"><Icon className="h-4 w-4" /></div><h3 className="mt-4 text-sm font-medium">{title}</h3><p className="mt-2 text-xs leading-5 text-[color:var(--text-tertiary)]">{text}</p></div>;
}

function TimelineItem({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return <div className="flex gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--primary)]"><Icon className="h-4 w-4" /></div><div><p className="text-xs text-[color:var(--text-tertiary)]">{label}</p><p className="mt-1 text-sm text-[color:var(--text-primary)]">{value}</p></div></div>;
}

function SecurityCard({ icon: Icon, label, value, positive }: { icon: typeof ShieldCheck; label: string; value: string; positive: boolean }) {
  return <div className="rounded-[22px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-5"><div className="flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--primary)]"><Icon className="h-4.5 w-4.5" /></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${positive ? "bg-[color:var(--success-soft)] text-[color:var(--success)]" : "bg-[color:var(--warning-soft)] text-[color:var(--warning)]"}`}>{positive ? "Secure" : "Review"}</span></div><p className="mt-5 text-xs text-[color:var(--text-tertiary)]">{label}</p><p className="mt-2 text-sm font-medium text-[color:var(--text-primary)]">{value}</p></div>;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}