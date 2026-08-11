import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserNotifications } from "@/lib/notifications/server";
import { emitEvent } from "@/lib/events/emitEvent";
import { getInvestorEquityReadModel } from "@/lib/actions/investor-equity";
import AdminInvestorsClient from "./AdminInvestorsClient";

export type AdminInvestor = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  company_id: string | null;
  created_at: string | null;
  access_status: string | null;
};

export type AdminInvestorNote = {
  id: string;
  investor_id: string;
  notes: string | null;
};

export type AdminSharedDocument = {
  id: string;
  visibility: string;
  created_at: string | null;
};

export type AdminDocumentView = {
  id: string;
  document_id: string;
  investor_id: string;
  viewed_at: string | null;
};

export type AdminInvestorActivity = {
  id: string;
  investor_id: string | null;
  type: string;
  title: string;
  description: string | null;
  created_at: string | null;
};

type InvestorSummary = {
  id: string;
  full_name: string | null;
  email: string | null;
  access_status: string | null;
};

function getInvestorName(investor: {
  full_name?: string | null;
  email?: string | null;
}) {
  return investor.full_name || investor.email || "Investor";
}

async function getAdminContext() {
  const supabase = await createClient();
  const client = supabase as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: profile } = await client
    .from("profiles")
    .select("id, full_name, role, company_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || !profile.company_id) {
    redirect("/admin/login");
  }

  return { supabase, client, user, profile };
}

async function getInvestor(
  client: any,
  companyId: string,
  investorId: string,
): Promise<InvestorSummary | null> {
  const { data: investor } = await client
    .from("profiles")
    .select("id, full_name, email, access_status")
    .eq("id", investorId)
    .eq("company_id", companyId)
    .eq("role", "investor")
    .single();

  return (investor as InvestorSummary | null) || null;
}

function revalidateInvestorPages() {
  revalidatePath("/dashboard/investors");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");
  revalidatePath("/investor");
  revalidatePath("/investor/investments");
  revalidatePath("/investor/profile");
}

async function saveInvestorNote(formData: FormData) {
  "use server";

  const { client, profile, user } = await getAdminContext();

  const investorId = String(formData.get("investor_id") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!investorId) {
    redirect("/dashboard/investors?error=Investor not found.");
  }

  const investor = await getInvestor(client, profile.company_id, investorId);

  if (!investor) {
    redirect("/dashboard/investors?error=Investor not found.");
  }

  const { data: existingNote } = await client
    .from("investor_notes")
    .select("notes")
    .eq("company_id", profile.company_id)
    .eq("investor_id", investorId)
    .maybeSingle();

  const previousNotes = existingNote?.notes || "";

  const { error } = await client.from("investor_notes").upsert(
    {
      company_id: profile.company_id,
      investor_id: investorId,
      notes,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "company_id,investor_id",
    },
  );

  if (error) {
    redirect(`/dashboard/investors?error=${encodeURIComponent(error.message)}`);
  }

  const investorName = getInvestorName(investor);
  const changeDescription =
    previousNotes === notes
      ? "Private investor note was saved with no visible changes."
      : notes
        ? "Private investor note was saved."
        : "Private investor note was cleared.";

  await client.from("investor_activity").insert({
    company_id: profile.company_id,
    investor_id: investorId,
    type: "note_saved",
    title: "Admin note updated",
    description: changeDescription,
  });

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id],
    type: "investor_note_updated",
    title: "Investor note updated",
    message: `${changeDescription} Investor: ${investorName}.`,
    actionUrl: "/dashboard/investors",
    metadata: {
      investorId,
      investorName,
      previousNotes,
      updatedNotes: notes,
    },
  });

  revalidateInvestorPages();

  redirect("/dashboard/investors?success=Investor note saved.");
}

async function changeInvestorAccess(
  formData: FormData,
  nextStatus: "active" | "suspended",
) {
  const { client, profile, user } = await getAdminContext();
  const investorId = String(formData.get("investor_id") || "").trim();

  if (!investorId) {
    redirect("/dashboard/investors?error=Investor not found.");
  }

  const investor = await getInvestor(client, profile.company_id, investorId);

  if (!investor) {
    redirect("/dashboard/investors?error=Investor not found.");
  }

  const previousStatus = investor.access_status || "active";

  const { error } = await client
    .from("profiles")
    .update({
      access_status: nextStatus,
    })
    .eq("id", investorId)
    .eq("company_id", profile.company_id)
    .eq("role", "investor");

  if (error) {
    redirect(`/dashboard/investors?error=${encodeURIComponent(error.message)}`);
  }

  const investorName = getInvestorName(investor);
  const title =
    nextStatus === "active"
      ? "Investor access restored"
      : "Investor access suspended";

  await client.from("investor_activity").insert({
    company_id: profile.company_id,
    investor_id: investorId,
    type: nextStatus === "active" ? "access_reactivated" : "access_suspended",
    title,
    description: `${investorName}'s investor access changed from ${previousStatus} to ${nextStatus}.`,
  });

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id, investorId],
    type:
      nextStatus === "active"
        ? "investor_access_reactivated"
        : "investor_access_suspended",
    title,
    message: `${investorName}'s investor access changed from ${previousStatus} to ${nextStatus}.`,
    actionUrl: "/dashboard/investors",
    metadata: {
      investorId,
      investorName,
      previousAccessStatus: previousStatus,
      newAccessStatus: nextStatus,
    },
  });

  revalidateInvestorPages();

  redirect(
    nextStatus === "active"
      ? "/dashboard/investors?success=Investor reactivated."
      : "/dashboard/investors?success=Investor suspended.",
  );
}

async function suspendInvestor(formData: FormData) {
  "use server";

  await changeInvestorAccess(formData, "suspended");
}

async function reactivateInvestor(formData: FormData) {
  "use server";

  await changeInvestorAccess(formData, "active");
}

async function removeInvestorAccess(formData: FormData) {
  "use server";

  const { client, profile, user } = await getAdminContext();
  const investorId = String(formData.get("investor_id") || "").trim();

  if (!investorId) {
    redirect("/dashboard/investors?error=Investor not found.");
  }

  const investor = await getInvestor(client, profile.company_id, investorId);

  if (!investor) {
    redirect("/dashboard/investors?error=Investor not found.");
  }

  const previousStatus = investor.access_status || "active";
  const investorName = getInvestorName(investor);

  const { error } = await client
    .from("profiles")
    .update({
      role: null,
      company_id: null,
      access_status: "removed",
    })
    .eq("id", investorId)
    .eq("company_id", profile.company_id)
    .eq("role", "investor");

  if (error) {
    redirect(`/dashboard/investors?error=${encodeURIComponent(error.message)}`);
  }

  await client.from("investor_activity").insert({
    company_id: profile.company_id,
    investor_id: investorId,
    type: "access_removed",
    title: "Investor access removed",
    description: `${investorName}'s investor access was removed.`,
  });

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id, investorId],
    type: "investor_access_removed",
    title: "Investor access removed",
    message: `${investorName}'s investor access was removed. Previous status: ${previousStatus}.`,
    actionUrl: "/dashboard/investors",
    metadata: {
      investorId,
      investorName,
      previousAccessStatus: previousStatus,
      newAccessStatus: "removed",
    },
  });

  revalidateInvestorPages();

  redirect("/dashboard/investors?success=Investor access removed.");
}

async function sendInvestorPasswordReset(formData: FormData) {
  "use server";

  const { supabase, client, profile, user } = await getAdminContext();
  const investorId = String(formData.get("investor_id") || "").trim();

  if (!investorId) {
    redirect("/dashboard/investors?error=Investor not found.");
  }

  const investor = await getInvestor(client, profile.company_id, investorId);

  if (!investor?.email) {
    redirect("/dashboard/investors?error=Investor email not found.");
  }

  const investorName = getInvestorName(investor);

  const { error } = await supabase.auth.resetPasswordForEmail(investor.email, {
    redirectTo: `${
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    }/reset-password`,
  });

  if (error) {
    redirect(`/dashboard/investors?error=${encodeURIComponent(error.message)}`);
  }

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id, investorId],
    type: "investor_password_reset_sent",
    title: "Investor password reset sent",
    message: `A password reset email was sent to ${investorName}.`,
    actionUrl: "/dashboard/investors",
    metadata: {
      investorId,
      investorName,
      investorEmail: investor.email,
    },
  });

  revalidateInvestorPages();

  redirect("/dashboard/investors?success=Investor password reset email sent.");
}

export default async function AdminInvestorsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
}) {
  const params = await searchParams;
  const { client, profile, user } = await getAdminContext();

  const { data: investors, error: investorsError } = await client
    .from("profiles")
    .select("id, full_name, email, phone, role, company_id, created_at, access_status")
    .eq("company_id", profile.company_id)
    .eq("role", "investor")
    .order("full_name", { ascending: true });

  if (investorsError) {
    redirect(
      `/dashboard/investors?error=${encodeURIComponent(investorsError.message)}`,
    );
  }

  const [
    { data: company },
    { data: notes },
    { data: documents },
    { data: documentViews },
    { data: activity },
    notifications,
  ] = await Promise.all([
    client
      .from("companies")
      .select("currency")
      .eq("id", profile.company_id)
      .single(),

    client
      .from("investor_notes")
      .select("id, investor_id, notes")
      .eq("company_id", profile.company_id),

    client
      .from("company_documents")
      .select("id, visibility, created_at")
      .eq("company_id", profile.company_id)
      .eq("visibility", "investors"),

    client
      .from("document_views")
      .select("id, document_id, investor_id, viewed_at")
      .eq("company_id", profile.company_id),

    client
      .from("investor_activity")
      .select("id, investor_id, type, title, description, created_at")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false }),

    getUserNotifications(user.id),
  ]);

  const companyCurrency = company?.currency || "USD";
  const investorEquityResult = await getInvestorEquityReadModel(
    profile.company_id,
    companyCurrency,
  );

  return (
    <AdminInvestorsClient
      investors={(investors || []) as AdminInvestor[]}
      notes={(notes || []) as AdminInvestorNote[]}
      documents={(documents || []) as AdminSharedDocument[]}
      documentViews={(documentViews || []) as AdminDocumentView[]}
      activity={(activity || []) as AdminInvestorActivity[]}
      error={params?.error}
      success={params?.success}
      currency={companyCurrency}
      companyId={profile.company_id}
      investorEquity={investorEquityResult.ok ? investorEquityResult.data || null : null}
      investorEquityError={!investorEquityResult.ok ? investorEquityResult.error || null : null}
      saveInvestorNote={saveInvestorNote}
      suspendInvestor={suspendInvestor}
      reactivateInvestor={reactivateInvestor}
      removeInvestorAccess={removeInvestorAccess}
      sendInvestorPasswordReset={sendInvestorPasswordReset}
      notifications={notifications}
      userId={user.id}
    />
  );
}