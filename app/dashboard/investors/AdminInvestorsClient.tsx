"use client";

import { useMemo, useState, type ReactNode } from "react";
import AdminShell from "@/components/admin/AdminShell";
import type { Notification } from "@/types/notifications";
import InvestorEquityCommandCenter from "./InvestorEquityCommandCenter";
import type { InvestorEquityReadModel } from "@/types/investor-equity";
import type {
  AdminDocumentView,
  AdminInvestor,
  AdminInvestorActivity,
  AdminInvestorNote,
  AdminSharedDocument,
} from "./page";

type Workspace = "ownership" | "access";

type Props = {
  investors: AdminInvestor[];
  notes: AdminInvestorNote[];
  documents: AdminSharedDocument[];
  documentViews: AdminDocumentView[];
  activity: AdminInvestorActivity[];
  error?: string;
  success?: string;
  currency: string;
  companyId: string;
  investorEquity?: InvestorEquityReadModel | null;
  investorEquityError?: string | null;
  saveInvestorNote: (formData: FormData) => void;
  suspendInvestor: (formData: FormData) => void;
  reactivateInvestor: (formData: FormData) => void;
  removeInvestorAccess: (formData: FormData) => void;
  sendInvestorPasswordReset: (formData: FormData) => void;
  notifications: Notification[];
  userId: string;
};

function text(value: unknown, fallback = "—"): string {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function labelize(value: unknown): string {
  return text(value, "not set")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function investorName(investor?: AdminInvestor | null): string {
  return (
    text(investor?.full_name, "") ||
    text(investor?.email, "") ||
    "Investor"
  );
}

function dateLabel(value: unknown): string {
  const raw = text(value, "");
  if (!raw) return "—";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminInvestorsClient({
  investors = [],
  notes = [],
  documents = [],
  documentViews = [],
  activity = [],
  error,
  success,
  currency,
  companyId,
  investorEquity,
  investorEquityError,
  saveInvestorNote,
  suspendInvestor,
  reactivateInvestor,
  removeInvestorAccess,
  sendInvestorPasswordReset,
  notifications,
  userId,
}: Props) {
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>("ownership");
  const [query, setQuery] = useState("");
  const [selectedInvestorId, setSelectedInvestorId] = useState(
    investors[0]?.id || "",
  );

  const investorsById = useMemo(() => {
    const map = new Map<string, AdminInvestor>();

    for (const investor of investors) {
      map.set(investor.id, investor);
    }

    return map;
  }, [investors]);

  const selectedInvestor =
    investorsById.get(selectedInvestorId) || investors[0] || null;

  const filteredInvestors = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) return investors;

    return investors.filter((investor) =>
      [investor.full_name, investor.email, investor.access_status, investor.phone]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [investors, query]);

  const noteByInvestorId = useMemo(() => {
    const map = new Map<string, AdminInvestorNote>();

    for (const note of notes) {
      map.set(note.investor_id, note);
    }

    return map;
  }, [notes]);

  const documentReadCountByInvestor = useMemo(() => {
    const map = new Map<string, number>();

    for (const view of documentViews) {
      map.set(view.investor_id, (map.get(view.investor_id) ?? 0) + 1);
    }

    return map;
  }, [documentViews]);

  const selectedNote = selectedInvestor
    ? noteByInvestorId.get(selectedInvestor.id)
    : null;
  const cleanSuccess =
    success && !success.toLowerCase().includes("capital contribution")
      ? success
      : undefined;

  return (
    <AdminShell
      title="Investors"
      subtitle="Offer equity, record company-account inflows, generate PDFs, and manage investor access."
      notifications={notifications}
      userId={userId}
      showPageHeader={false}
    >
      <div className="space-y-5">
        {error && <Alert tone="danger">{error}</Alert>}
        {cleanSuccess && <Alert tone="success">{cleanSuccess}</Alert>}
        {investorEquityError && (
          <Alert tone="danger">
            Investors could not load: {investorEquityError}
          </Alert>
        )}

        <WorkspaceSwitcher
          activeWorkspace={activeWorkspace}
          setActiveWorkspace={setActiveWorkspace}
        />

        {activeWorkspace === "ownership" && (
          <InvestorEquityCommandCenter
            companyId={companyId}
            currency={currency}
            initialData={investorEquity || null}
            initialError={investorEquityError || null}
            investors={investors}
          />
        )}

        {activeWorkspace === "access" && (
          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <InvestorAccessList
              documentReadCountByInvestor={documentReadCountByInvestor}
              documentsCount={documents.length}
              investors={filteredInvestors}
              query={query}
              reactivateInvestor={reactivateInvestor}
              removeInvestorAccess={removeInvestorAccess}
              selectedInvestorId={selectedInvestor?.id || ""}
              sendInvestorPasswordReset={sendInvestorPasswordReset}
              setQuery={setQuery}
              setSelectedInvestorId={setSelectedInvestorId}
              suspendInvestor={suspendInvestor}
            />

            <InvestorAccessDetail
              investor={selectedInvestor}
              note={selectedNote}
              documentsCount={documents.length}
              readCount={
                selectedInvestor
                  ? documentReadCountByInvestor.get(selectedInvestor.id) ?? 0
                  : 0
              }
              activity={activity.filter(
                (item) => item.investor_id === selectedInvestor?.id,
              )}
              saveInvestorNote={saveInvestorNote}
            />
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function WorkspaceSwitcher({
  activeWorkspace,
  setActiveWorkspace,
}: {
  activeWorkspace: Workspace;
  setActiveWorkspace: (workspace: Workspace) => void;
}) {
  return (
    <div className="flex justify-end">
      <div className="inline-flex rounded-2xl border border-[color:var(--border)] bg-[color:var(--app-bg)] p-1">
        <NavButton
          active={activeWorkspace === "ownership"}
          onClick={() => setActiveWorkspace("ownership")}
        >
          Equity overview
        </NavButton>
        <NavButton
          active={activeWorkspace === "access"}
          onClick={() => setActiveWorkspace("access")}
        >
          Investor access
        </NavButton>
      </div>
    </div>
  );
}

function InvestorAccessList({
  documentReadCountByInvestor,
  documentsCount,
  investors,
  query,
  reactivateInvestor,
  removeInvestorAccess,
  selectedInvestorId,
  sendInvestorPasswordReset,
  setQuery,
  setSelectedInvestorId,
  suspendInvestor,
}: {
  documentReadCountByInvestor: Map<string, number>;
  documentsCount: number;
  investors: AdminInvestor[];
  query: string;
  reactivateInvestor: (formData: FormData) => void;
  removeInvestorAccess: (formData: FormData) => void;
  selectedInvestorId: string;
  sendInvestorPasswordReset: (formData: FormData) => void;
  setQuery: (query: string) => void;
  setSelectedInvestorId: (id: string) => void;
  suspendInvestor: (formData: FormData) => void;
}) {
  return (
    <section className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 md:p-6">
      <SectionTitle
        eyebrow="Access"
        title="Investor accounts"
        subtitle="Manage investor access and document visibility."
      />

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="mt-5 h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--border-brand)]"
        placeholder="Search investors..."
      />

      <div className="mt-4 grid gap-3">
        {investors.map((investor) => {
          const selected = investor.id === selectedInvestorId;
          const readCount = documentReadCountByInvestor.get(investor.id) ?? 0;

          return (
            <div
              key={investor.id}
              className={[
                "rounded-2xl border p-4 transition",
                selected
                  ? "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface-soft)]",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => setSelectedInvestorId(investor.id)}
                className="w-full text-left"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-[color:var(--text-primary)]">
                      {investorName(investor)}
                    </p>
                    <p className="mt-1 text-sm text-[color:var(--text-tertiary)]">
                      {text(investor.email, "No email")}
                    </p>
                  </div>
                  <StatusBadge status={investor.access_status || "active"} />
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  <Mini label="Docs read" value={`${readCount}/${documentsCount}`} />
                  <Mini label="Phone" value={text(investor.phone, "Not set")} />
                </div>
              </button>

              <div className="mt-4 flex flex-wrap gap-2">
                <SmallFormButton
                  action={sendInvestorPasswordReset}
                  investorId={investor.id}
                  label="Reset password"
                />
                {investor.access_status === "suspended" ? (
                  <SmallFormButton
                    action={reactivateInvestor}
                    investorId={investor.id}
                    label="Reactivate"
                  />
                ) : (
                  <SmallFormButton
                    action={suspendInvestor}
                    investorId={investor.id}
                    label="Suspend"
                  />
                )}
                <SmallFormButton
                  action={removeInvestorAccess}
                  investorId={investor.id}
                  label="Remove access"
                  danger
                />
              </div>
            </div>
          );
        })}

        {!investors.length && (
          <EmptyState text="No investors found." />
        )}
      </div>
    </section>
  );
}

function InvestorAccessDetail({
  activity,
  documentsCount,
  investor,
  note,
  readCount,
  saveInvestorNote,
}: {
  activity: AdminInvestorActivity[];
  documentsCount: number;
  investor: AdminInvestor | null;
  note?: AdminInvestorNote | null;
  readCount: number;
  saveInvestorNote: (formData: FormData) => void;
}) {
  if (!investor) {
    return (
      <section className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 md:p-6">
        <SectionTitle
          eyebrow="Investor"
          title="No investor selected"
          subtitle="Choose an investor from the list."
        />
      </section>
    );
  }

  const readRate =
    documentsCount > 0 ? Math.round((readCount / documentsCount) * 100) : 0;

  return (
    <div className="space-y-5">
      <section className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 md:p-6">
        <SectionTitle
          eyebrow="Investor"
          title={investorName(investor)}
          subtitle={text(investor.email, "No email")}
        />

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Mini label="Access" value={labelize(investor.access_status || "active")} />
          <Mini label="Documents read" value={`${readCount}/${documentsCount}`} />
          <Mini label="Read rate" value={`${readRate}%`} />
        </div>

        <form action={saveInvestorNote} className="mt-5 grid gap-3">
          <input type="hidden" name="investor_id" value={investor.id} />
          <label className="grid gap-2 text-sm text-[color:var(--text-secondary)]">
            Private note
            <textarea
              name="notes"
              defaultValue={note?.notes || ""}
              rows={5}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3 text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--border-brand)]"
              placeholder="Internal note for this investor..."
            />
          </label>

          <button
            type="submit"
            className="h-11 rounded-2xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-4 text-sm font-semibold text-[color:var(--primary)] transition hover:bg-[color:var(--primary-soft)]"
          >
            Save note
          </button>
        </form>
      </section>

      <section className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 md:p-6">
        <SectionTitle
          eyebrow="Activity"
          title="Recent access activity"
          subtitle="Investor portal activity and admin access changes."
        />

        <div className="mt-5 grid gap-3">
          {activity.slice(0, 6).map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold text-[color:var(--text-primary)]">{item.title}</p>
                  <p className="mt-1 text-sm text-[color:var(--text-tertiary)]">
                    {item.description || labelize(item.type)}
                  </p>
                </div>
                <span className="text-xs text-[color:var(--text-tertiary)]">
                  {dateLabel(item.created_at)}
                </span>
              </div>
            </div>
          ))}

          {!activity.length && (
            <EmptyState text="No recent access activity for this investor." />
          )}
        </div>
      </section>
    </div>
  );
}

function SmallFormButton({
  action,
  danger = false,
  investorId,
  label,
}: {
  action: (formData: FormData) => void;
  danger?: boolean;
  investorId: string;
  label: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="investor_id" value={investorId} />
      <button
        type="submit"
        className={[
          "rounded-xl border px-3 py-2 text-xs font-semibold transition",
          danger
            ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)] hover:bg-[color:var(--danger-soft)]"
            : "border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-primary)] hover:bg-[color:var(--surface-soft)]",
        ].join(" ")}
      >
        {label}
      </button>
    </form>
  );
}

function NavButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border px-4 py-2.5 text-sm font-semibold transition",
        active
          ? "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
          : "border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--text-primary)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--primary)]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
        {title}
      </h2>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-[color:var(--text-tertiary)]">
        {subtitle}
      </p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-tertiary)]">
        {label}
      </p>
      <p className="mt-1 font-semibold text-[color:var(--text-primary)]">{value}</p>
    </div>
  );
}

function Pill({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "cyan" | "green" | "amber" | "slate";
}) {
  return (
    <span
      className={[
        "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        tone === "cyan"
          ? "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
          : tone === "green"
            ? "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
            : tone === "amber"
              ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
              : "border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)]",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: unknown }) {
  const value = String(status ?? "").toLowerCase();
  const good = ["active", "completed", "approved", "executed"].includes(value);
  const bad = ["suspended", "rejected", "cancelled", "removed", "failed"].includes(value);

  return (
    <span
      className={[
        "inline-flex w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize",
        good
          ? "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
          : bad
            ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
            : "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
      ].join(" ")}
    >
      {labelize(status)}
    </span>
  );
}

function Alert({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "danger" | "success";
}) {
  return (
    <div
      className={[
        "rounded-[1.25rem] border px-4 py-3 text-sm",
        tone === "danger"
          ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
          : "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function EmptyState({ text: label }: { text: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-8 text-center text-sm text-[color:var(--text-tertiary)]">
      {label}
    </div>
  );
}