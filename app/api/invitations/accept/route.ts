import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emitEvent } from "@/lib/events/emitEvent";

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    const invitationToken = String(token || "").trim();

    if (!invitationToken) {
      return NextResponse.json({ error: "Invitation token missing." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Invite session not found." }, { status: 401 });
    }

    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .select("id, company_id, invited_by, full_name, email, role, status, expires_at, accepted_at")
      .eq("token", invitationToken)
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    if (invitation.status === "accepted") {
      return NextResponse.json({ error: "Invitation already accepted." }, { status: 400 });
    }

    if (invitation.status === "cancelled") {
      return NextResponse.json({ error: "This invitation was cancelled." }, { status: 400 });
    }

    const expired = !invitation.expires_at || new Date(invitation.expires_at).getTime() < Date.now();

    if (expired || invitation.status === "expired") {
      if (invitation.status !== "expired") {
        await supabase.from("invitations").update({ status: "expired" }).eq("id", invitation.id);
      }

      return NextResponse.json(
        { error: "This invitation has expired. Ask the company administrator to resend it." },
        { status: 410 }
      );
    }

    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        { error: "This invitation belongs to a different email address." },
        { status: 403 }
      );
    }

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, company_id, role, access_status")
      .eq("id", user.id)
      .maybeSingle();

    if (existingProfile?.company_id && existingProfile.company_id !== invitation.company_id) {
      return NextResponse.json(
        { error: "This account already belongs to another company workspace." },
        { status: 409 }
      );
    }

    const acceptedAt = new Date().toISOString();

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        full_name: invitation.full_name,
        email: invitation.email,
        company_id: invitation.company_id,
        role: invitation.role,
        access_status: "active",
      });

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const { error: updateInviteError } = await supabase
      .from("invitations")
      .update({ status: "accepted", accepted_at: acceptedAt })
      .eq("id", invitation.id)
      .eq("status", "pending");

    if (updateInviteError) {
      return NextResponse.json({ error: updateInviteError.message }, { status: 500 });
    }

    await emitEvent({
      companyId: invitation.company_id,
      actorId: user.id,
      type: "invitation_accepted",
      title: "Invitation accepted",
      message: `${invitation.full_name || invitation.email} accepted their ${invitation.role} invitation and joined the workspace.`,
      actionUrl: "/dashboard/team",
      referenceType: "invitation",
      referenceId: invitation.id,
      severity: "success",
      metadata: {
        invitationId: invitation.id,
        memberId: user.id,
        memberName: invitation.full_name,
        memberEmail: invitation.email,
        memberRole: invitation.role,
        acceptedAt,
        invitedBy: invitation.invited_by,
      },
      notifications: [
        {
          roles: ["admin"],
          title: "Team invitation accepted",
          message: `${invitation.full_name || invitation.email} joined as an ${invitation.role}.`,
          actionUrl: "/dashboard/team",
          excludeActor: true,
        },
        {
          recipientIds: [user.id],
          title: "Welcome to Helix",
          message: `Your ${invitation.role} access is now active.`,
          actionUrl:
            invitation.role === "investor"
              ? "/investor"
              : invitation.role === "employee"
                ? "/employee"
                : "/dashboard",
        },
      ],
    });

    return NextResponse.json({
      role: invitation.role,
      message: "Invitation accepted.",
    });
  } catch (error) {
    console.error("Invitation acceptance failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invitation could not be accepted." },
      { status: 500 }
    );
  }
}