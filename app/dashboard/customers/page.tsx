import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { createBackgroundPlatformEvent } from "@/lib/events/createPlatformEvent";
import { getUserNotifications } from "@/lib/notifications/server";
import { createClient } from "@/lib/supabase/server";
import CustomersClient from "./CustomersClient";

type SearchParams = {
  error?: string;
  success?: string;
};

type CustomerRow = {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  address: string | null;
  notes: string | null;
  created_at: string | null;
  created_by: string | null;
};

type CustomerStatRow = {
  id: string;
  company_id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  revenue: number | string | null;
  transactions: number | string | null;
  last_activity: string | null;
};

export type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  address: string | null;
  notes: string | null;
  created_at: string | null;
  revenue: number;
  transactions: number;
  last_activity: string | null;
};

function cleanText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function redirectWithMessage(
  type: "error" | "success",
  message: string
): never {
  redirect(
    `/dashboard/customers?${type}=${encodeURIComponent(message)}`
  );
}

async function getAdminContext() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/admin/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, company_id, access_status")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin" ||
    !profile.company_id ||
    profile.access_status === "inactive"
  ) {
    redirect("/admin/login");
  }

  return {
    supabase,
    user,
    profile,
  };
}

async function addCustomer(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminContext();

  const name = cleanText(formData.get("name"));
  const email = cleanText(formData.get("email"));
  const phone = cleanText(formData.get("phone"));
  const companyName = cleanText(formData.get("company_name"));
  const address = cleanText(formData.get("address"));
  const notes = cleanText(formData.get("notes"));

  if (!name) {
    redirectWithMessage("error", "Customer name is required.");
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirectWithMessage("error", "Enter a valid customer email.");
  }

  const { data: createdCustomer, error } = await supabase
    .from("customers")
    .insert({
      company_id: profile.company_id,
      name,
      email,
      phone,
      company_name: companyName,
      address,
      notes,
      created_by: user.id,
    })
    .select("id, name, email, phone, company_name")
    .single();

  if (error || !createdCustomer) {
    if (error?.code === "23505") {
      redirectWithMessage(
        "error",
        "A customer with this email already exists."
      );
    }

    redirectWithMessage(
      "error",
      error?.message || "Unable to add the customer."
    );
  }

  await createBackgroundPlatformEvent({
    companyId: profile.company_id,
    actorId: user.id,
    actorRole: profile.role,
    eventType: "customer.created",
    title: "Customer added",
    description: `${name} was added to the customer register.`,
    referenceType: "customer",
    referenceId: createdCustomer.id,
    actionUrl: "/dashboard/customers",
    severity: "success",
    metadata: {
      customerId: createdCustomer.id,
      customerName: name,
      customerCompany: companyName,
      customerEmail: email,
      customerPhone: phone,
    },
    createNotification: true,
    recipientId: user.id,
    recipientRole: "admin",
  });

  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");

  redirectWithMessage("success", `${name} was added successfully.`);
}

async function updateCustomer(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminContext();

  const id = cleanText(formData.get("id"));
  const name = cleanText(formData.get("name"));
  const email = cleanText(formData.get("email"));
  const phone = cleanText(formData.get("phone"));
  const companyName = cleanText(formData.get("company_name"));
  const address = cleanText(formData.get("address"));
  const notes = cleanText(formData.get("notes"));

  if (!id) {
    redirectWithMessage("error", "Customer ID is missing.");
  }

  if (!name) {
    redirectWithMessage("error", "Customer name is required.");
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirectWithMessage("error", "Enter a valid customer email.");
  }

  const { data: existingCustomer, error: existingError } =
    await supabase
      .from("customers")
      .select("id, name, email, phone, company_name, address, notes")
      .eq("id", id)
      .eq("company_id", profile.company_id)
      .single();

  if (existingError || !existingCustomer) {
    redirectWithMessage("error", "Customer could not be found.");
  }

  const { data: updatedCustomer, error } = await supabase
    .from("customers")
    .update({
      name,
      email,
      phone,
      company_name: companyName,
      address,
      notes,
    })
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .select("id")
    .single();

  if (error || !updatedCustomer) {
    if (error?.code === "23505") {
      redirectWithMessage(
        "error",
        "A customer with this email already exists."
      );
    }

    redirectWithMessage(
      "error",
      error?.message || "Unable to update the customer."
    );
  }

  const changedFields = [
    existingCustomer.name !== name ? "name" : null,
    existingCustomer.company_name !== companyName ? "company" : null,
    existingCustomer.email !== email ? "email" : null,
    existingCustomer.phone !== phone ? "phone" : null,
    existingCustomer.address !== address ? "address" : null,
    existingCustomer.notes !== notes ? "notes" : null,
  ].filter((field): field is string => Boolean(field));

  await createBackgroundPlatformEvent({
    companyId: profile.company_id,
    actorId: user.id,
    actorRole: profile.role,
    eventType: "customer.updated",
    title: "Customer updated",
    description:
      changedFields.length > 0
        ? `${name}'s ${changedFields.join(", ")} ${
            changedFields.length === 1 ? "was" : "were"
          } updated.`
        : `${name}'s customer profile was saved.`,
    referenceType: "customer",
    referenceId: id,
    actionUrl: "/dashboard/customers",
    severity: "info",
    metadata: {
      customerId: id,
      customerName: name,
      previousName: existingCustomer.name,
      changedFields,
      customerCompany: companyName,
      customerEmail: email,
      customerPhone: phone,
    },
    createNotification: true,
    recipientId: user.id,
    recipientRole: "admin",
  });

  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");

  redirectWithMessage("success", `${name} was updated successfully.`);
}

async function deleteCustomer(formData: FormData) {
  "use server";

  const { supabase, user, profile } = await getAdminContext();

  const id = cleanText(formData.get("id"));

  if (!id) {
    redirectWithMessage("error", "Customer ID is missing.");
  }

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, name, email, phone, company_name")
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .single();

  if (customerError || !customer) {
    redirectWithMessage("error", "Customer could not be found.");
  }

  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", id)
    .eq("company_id", profile.company_id);

  if (error) {
    if (error.code === "23503") {
      redirectWithMessage(
        "error",
        "This customer has linked financial records and cannot be deleted."
      );
    }

    redirectWithMessage(
      "error",
      error.message || "Unable to delete the customer."
    );
  }

  await createBackgroundPlatformEvent({
    companyId: profile.company_id,
    actorId: user.id,
    actorRole: profile.role,
    eventType: "customer.deleted",
    title: "Customer deleted",
    description: `${customer.name} was removed from the customer register.`,
    referenceType: "customer",
    referenceId: id,
    actionUrl: "/dashboard/customers",
    severity: "warning",
    metadata: {
      customerId: id,
      customerName: customer.name,
      customerCompany: customer.company_name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      deleted: true,
    },
    createNotification: true,
    recipientId: user.id,
    recipientRole: "admin",
  });

  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");

  redirectWithMessage(
    "success",
    `${customer.name} was deleted successfully.`
  );
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const { supabase, user, profile } = await getAdminContext();

  const [
    { data: company, error: companyError },
    { data: customerRows, error: customerError },
    { data: customerStatsRows, error: statsError },
    notifications,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, currency")
      .eq("id", profile.company_id)
      .single(),

    supabase
      .from("customers")
      .select(
        `
          id,
          company_id,
          name,
          email,
          phone,
          company_name,
          address,
          notes,
          created_at,
          created_by
        `
      )
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false }),

    supabase
      .from("customer_stats")
      .select(
        `
          id,
          company_id,
          name,
          company_name,
          email,
          phone,
          revenue,
          transactions,
          last_activity
        `
      )
      .eq("company_id", profile.company_id),

    getUserNotifications(user.id),
  ]);

  const loadError =
    companyError?.message ||
    customerError?.message ||
    statsError?.message ||
    undefined;

  const statsMap = new Map(
    ((customerStatsRows ?? []) as CustomerStatRow[]).map((row) => [
      row.id,
      row,
    ])
  );

  const customers: Customer[] = (
    (customerRows ?? []) as CustomerRow[]
  ).map((customer) => {
    const stats = statsMap.get(customer.id);

    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      company_name: customer.company_name,
      address: customer.address,
      notes: customer.notes,
      created_at: customer.created_at,
      revenue: Number(stats?.revenue || 0),
      transactions: Number(stats?.transactions || 0),
      last_activity: stats?.last_activity || null,
    };
  });

  return (
    <AdminShell
      title="Customers"
      adminName={
        profile.full_name || profile.email || user.email || "Founder"
      }
      adminRole="Founder"
      showPageHeader={false}
      notifications={notifications ?? []}
      userId={user.id}
    >
      <CustomersClient
        companyName={company?.name || "Company"}
        currency={company?.currency || "USD"}
        customers={customers}
        error={params.error || loadError}
        success={params.success}
        addCustomer={addCustomer}
        updateCustomer={updateCustomer}
        deleteCustomer={deleteCustomer}
      />
    </AdminShell>
  );
}