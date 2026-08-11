"use client";

import { useMemo, useState } from "react";
import InviteUserForm from "@/components/team/InviteUserForm";

export type TeamMember = {
  department?: string | null;
  job_title?: string | null;
  jobTitle?: string | null;
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: "admin" | "employee" | "investor";
  company_id: string | null;
  access_status: string | null;
  created_at: string | null;
};

function teamMemberOrgText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return "";
}

function teamMemberDepartment(member: TeamMember): string {
  return teamMemberOrgText(member.department);
}

function teamMemberJobTitle(member: TeamMember): string {
  return teamMemberOrgText(member.job_title, member.jobTitle);
}

function TeamMemberOrganisationLine({ member }: { member: TeamMember }) {
  if (teamMemberOrgText(member.role).toLowerCase() !== "employee") return null;

  const department = teamMemberDepartment(member);
  const jobTitle = teamMemberJobTitle(member);

  return (
    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[color:var(--text-tertiary)]">
      <span>Department:</span>
      <span className="rounded-full border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-2 py-0.5 font-medium text-[color:var(--primary)]">
        {department || "Not set"}
      </span>
      <span className="text-[color:var(--text-muted)]">•</span>
      <span>Job title:</span>
      <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2 py-0.5 font-medium text-[color:var(--text-secondary)]">
        {jobTitle || "Not set"}
      </span>
    </p>
  );
}



export type TeamInvitation = {
  id: string;
  company_id: string;
  invited_by: string | null;
  full_name: string | null;
  email: string;
  role: "admin" | "employee" | "investor";
  status: string | null;
  token: string | null;
  expires_at: string | null;
  created_at: string | null;
  accepted_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  resent_at: string | null;
  resend_count: number | null;
};

type ServerAction = (formData: FormData) => Promise<void>;
type RoleFilter = "all" | "admin" | "employee" | "investor";
type StatusFilter = "all" | "active" | "suspended";
type InviteFilter = "all" | "pending" | "accepted" | "expired" | "cancelled";

type Props = {
  companyId: string;
  companyName: string;
  invitedBy: string;
  currentUserId: string;
  members: TeamMember[];
  invitations: TeamInvitation[];
  error?: string;
  success?: string;
  cancelInvitation: ServerAction;
  suspendMember: ServerAction;
  reactivateMember: ServerAction;
  changeMemberRole: ServerAction;
  sendMemberPasswordReset: ServerAction;
  removeMemberAccess: ServerAction;
};

export default function TeamClient(props: Props) {
  const {
    companyId,
    companyName,
    invitedBy,
    currentUserId,
    members,
    invitations,
    error,
    success,
    cancelInvitation,
    suspendMember,
    reactivateMember,
    changeMemberRole,
    sendMemberPasswordReset,
    removeMemberAccess,
  } = props;

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [inviteFilter, setInviteFilter] = useState<InviteFilter>("pending");
  const [invitationToCancel, setInvitationToCancel] =
    useState<TeamInvitation | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");
  const [localMessage, setLocalMessage] = useState("");

  const stats = useMemo(() => {
    const active = members.filter((member) => member.access_status === "active").length;
    return {
      total: members.length,
      active,
      employees: members.filter((member) => member.role === "employee").length,
      investors: members.filter((member) => member.role === "investor").length,
      pending: invitations.filter((invite) => invite.status === "pending").length,
    };
  }, [members, invitations]);

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((member) => {
      const text = `${member.full_name || ""} ${member.email || ""} ${member.phone || ""}`.toLowerCase();
      return (
        (!q || text.includes(q)) &&
        (roleFilter === "all" || member.role === roleFilter) &&
        (statusFilter === "all" || member.access_status === statusFilter)
      );
    });
  }, [members, query, roleFilter, statusFilter]);

  const filteredInvitations = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invitations.filter((invite) => {
      const text = `${invite.full_name || ""} ${invite.email}`.toLowerCase();
      return (!q || text.includes(q)) && (inviteFilter === "all" || invite.status === inviteFilter);
    });
  }, [invitations, query, inviteFilter]);

  async function resendInvitation(invitationId: string) {
    setResendingId(invitationId);
    setLocalError("");
    setLocalMessage("");

    try {
      const response = await fetch("/api/invitations/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "resend", invitationId, companyId, invitedBy }),
      });
      const result = await response.json();
      if (!response.ok) {
        setLocalError(result.error || "Invitation could not be resent.");
        return;
      }
      setLocalMessage(result.message || "Invitation resent successfully.");
      window.setTimeout(() => window.location.reload(), 450);
    } catch {
      setLocalError("Invitation could not be resent. Please try again.");
    } finally {
      setResendingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[color:var(--app-bg)] text-[color:var(--text-primary)]">
      <div className="mx-auto w-full max-w-[1680px] space-y-6 pb-16">
        <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Workforce command centre</p>
            </div>
            <h1 className="mt-3 text-[32px] font-semibold leading-none tracking-[-0.045em]">Team & Access</h1>
            <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[color:var(--text-tertiary)]">
              Manage {companyName}&apos;s administrators, employees, investors, invitations and workspace access from one secure control centre.
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--success-border)] bg-[color:var(--success-soft)] px-4 py-3 text-xs text-[color:var(--success)]">
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--success)]" />Access controls operational
          </div>
        </header>

        {(error || localError) && <Message tone="error" text={error || localError} />}
        {(success || localMessage) && <Message tone="success" text={success || localMessage} />}

        <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-5">
          <StatCard label="Team Members" value={stats.total} note={`${stats.active} active`} tone="cyan" />
          <StatCard label="Employees" value={stats.employees} note="Operational access" tone="blue" />
          <StatCard label="Investors" value={stats.investors} note="Financial visibility" tone="violet" />
          <StatCard label="Pending Invites" value={stats.pending} note="Awaiting acceptance" tone={stats.pending ? "amber" : "green"} />
          <StatCard label="Active Rate" value={stats.total ? `${Math.round((stats.active / stats.total) * 100)}%` : "0%"} note="Workspace availability" tone="green" />
        </section>

        <section className="grid gap-6 2xl:grid-cols-[420px_minmax(0,1fr)]">
          <InviteUserForm companyId={companyId} invitedBy={invitedBy} />

          <div className={panelClass}>
            <div className="border-b border-[color:var(--border)] p-5">
              <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
                <div>
                  <p className="text-sm font-semibold">Team Directory</p>
                  <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">Search, filter and control live workspace access.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or phone..." className="h-10 min-w-[260px] rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-xs text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--border-brand)]" />
                  <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as RoleFilter)} className={selectClass}>
                    <option value="all">All roles</option><option value="admin">Admins</option><option value="employee">Employees</option><option value="investor">Investors</option>
                  </select>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className={selectClass}>
                    <option value="all">All access</option><option value="active">Active</option><option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead className={theadClass}><tr><th className="px-5 py-4">Member</th><th className="px-5 py-4">Role</th><th className="px-5 py-4">Access</th><th className="px-5 py-4">Joined</th><th className="px-5 py-4 text-right">Controls</th></tr></thead>
                <tbody>
                  {filteredMembers.length ? filteredMembers.map((member) => (
                    <MemberRow key={member.id} member={member} current={member.id === currentUserId} suspendMember={suspendMember} reactivateMember={reactivateMember} changeMemberRole={changeMemberRole} sendMemberPasswordReset={sendMemberPasswordReset} removeMemberAccess={removeMemberAccess} />
                  )) : <EmptyRow cols={5} text="No team members match these filters." />}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className={panelClass}>
          <div className="flex flex-col justify-between gap-4 border-b border-[color:var(--border)] p-5 sm:flex-row sm:items-center">
            <div><p className="text-sm font-semibold">Invitation Lifecycle</p><p className="mt-1 text-xs text-[color:var(--text-tertiary)]">Track pending, accepted, expired and cancelled invitations.</p></div>
            <select value={inviteFilter} onChange={(e) => setInviteFilter(e.target.value as InviteFilter)} className={selectClass}>
              <option value="pending">Open invitations</option><option value="accepted">Accepted</option><option value="expired">Expired</option><option value="cancelled">Cancelled history</option><option value="all">Complete history</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead className={theadClass}><tr><th className="px-5 py-4">Invitation</th><th className="px-5 py-4">Role</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Expiry</th><th className="px-5 py-4">Delivery</th><th className="px-5 py-4 text-right">Controls</th></tr></thead>
              <tbody>
                {filteredInvitations.length ? filteredInvitations.map((invite) => (
                  <InvitationRow key={invite.id} invitation={invite} resending={resendingId === invite.id} onResend={() => resendInvitation(invite.id)} onCancel={() => setInvitationToCancel(invite)} />
                )) : <EmptyRow cols={6} text="No invitations match this filter." />}
              </tbody>
            </table>
          </div>
        </section>

        {invitationToCancel && (
          <CancelInvitationModal
            invitation={invitationToCancel}
            cancelInvitation={cancelInvitation}
            onClose={() => setInvitationToCancel(null)}
          />
        )}
      </div>
    </main>
  );
}

function MemberRow({ member, current, suspendMember, reactivateMember, changeMemberRole, sendMemberPasswordReset, removeMemberAccess }: { member: TeamMember; current: boolean; suspendMember: ServerAction; reactivateMember: ServerAction; changeMemberRole: ServerAction; sendMemberPasswordReset: ServerAction; removeMemberAccess: ServerAction }) {
  return (
    <tr className={rowClass}>
      <td className="px-5 py-4"><div className="flex items-center gap-3"><Avatar name={member.full_name || member.email || "U"} /><div><p className="text-sm font-medium text-[color:var(--text-primary)]">{member.full_name || "Unnamed member"}{current && <span className="ml-2 text-[9px] uppercase tracking-[0.1em] text-[color:var(--primary)]">You</span>}</p><p className="mt-1 text-xs text-[color:var(--text-tertiary)]">{member.email || "No email"}</p>
                          <TeamMemberOrganisationLine member={member} /></div></div></td>
      <td className="px-5 py-4"><RoleBadge role={member.role} /></td>
      <td className="px-5 py-4"><StatusBadge status={member.access_status || "active"} /></td>
      <td className="px-5 py-4 text-xs text-[color:var(--text-tertiary)]">{formatDate(member.created_at)}</td>
      <td className="px-5 py-4">
        {current ? <p className="text-right text-xs text-[color:var(--text-muted)]">Protected account</p> : (
          <div className="flex justify-end gap-2">
            <form action={changeMemberRole}><input type="hidden" name="member_id" value={member.id} /><select name="role" defaultValue={member.role} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="h-9 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2 text-[10px] text-[color:var(--text-secondary)] outline-none"><option value="admin">Admin</option><option value="employee">Employee</option><option value="investor">Investor</option></select></form>
            <ActionForm action={sendMemberPasswordReset} memberId={member.id} label="Reset" className={secondaryButton} />
            {member.access_status === "suspended" ? <ActionForm action={reactivateMember} memberId={member.id} label="Reactivate" className={successButton} /> : <ActionForm action={suspendMember} memberId={member.id} label="Suspend" className={warningButton} />}
            <form action={removeMemberAccess} onSubmit={(e) => { if (!window.confirm(`Remove ${member.full_name || member.email} from this Helix workspace?`)) e.preventDefault(); }}><input type="hidden" name="member_id" value={member.id} /><button className={dangerButton}>Remove</button></form>
          </div>
        )}
      </td>
    </tr>
  );
}

function InvitationRow({
  invitation,
  resending,
  onResend,
  onCancel,
}: {
  invitation: TeamInvitation;
  resending: boolean;
  onResend: () => void;
  onCancel: () => void;
}) {
  const canResend =
    invitation.status === "pending" ||
    invitation.status === "expired";

  return (
    <tr className={rowClass}>
      <td className="px-5 py-4">
        <p className="text-sm font-medium text-[color:var(--text-primary)]">
          {invitation.full_name || "Unnamed invitee"}
        </p>
        <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
          {invitation.email}
        </p>
      </td>

      <td className="px-5 py-4">
        <RoleBadge role={invitation.role} />
      </td>

      <td className="px-5 py-4">
        <StatusBadge status={invitation.status || "pending"} />
      </td>

      <td className="px-5 py-4 text-xs text-[color:var(--text-tertiary)]">
        {formatDateTime(invitation.expires_at)}
      </td>

      <td className="px-5 py-4">
        <p className="text-xs text-[color:var(--text-secondary)]">
          {invitation.resend_count || 0} resends
        </p>
        <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">
          Sent {formatDate(invitation.created_at)}
        </p>
      </td>

      <td className="px-5 py-4">
        <div className="flex justify-end gap-2">
          {canResend && (
            <button
              type="button"
              onClick={onResend}
              disabled={resending}
              className={secondaryButton}
            >
              {resending ? "Sending..." : "Resend"}
            </button>
          )}

          {invitation.status === "pending" && (
            <button
              type="button"
              onClick={onCancel}
              className={dangerButton}
            >
              Cancel
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function CancelInvitationModal({
  invitation,
  cancelInvitation,
  onClose,
}: {
  invitation: TeamInvitation;
  cancelInvitation: ServerAction;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[color:var(--overlay-strong)] px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-invitation-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[color:var(--danger-border)] bg-[image:var(--gradient-panel)] shadow-[var(--shadow-card)]">
        <div className="border-b border-[color:var(--border)] px-6 py-5">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-lg text-[color:var(--danger)]">
              !
            </span>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--danger)]">
                Confirm cancellation
              </p>
              <h2
                id="cancel-invitation-title"
                className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]"
              >
                Cancel this invitation?
              </h2>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
            The invitation for{" "}
            <span className="font-medium text-[color:var(--text-primary)]">
              {invitation.full_name || invitation.email}
            </span>{" "}
            at{" "}
            <span className="font-medium text-[color:var(--primary)]">
              {invitation.email}
            </span>{" "}
            will stop working immediately.
          </p>

          <div className="mt-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-[color:var(--text-tertiary)]">Role</span>
              <RoleBadge role={invitation.role} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="text-xs text-[color:var(--text-tertiary)]">Current status</span>
              <StatusBadge status={invitation.status || "pending"} />
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-[color:var(--text-muted)]">
            The cancelled record remains available under
            <span className="text-[color:var(--text-secondary)]"> Cancelled history </span>
            for audit purposes, but it disappears from the default
            Open invitations view.
          </p>
        </div>

        <div className="flex justify-end gap-3 border-t border-[color:var(--border)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-xs font-medium text-[color:var(--text-secondary)] transition hover:border-[color:var(--border)] hover:text-[color:var(--text-primary)]"
          >
            Keep Invitation
          </button>

          <form action={cancelInvitation}>
            <input
              type="hidden"
              name="invitation_id"
              value={invitation.id}
            />
            <button
              type="submit"
              className="h-10 rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-4 text-xs font-semibold text-[color:var(--danger)] transition hover:bg-[color:var(--danger-soft)]"
            >
              Cancel Invitation
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ActionForm({ action, memberId, label, className }: { action: ServerAction; memberId: string; label: string; className: string }) { return <form action={action}><input type="hidden" name="member_id" value={memberId} /><button className={className}>{label}</button></form>; }
function EmptyRow({ cols, text }: { cols: number; text: string }) { return <tr><td colSpan={cols} className="px-5 py-16 text-center text-sm text-[color:var(--text-tertiary)]">{text}</td></tr>; }
function Avatar({ name }: { name: string }) { const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase(); return <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-xs font-semibold text-[color:var(--primary)]">{initials || "U"}</span>; }
function RoleBadge({ role }: { role: string }) { const style = role === "admin" ? "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]" : role === "investor" ? "border-[color:var(--violet-border)] bg-[color:var(--violet-soft)] text-[color:var(--chart-5)]" : "border-[color:var(--secondary-border)] bg-[color:var(--secondary-soft)] text-[color:var(--secondary)]"; return <span className={`inline-flex rounded-full border px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.09em] ${style}`}>{role}</span>; }
function StatusBadge({ status }: { status: string }) { const style = status === "active" || status === "accepted" ? "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]" : status === "pending" ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]" : status === "suspended" || status === "expired" || status === "cancelled" ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]" : "border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)]"; return <span className={`inline-flex rounded-full border px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.09em] ${style}`}>{status.replaceAll("_", " ")}</span>; }
function Message({ tone, text }: { tone: "success" | "error"; text: string }) { return <div className={`rounded-xl border px-4 py-3 text-sm ${tone === "success" ? "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]" : "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]"}`}>{text}</div>; }
function StatCard({ label, value, note, tone }: { label: string; value: string | number; note: string; tone: "cyan" | "blue" | "violet" | "amber" | "green" }) { const colors = { cyan: "text-[color:var(--primary)] border-[color:var(--border-brand)]", blue: "text-[color:var(--secondary)] border-[color:var(--secondary-border)]", violet: "text-[color:var(--chart-5)] border-[color:var(--violet-border)]", amber: "text-[color:var(--warning)] border-[color:var(--warning-border)]", green: "text-[color:var(--success)] border-[color:var(--success-border)]" }; return <div className={`rounded-2xl border bg-[image:var(--gradient-card)] p-5 ${colors[tone]}`}><p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">{label}</p><p className="mt-3 text-2xl font-semibold text-[color:var(--text-primary)]">{value}</p><p className={`mt-2 text-xs ${colors[tone].split(" ")[0]}`}>{note}</p></div>; }
function formatDate(value: string | null) { return value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"; }
function formatDateTime(value: string | null) { return value ? new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }

const panelClass = "rounded-2xl border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]";
const selectClass = "h-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs text-[color:var(--text-secondary)] outline-none";
const theadClass = "bg-[color:var(--surface-soft)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-muted)]";
const rowClass = "border-t border-[color:var(--border)] transition hover:bg-[color:var(--surface-soft)]";
const secondaryButton = "h-9 rounded-lg border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-3 text-[10px] font-medium text-[color:var(--primary)] transition hover:bg-[color:var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-40";
const successButton = "h-9 rounded-lg border border-[color:var(--success-border)] bg-[color:var(--success-soft)] px-3 text-[10px] font-medium text-[color:var(--success)] transition hover:bg-[color:var(--success-soft)]";
const warningButton = "h-9 rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-3 text-[10px] font-medium text-[color:var(--warning)] transition hover:bg-[color:var(--warning-soft)]";
const dangerButton = "h-9 rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-3 text-[10px] font-medium text-[color:var(--danger)] transition hover:bg-[color:var(--danger-soft)]";