import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import AdminSettingsClient from "./AdminSettingsClient";
import { getUserNotifications } from "@/lib/notifications/server";
import { emitEvent } from "@/lib/events/emitEvent";

export type AdminSettingsProfile = {
  id: string;
  full_name: string | null;
  role: string | null;
  company_id: string | null;
};

export type AdminCompanySettings = {
  id: string;
  name: string;
  currency: string | null;
};

export type WorkspaceMetric = {
  key:
    | "employees"
    | "investors"
    | "customers"
    | "products"
    | "sales"
    | "expenses"
    | "invoices"
    | "documents"
    | "tasks";
  label: string;
  count: number;
  available: boolean;
  href: string;
};

export type AccountSecuritySummary = {
  createdAt: string | null;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
};

function displayValue(value: string | null | undefined) {
  const normalizedValue = String(value || "").trim();
  return normalizedValue || "blank";
}

async function getAdminContext() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, company_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || !profile.company_id) {
    redirect("/admin/login");
  }

  return { supabase, user, profile };
}

async function updateCompanySettings(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminContext();
  const companyName = String(formData.get("company_name") || "").trim();
  const currency = String(formData.get("currency") || "USD")
    .trim()
    .toUpperCase();

  if (!companyName) {
    redirect("/dashboard/settings?error=Company name is required.");
  }

  const { data: previousCompany, error: lookupError } = await supabase
    .from("companies")
    .select("id, name, currency")
    .eq("id", profile.company_id)
    .single();

  if (lookupError || !previousCompany) {
    redirect(
      "/dashboard/settings?error=Company settings could not be found."
    );
  }

  const { error } = await supabase
    .from("companies")
    .update({ name: companyName, currency })
    .eq("id", profile.company_id);

  if (error) {
    redirect(`/dashboard/settings?error=${encodeURIComponent(error.message)}`);
  }

  const previousName = previousCompany.name || "";
  const previousCurrency = previousCompany.currency || "USD";
  const changes: string[] = [];

  if (previousName !== companyName) {
    changes.push(
      `company name "${displayValue(previousName)}" → "${displayValue(
        companyName
      )}"`
    );
  }

  if (previousCurrency !== currency) {
    changes.push(
      `currency "${displayValue(previousCurrency)}" → "${displayValue(
        currency
      )}"`
    );
  }

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id],
    type: "company_settings_updated",
    title: "Company settings updated",
    message:
      changes.length > 0
        ? `${changes.join("; ")}.`
        : `${companyName} was saved with no visible setting changes.`,
    actionUrl: "/dashboard/settings",
    metadata: {
      companyId: profile.company_id,
      changedFields: changes,
      previous: { name: previousName, currency: previousCurrency },
      updated: { name: companyName, currency },
    },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/investor");
  revalidatePath("/employee");

  redirect("/dashboard/settings?success=Company settings updated.");
}

async function updateAdminProfile(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminContext();
  const fullName = String(formData.get("full_name") || "").trim();

  if (!fullName) {
    redirect("/dashboard/settings?error=Full name is required.");
  }

  const previousFullName = profile.full_name || "";

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", profile.id)
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(`/dashboard/settings?error=${encodeURIComponent(error.message)}`);
  }

  const changes: string[] = [];
  if (previousFullName !== fullName) {
    changes.push(
      `founder name "${displayValue(previousFullName)}" → "${displayValue(
        fullName
      )}"`
    );
  }

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id],
    type: "founder_profile_updated",
    title: "Founder profile updated",
    message:
      changes.length > 0
        ? `${changes.join("; ")}.`
        : `${fullName} was saved with no visible profile changes.`,
    actionUrl: "/dashboard/settings",
    metadata: {
      profileId: profile.id,
      changedFields: changes,
      previous: { fullName: previousFullName },
      updated: { fullName },
    },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/investors");
  revalidatePath("/dashboard/employees");

  redirect("/dashboard/settings?success=Profile updated.");
}

async function getCount(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>
) {
  const result = await query;
  return {
    count: result.error ? 0 : result.count || 0,
    available: !result.error,
  };
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user, profile } = await getAdminContext();
  const companyId = profile.company_id;

  const [
    companyResult,
    notifications,
    employees,
    investors,
    customers,
    products,
    sales,
    expenses,
    invoices,
    documents,
    tasks,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, currency")
      .eq("id", companyId)
      .single(),
    getUserNotifications(user.id),
    getCount(
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("role", "employee")
    ),
    getCount(
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("role", "investor")
    ),
    getCount(
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
    ),
    getCount(
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
    ),
    getCount(
      supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
    ),
    getCount(
      supabase
        .from("expenses")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
    ),
    getCount(
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
    ),
    getCount(
      supabase
        .from("company_documents")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
    ),
    getCount(
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
    ),
  ]);

  const company = companyResult.data;

  const metrics: WorkspaceMetric[] = [
    { key: "employees", label: "Employees", ...employees, href: "/dashboard/employees" },
    { key: "investors", label: "Investors", ...investors, href: "/dashboard/investors" },
    { key: "customers", label: "Customers", ...customers, href: "/dashboard/customers" },
    { key: "products", label: "Products", ...products, href: "/dashboard/products" },
    { key: "sales", label: "Sales", ...sales, href: "/dashboard/sales" },
    { key: "expenses", label: "Expenses", ...expenses, href: "/dashboard/expenses" },
    { key: "invoices", label: "Invoices", ...invoices, href: "/dashboard/invoices" },
    { key: "documents", label: "Documents", ...documents, href: "/dashboard/documents" },
    { key: "tasks", label: "Tasks", ...tasks, href: "/dashboard/employees" },
  ];

  const security: AccountSecuritySummary = {
    createdAt: user.created_at || null,
    lastSignInAt: user.last_sign_in_at || null,
    emailConfirmedAt: user.email_confirmed_at || null,
  };

  return (
    <AdminSettingsClient
      adminName={profile.full_name || user.email || "Founder"}
      email={user.email || ""}
      profile={profile as AdminSettingsProfile}
      company={
        {
          id: company?.id || companyId,
          name: company?.name || "Company",
          currency: company?.currency || "USD",
        } as AdminCompanySettings
      }
      metrics={metrics}
      security={security}
      error={params?.error}
      success={params?.success}
      updateCompanySettings={updateCompanySettings}
      updateAdminProfile={updateAdminProfile}
      notifications={notifications}
      userId={user.id}
    />
  );
}