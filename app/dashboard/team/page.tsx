import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { emitEvent } from "@/lib/events/emitEvent";
import { getUserNotifications } from "@/lib/notifications/server";
import { createClient } from "@/lib/supabase/server";
import TeamClient, { type TeamInvitation, type TeamMember } from "./TeamClient";



import EmployeeOrganisationPanel from "./EmployeeOrganisationPanel";


type HelixWorkforceOrgPerson = Record<string, unknown>;

function helixWorkforceOrgText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return "";
}

async function HelixWorkforceOrgLine({
  person,
  compact = false,
}: {
  person: HelixWorkforceOrgPerson;
  compact?: boolean;
}) {
  let department = helixWorkforceOrgText(person.department);
  let jobTitle = helixWorkforceOrgText(person.job_title, person.jobTitle);

  const userId = helixWorkforceOrgText(person.id, person.user_id, person.userId);
  const email = helixWorkforceOrgText(person.email);

  if ((!department || !jobTitle) && (userId || email)) {
    const supabase = await createClient();

    let profileRow: HelixWorkforceOrgPerson | null = null;

    if (userId) {
      const { data } = await supabase
        .from("profiles")
        .select("department, job_title")
        .eq("id", userId)
        .maybeSingle();

      profileRow = (data || null) as HelixWorkforceOrgPerson | null;
    }

    if ((!profileRow || (!profileRow.department && !profileRow.job_title)) && email) {
      const { data } = await supabase
        .from("profiles")
        .select("department, job_title")
        .eq("email", email)
        .maybeSingle();

      profileRow = (data || profileRow || null) as HelixWorkforceOrgPerson | null;
    }

    department = department || helixWorkforceOrgText(profileRow?.department);
    jobTitle = jobTitle || helixWorkforceOrgText(profileRow?.job_title, profileRow?.jobTitle);
  }

  if (!department && !jobTitle) return null;

  if (compact) {
    return (
      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[color:var(--text-tertiary)]">
        <span>{department || "No department"}</span>
        <span className="text-[color:var(--text-muted)]">{"•"}</span>
        <span>{jobTitle || "No job title"}</span>
      </p>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[color:var(--text-tertiary)]">
      <span className="rounded-full border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-2 py-0.5 font-medium text-[color:var(--primary)]">
        Department: {department || "Not set"}
      </span>
      <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2 py-0.5 font-medium text-[color:var(--text-secondary)]">
        Job title: {jobTitle || "Not set"}
      </span>
    </div>
  );
}


type HelixTaskLike = Record<string, unknown>;

function helixTaskTextValue(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return value ? "true" : "false";
  }

  return "";
}

function helixNormalizeTaskStatus(value: unknown): string {
  return helixTaskTextValue(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();
}

function helixStatusIsCompleted(value: unknown): boolean {
  return [
    "completed",
    "complete",
    "done",
    "finished",
    "closed",
    "resolved",
  ].includes(helixNormalizeTaskStatus(value));
}

function helixStatusIsInProgress(value: unknown): boolean {
  return [
    "in progress",
    "progress",
    "working",
    "started",
    "active",
    "doing",
  ].includes(helixNormalizeTaskStatus(value));
}

function helixStatusIsTodo(value: unknown): boolean {
  const status = helixNormalizeTaskStatus(value);

  return [
    "",
    "todo",
    "to do",
    "not started",
    "new",
    "assigned",
    "pending",
    "open",
  ].includes(status);
}

function helixTaskIsCompleted(task: HelixTaskLike): boolean {
  return (
    helixStatusIsCompleted(task.status) ||
    helixStatusIsCompleted(task.task_status) ||
    helixStatusIsCompleted(task.progress_status) ||
    helixStatusIsCompleted(task.state) ||
    task.completed === true ||
    task.is_completed === true ||
    task.done === true ||
    task.finished === true ||
    Boolean(task.completed_at) ||
    Boolean(task.completedAt)
  );
}

function helixTaskIsInProgress(task: HelixTaskLike): boolean {
  return (
    helixStatusIsInProgress(task.status) ||
    helixStatusIsInProgress(task.task_status) ||
    helixStatusIsInProgress(task.progress_status) ||
    helixStatusIsInProgress(task.state)
  );
}

function helixTaskIsTodo(task: HelixTaskLike): boolean {
  if (helixTaskIsCompleted(task) || helixTaskIsInProgress(task)) return false;

  return (
    helixStatusIsTodo(task.status) ||
    helixStatusIsTodo(task.task_status) ||
    helixStatusIsTodo(task.progress_status) ||
    helixStatusIsTodo(task.state)
  );
}


type SearchParams = { error?: string; success?: string };
type Action = (formData: FormData) => Promise<void>;

function clean(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function go(type: "error" | "success", message: string): never {
  redirect(`/dashboard/team?${type}=${encodeURIComponent(message)}`);
}

async function getAdminContext() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/admin/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, company_id, access_status")
    .eq("id", user.id)
    .single();

  if (
    error ||
    !profile ||
    profile.role !== "admin" ||
    !profile.company_id ||
    profile.access_status === "inactive" ||
    profile.access_status === "suspended"
  ) redirect("/admin/login");

  return { supabase, user, profile, companyId: profile.company_id };
}

function refreshAll() {
  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");
  revalidatePath("/employee");
  revalidatePath("/investor");
}

async function cancelInvitation(formData: FormData) {
  "use server";
  const { supabase, user, profile, companyId } = await getAdminContext();
  const invitationId = clean(formData.get("invitation_id"));
  if (!invitationId) go("error", "Invitation ID is missing.");

  const { data: invitation } = await supabase
    .from("invitations")
    .select("id, full_name, email, role, status")
    .eq("id", invitationId)
    .eq("company_id", companyId)
    .single();

  if (!invitation) go("error", "Invitation could not be found.");
  if (invitation.status !== "pending") go("error", "Only pending invitations can be cancelled.");

  const cancelledAt = new Date().toISOString();
  const { error } = await supabase
    .from("invitations")
    .update({ status: "cancelled", cancelled_at: cancelledAt, cancelled_by: user.id })
    .eq("id", invitation.id)
    .eq("company_id", companyId)
    .eq("status", "pending");

  if (error) go("error", error.message);

  await emitEvent({
    companyId,
    actorId: user.id,
    recipients: [user.id],
    type: "invitation_cancelled",
    title: "Invitation cancelled",
    message: `${invitation.full_name || invitation.email}'s ${invitation.role} invitation was cancelled.`,
    actionUrl: "/dashboard/team",
    referenceType: "invitation",
    referenceId: invitation.id,
    severity: "warning",
    metadata: { invitationId: invitation.id, email: invitation.email, role: invitation.role, cancelledAt, cancelledByName: profile.full_name || profile.email },
  });

  refreshAll();
  go("success", "Invitation cancelled successfully.");
}

async function suspendMember(formData: FormData) {
  "use server";
  const { supabase, user, companyId } = await getAdminContext();
  const memberId = clean(formData.get("member_id"));
  if (!memberId) go("error", "Member ID is missing.");
  if (memberId === user.id) go("error", "You cannot suspend your own administrator account.");

  const { data: member } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, access_status, department, job_title")
    .eq("id", memberId)
    .eq("company_id", companyId)
    .single();
  if (!member) go("error", "Team member could not be found.");
  if (member.access_status === "suspended") go("error", "This member is already suspended.");

  const { error } = await supabase.from("profiles").update({ access_status: "suspended" }).eq("id", memberId).eq("company_id", companyId);
  if (error) go("error", error.message);

  await emitEvent({
    companyId,
    actorId: user.id,
    type: "team_member_suspended",
    title: "Team member suspended",
    message: `${member.full_name || member.email || "Team member"}'s ${member.role} access was suspended.`,
    actionUrl: "/dashboard/team",
    referenceType: "profile",
    referenceId: member.id,
    severity: "warning",
    metadata: { memberId: member.id, memberName: member.full_name, memberEmail: member.email, memberRole: member.role, previousAccessStatus: member.access_status, newAccessStatus: "suspended" },
    notifications: [
      { recipientIds: [user.id], title: "Team member suspended", message: `${member.full_name || member.email || "Team member"} was suspended.`, actionUrl: "/dashboard/team" },
      { recipientIds: [member.id], title: "Your Helix access was suspended", message: "Your company administrator suspended your workspace access.", actionUrl: "/login" },
    ],
  });

  refreshAll();
  go("success", "Team member suspended successfully.");
}

async function reactivateMember(formData: FormData) {
  "use server";
  const { supabase, user, companyId } = await getAdminContext();
  const memberId = clean(formData.get("member_id"));
  if (!memberId) go("error", "Member ID is missing.");

  const { data: member } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, access_status, department, job_title")
    .eq("id", memberId)
    .eq("company_id", companyId)
    .single();
  if (!member) go("error", "Team member could not be found.");

  const { error } = await supabase.from("profiles").update({ access_status: "active" }).eq("id", memberId).eq("company_id", companyId);
  if (error) go("error", error.message);

  await emitEvent({
    companyId,
    actorId: user.id,
    type: "team_member_reactivated",
    title: "Team member reactivated",
    message: `${member.full_name || member.email || "Team member"}'s ${member.role} access was restored.`,
    actionUrl: "/dashboard/team",
    referenceType: "profile",
    referenceId: member.id,
    severity: "success",
    metadata: { memberId: member.id, memberName: member.full_name, memberEmail: member.email, memberRole: member.role, previousAccessStatus: member.access_status, newAccessStatus: "active" },
    notifications: [
      { recipientIds: [user.id], title: "Team member reactivated", message: `${member.full_name || member.email || "Team member"} was reactivated.`, actionUrl: "/dashboard/team" },
      { recipientIds: [member.id], title: "Your Helix access was restored", message: "Your company administrator restored your workspace access.", actionUrl: member.role === "investor" ? "/investor" : member.role === "employee" ? "/employee" : "/dashboard" },
    ],
  });

  refreshAll();
  go("success", "Team member reactivated successfully.");
}

async function changeMemberRole(formData: FormData) {
  "use server";
  const { supabase, user, companyId } = await getAdminContext();
  const memberId = clean(formData.get("member_id"));
  const role = clean(formData.get("role"));
  if (!memberId || !role || !["admin", "employee", "investor"].includes(role)) go("error", "A valid member and role are required.");
  if (memberId === user.id) go("error", "You cannot change your own administrator role.");

  const { data: member } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, access_status, department, job_title")
    .eq("id", memberId)
    .eq("company_id", companyId)
    .single();
  if (!member) go("error", "Team member could not be found.");
  if (member.role === role) go("error", `This member is already an ${role}.`);

  const { error } = await supabase.from("profiles").update({ role }).eq("id", memberId).eq("company_id", companyId);
  if (error) go("error", error.message);

  await emitEvent({
    companyId,
    actorId: user.id,
    type: "team_member_role_changed",
    title: "Team role changed",
    message: `${member.full_name || member.email || "Team member"} changed from ${member.role} to ${role}.`,
    actionUrl: "/dashboard/team",
    referenceType: "profile",
    referenceId: member.id,
    severity: "info",
    metadata: { memberId: member.id, memberName: member.full_name, memberEmail: member.email, previousRole: member.role, newRole: role, accessStatus: member.access_status },
    notifications: [
      { recipientIds: [user.id], title: "Team role changed", message: `${member.full_name || member.email || "Team member"} is now an ${role}.`, actionUrl: "/dashboard/team" },
      { recipientIds: [member.id], title: "Your Helix role changed", message: `Your role changed from ${member.role} to ${role}.`, actionUrl: role === "investor" ? "/investor" : role === "employee" ? "/employee" : "/dashboard" },
    ],
  });

  refreshAll();
  go("success", "Team member role updated successfully.");
}

async function sendMemberPasswordReset(formData: FormData) {
  "use server";
  const { supabase, user, companyId } = await getAdminContext();
  const memberId = clean(formData.get("member_id"));
  if (!memberId) go("error", "Member ID is missing.");

  const { data: member } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, department, job_title")
    .eq("id", memberId)
    .eq("company_id", companyId)
    .single();
  if (!member?.email) go("error", "A valid member email could not be found.");

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(member.email, { redirectTo });
  if (error) go("error", error.message);

  await emitEvent({
    companyId,
    actorId: user.id,
    recipients: [user.id, member.id],
    type: "team_password_reset_sent",
    title: "Password reset sent",
    message: `A password reset email was sent to ${member.full_name || member.email}.`,
    actionUrl: "/dashboard/team",
    referenceType: "profile",
    referenceId: member.id,
    severity: "success",
    metadata: { memberId: member.id, memberName: member.full_name, memberEmail: member.email, memberRole: member.role, redirectTo },
  });

  refreshAll();
  go("success", "Password reset email sent successfully.");
}

async function removeMemberAccess(formData: FormData) {
  "use server";
  const { supabase, user, companyId } = await getAdminContext();
  const memberId = clean(formData.get("member_id"));
  if (!memberId) go("error", "Member ID is missing.");
  if (memberId === user.id) go("error", "You cannot remove your own company access.");

  const { data: member } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, access_status, department, job_title")
    .eq("id", memberId)
    .eq("company_id", companyId)
    .single();
  if (!member) go("error", "Team member could not be found.");

  const { error } = await supabase
    .from("profiles")
    .update({ company_id: null, access_status: "removed" })
    .eq("id", memberId)
    .eq("company_id", companyId);
  if (error) go("error", error.message);

  await emitEvent({
    companyId,
    actorId: user.id,
    type: "team_member_access_removed",
    title: "Team access removed",
    message: `${member.full_name || member.email || "Team member"} was removed from the company workspace.`,
    actionUrl: "/dashboard/team",
    referenceType: "profile",
    referenceId: member.id,
    severity: "warning",
    metadata: { memberId: member.id, memberName: member.full_name, memberEmail: member.email, previousRole: member.role, previousAccessStatus: member.access_status, newAccessStatus: "removed" },
    notifications: [
      { recipientIds: [user.id], title: "Team access removed", message: `${member.full_name || member.email || "Team member"} was removed from the company workspace.`, actionUrl: "/dashboard/team" },
      { recipientIds: [member.id], title: "Your company access was removed", message: "Your company administrator removed your access to this Helix workspace.", actionUrl: "/login" },
    ],
  });

  refreshAll();
  go("success", "Company access removed successfully.");
}

export default async function TeamPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = (await searchParams) ?? {};
  const { supabase, user, profile, companyId } = await getAdminContext();

  await supabase
    .from("invitations")
    .update({ status: "expired" })
    .eq("company_id", companyId)
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());

  const [
    { data: company },
    { data: members, error: memberError },
    { data: invitations, error: invitationError },
    notifications,
  ] = await Promise.all([
    supabase.from("companies").select("id, name").eq("id", companyId).single(),
    supabase
      .from("profiles")
      .select("id, full_name, email, phone, role, company_id, access_status, created_at, department, job_title")
      .eq("company_id", companyId)
      .in("role", ["admin", "employee", "investor"])
      .order("created_at", { ascending: true }),
    supabase
      .from("invitations")
      .select("id, company_id, invited_by, full_name, email, role, status, token, expires_at, created_at, accepted_at, cancelled_at, cancelled_by, resent_at, resend_count")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    getUserNotifications(user.id),
  ]);

  return (
    <AdminShell
      title="Team"
      adminName={profile.full_name || profile.email || user.email || "Founder"}
      adminRole="Founder"
      showPageHeader={false}
      notifications={notifications ?? []}
      userId={user.id}
    >
      <TeamClient
        companyId={companyId}
        companyName={company?.name || "Company"}
        invitedBy={user.id}
        currentUserId={user.id}
        members={(members ?? []) as TeamMember[]}
        invitations={(invitations ?? []) as TeamInvitation[]}
        error={params.error || memberError?.message || invitationError?.message}
        success={params.success}
        cancelInvitation={cancelInvitation as Action}
        suspendMember={suspendMember as Action}
        reactivateMember={reactivateMember as Action}
        changeMemberRole={changeMemberRole as Action}
        sendMemberPasswordReset={sendMemberPasswordReset as Action}
        removeMemberAccess={removeMemberAccess as Action}
      />
    <EmployeeOrganisationPanel />

    </AdminShell>
  );
}