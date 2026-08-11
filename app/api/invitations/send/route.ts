import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { emitEvent } from "@/lib/events/emitEvent";

type InviteRole = "admin" | "employee" | "investor";
type InviteMode = "send" | "resend";

function isInviteRole(value: string): value is InviteRole {
  return ["admin", "employee", "investor"].includes(value);
}

function roleLabel(role: InviteRole) {
  return role === "admin" ? "Admin" : role === "investor" ? "Investor" : "Employee";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mode = String(body.mode || "send") as InviteMode;
    const requestedCompanyId = String(body.companyId || "").trim();
    const invitedBy = String(body.invitedBy || "").trim();
    const invitationId = String(body.invitationId || "").trim();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== invitedBy) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, company_id, access_status")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin" || !profile.company_id || profile.access_status === "inactive" || profile.access_status === "suspended") {
      return NextResponse.json({ error: "Only active company admins can manage invitations." }, { status: 403 });
    }

    const companyId = profile.company_id;
    if (!requestedCompanyId || requestedCompanyId !== companyId) {
      return NextResponse.json({ error: "You cannot manage invitations for another company." }, { status: 403 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json({ error: "Supabase server configuration is missing." }, { status: 500 });
    }

    const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
    const origin = new URL(request.url).origin;
    const founderName = profile.full_name || profile.email || user.email || "Founder";

    if (mode === "resend") {
      if (!invitationId) return NextResponse.json({ error: "Invitation ID is required." }, { status: 400 });

      const { data: invite } = await supabase
        .from("invitations")
        .select("id, full_name, email, role, status, token, expires_at, resent_at, resend_count")
        .eq("id", invitationId)
        .eq("company_id", companyId)
        .single();

      if (!invite) return NextResponse.json({ error: "Invitation could not be found." }, { status: 404 });
      if (["accepted", "cancelled"].includes(invite.status)) {
        return NextResponse.json({ error: `A ${invite.status} invitation cannot be resent.` }, { status: 400 });
      }

      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
      const resentAt = new Date().toISOString();
      const previous = {
        token: invite.token,
        expires_at: invite.expires_at,
        resent_at: invite.resent_at,
        resend_count: Number(invite.resend_count || 0),
        status: invite.status,
      };

      const { error: updateError } = await supabase
        .from("invitations")
        .update({ token, expires_at: expiresAt, resent_at: resentAt, resend_count: previous.resend_count + 1, status: "pending" })
        .eq("id", invite.id)
        .eq("company_id", companyId);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

      const { error: emailError } = await admin.auth.admin.inviteUserByEmail(invite.email, {
        redirectTo: `${origin}/accept-invite?token=${token}`,
        data: { company_id: companyId, full_name: invite.full_name, role: invite.role },
      });

      if (emailError) {
        await supabase.from("invitations").update(previous).eq("id", invite.id).eq("company_id", companyId);
        await emitEvent({
          companyId,
          actorId: user.id,
          recipients: [user.id],
          type: "invitation_resend_failed",
          title: "Invitation resend failed",
          message: `The invitation for ${invite.full_name || invite.email} could not be resent.`,
          actionUrl: "/dashboard/team",
          referenceType: "invitation",
          referenceId: invite.id,
          severity: "error",
          metadata: { invitationId: invite.id, email: invite.email, role: invite.role, reason: emailError.message },
        });
        return NextResponse.json({ error: `Invitation email could not be resent: ${emailError.message}` }, { status: 500 });
      }

      await emitEvent({
        companyId,
        actorId: user.id,
        recipients: [user.id],
        type: "invitation_resent",
        title: "Invitation resent",
        message: `${invite.full_name || invite.email}'s ${invite.role} invitation was resent and extended for seven days.`,
        actionUrl: "/dashboard/team",
        referenceType: "invitation",
        referenceId: invite.id,
        severity: "success",
        metadata: { invitationId: invite.id, email: invite.email, role: invite.role, expiresAt, resentAt, resendCount: previous.resend_count + 1, invitedByName: founderName },
      });

      return NextResponse.json({ message: "Invitation resent successfully.", invitationId: invite.id });
    }

    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const requestedRole = String(body.role || "").trim();

    if (!fullName || !email || !isInviteRole(requestedRole)) {
      return NextResponse.json({ error: "Valid invitation details are required." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const { data: member } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("company_id", companyId)
      .ilike("email", email)
      .maybeSingle();
    if (member) {
      return NextResponse.json({ error: `${member.full_name || email} already belongs to this company as an ${member.role}.` }, { status: 409 });
    }

    const { data: pending } = await supabase
      .from("invitations")
      .select("id, expires_at")
      .eq("company_id", companyId)
      .ilike("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (pending) {
      const expired = pending.expires_at && new Date(pending.expires_at).getTime() < Date.now();
      if (!expired) return NextResponse.json({ error: "A pending invitation already exists. Use Resend in the invitation lifecycle table." }, { status: 409 });
      await supabase.from("invitations").update({ status: "expired" }).eq("id", pending.id).eq("company_id", companyId);
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
    const role = requestedRole;

    const { data: invite, error: insertError } = await supabase
      .from("invitations")
      .insert({ company_id: companyId, invited_by: user.id, full_name: fullName, email, role, status: "pending", token, expires_at: expiresAt })
      .select("id, status, created_at, expires_at")
      .single();

    if (insertError || !invite) return NextResponse.json({ error: insertError?.message || "Invitation record could not be created." }, { status: 500 });

    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/accept-invite?token=${token}`,
      data: { company_id: companyId, full_name: fullName, role },
    });

    if (inviteError) {
      await supabase.from("invitations").delete().eq("id", invite.id).eq("company_id", companyId);
      await emitEvent({
        companyId,
        actorId: user.id,
        recipients: [user.id],
        type: `${role}_invitation_failed`,
        title: `${roleLabel(role)} invitation failed`,
        message: `${roleLabel(role)} invitation for ${fullName} at ${email} could not be sent.`,
        actionUrl: "/dashboard/team",
        referenceType: "invitation",
        referenceId: invite.id,
        severity: "error",
        metadata: { invitationId: invite.id, fullName, email, role, reason: inviteError.message, invitationRecordRemoved: true },
      });
      return NextResponse.json({ error: `Invitation email could not be sent: ${inviteError.message}` }, { status: 500 });
    }

    await emitEvent({
      companyId,
      actorId: user.id,
      recipients: [user.id],
      type: `${role}_invitation_sent`,
      title: `${roleLabel(role)} invitation sent`,
      message: `${roleLabel(role)} invitation sent to ${fullName} at ${email}.`,
      actionUrl: "/dashboard/team",
      referenceType: "invitation",
      referenceId: invite.id,
      severity: "success",
      metadata: { invitationId: invite.id, fullName, email, role, status: invite.status, createdAt: invite.created_at, expiresAt: invite.expires_at, invitedByName: founderName },
    });

    return NextResponse.json({ message: `${roleLabel(role)} invitation email sent successfully.`, invitationId: invite.id });
  } catch (error) {
    console.error("Invitation request failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invitation could not be sent." }, { status: 500 });
  }
}