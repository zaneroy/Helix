import EmployeePortalShell from "@/components/employee/EmployeePortalShell";
import { EmployeeProfileView } from "@/components/employee/EmployeePortalViews";
import { getEmployeePortalReadModel } from "@/lib/actions/employee-portal";
import { createClient } from "@/lib/supabase/server";

type JsonRecord = Record<string, unknown>;

function textValue(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

export default async function EmployeeProfilePage() {
  const model = await getEmployeePortalReadModel();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profileRow: JsonRecord = {};

  if (user?.id) {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    profileRow = objectValue(data);
  }

  const currentModel = model as unknown as JsonRecord;
  const existingProfile = objectValue(currentModel.profile);
  const existingSummary = objectValue(currentModel.summary);
  const metadata = objectValue(user?.user_metadata);

  const fullName =
    textValue(
      profileRow.full_name,
      profileRow.name,
      profileRow.display_name,
      existingProfile.fullName,
      existingProfile.full_name,
      existingProfile.name,
      existingSummary.employeeName,
      existingSummary.employee_name,
      metadata.full_name,
      metadata.name,
      user?.email,
    ) || "Employee";

  const email =
    textValue(user?.email, profileRow.email, profileRow.user_email, existingProfile.email, existingSummary.employeeEmail, existingSummary.employee_email) || "—";

  const employeeId =
    textValue(profileRow.employee_id, profileRow.employeeId, existingProfile.employeeId, existingProfile.employee_id, existingSummary.employeeId, existingSummary.employee_id, user?.id) || "—";

  const enrichedModel = {
    ...currentModel,
    profile: {
      ...existingProfile,
      ...profileRow,
      userId: user?.id || existingProfile.userId || null,
      fullName,
      name: fullName,
      email,
      employeeId,
      employee_id: employeeId,
      role: textValue(profileRow.role, existingProfile.role, existingSummary.role) || "employee",
      department:
        textValue(
          profileRow.department,
          existingProfile.department,
          existingSummary.department,
        ) || undefined,
      job_title:
        textValue(
          profileRow.job_title,
          profileRow.jobTitle,
          existingProfile.job_title,
          existingProfile.jobTitle,
          existingSummary.job_title,
          existingSummary.jobTitle,
        ) || undefined,
      jobTitle:
        textValue(
          profileRow.job_title,
          profileRow.jobTitle,
          existingProfile.job_title,
          existingProfile.jobTitle,
          existingSummary.job_title,
          existingSummary.jobTitle,
        ) || undefined,
      companyName: textValue(existingProfile.companyName, existingProfile.company_name, existingSummary.companyName, existingSummary.company_name) || undefined,
    },
    summary: {
      ...existingSummary,
      employeeName: fullName,
      employeeEmail: email,
      employeeId,
    },
    user: {
      ...objectValue(currentModel.user),
      id: user?.id || objectValue(currentModel.user).id,
      email,
      user_metadata: metadata,
      created_at: user?.created_at || objectValue(currentModel.user).created_at,
      last_sign_in_at: user?.last_sign_in_at || objectValue(currentModel.user).last_sign_in_at,
    },
  } as unknown as typeof model;

  return (
    <EmployeePortalShell model={enrichedModel}>
      <EmployeeProfileView model={enrichedModel} />
    </EmployeePortalShell>
  );
}
