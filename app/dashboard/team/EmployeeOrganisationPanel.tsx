import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type JsonRecord = Record<string, unknown>;

type RpcClient = {
  rpc: (
    fn: string,
    args?: JsonRecord,
  ) => Promise<{ error: { message: string } | null }>;
};

function textValue(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return "";
}

function employeeName(row: JsonRecord): string {
  return (
    textValue(
      row.full_name,
      row.fullName,
      row.display_name,
      row.displayName,
      row.name,
      row.email,
    ) || "Employee"
  );
}

function employeeEmail(row: JsonRecord): string {
  return textValue(row.email, row.user_email) || "—";
}

function employeeRole(row: JsonRecord): string {
  return textValue(row.role, row.account_role) || "employee";
}

function employeeStatus(row: JsonRecord): string {
  return textValue(row.status, row.account_status) || "active";
}

function employeeDepartment(row: JsonRecord): string {
  return textValue(row.department);
}

function employeeJobTitle(row: JsonRecord): string {
  return textValue(row.job_title, row.jobTitle);
}

function initials(name: string, email: string): string {
  const source = name || email || "Employee";

  return source
    .split(/[ @._-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isEmployee(row: JsonRecord): boolean {
  const role = employeeRole(row).toLowerCase();
  const accountType = textValue(row.account_type, row.type, row.portal).toLowerCase();

  if (role.includes("employee") || accountType.includes("employee")) return true;
  if (role.includes("admin") || role.includes("founder") || role.includes("owner")) return false;
  if (role.includes("investor")) return false;

  return false;
}

async function updateEmployeeDepartmentJobTitle(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const employeeId = textValue(formData.get("employeeId"));
  const department = textValue(formData.get("department"));
  const jobTitle = textValue(formData.get("jobTitle"));

  if (!employeeId) {
    revalidatePath("/dashboard/team");
    return;
  }

  let saved = false;
  let lastError = "";

  const { error: rpcError } = await (supabase as unknown as RpcClient).rpc(
    "helix_update_employee_org",
    {
      p_employee_id: employeeId,
      p_department: department,
      p_job_title: jobTitle,
    },
  );

  if (!rpcError) {
    saved = true;
  } else {
    lastError = rpcError.message;
  }

  if (!saved) {
    const { error } = await supabase
      .from("profiles")
      .update({
        department: department || null,
        job_title: jobTitle || null,
      })
      .eq("id", employeeId);

    if (!error) {
      saved = true;
    } else {
      lastError = error.message;
    }
  }

  if (!saved && lastError) {
    console.error("Could not save employee department/job title:", lastError);
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/employee/profile");
  revalidatePath("/employee");
}

async function readEmployees(): Promise<JsonRecord[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const companyId = textValue((currentProfile as JsonRecord | null)?.company_id);

  let query = supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Could not read employee organisation rows:", error.message);
    return [];
  }

  return ((data || []) as JsonRecord[]).filter(isEmployee);
}

function Pill({
  label,
  tone = "cyan",
}: {
  label: string;
  tone?: "cyan" | "blue" | "green" | "muted";
}) {
  const classes = {
    cyan: "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
    blue: "border-[color:var(--secondary-border)] bg-[color:var(--secondary-soft)] text-[color:var(--secondary)]",
    green: "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
    muted: "border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-tertiary)]",
  }[tone];

  return (
    <span
      className={[
        "inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]",
        classes,
      ].join(" ")}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

export default async function EmployeeOrganisationPanel() {
  const employees = await readEmployees();

  return (
    <section className="rounded-[1.35rem] border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-4 border-b border-[color:var(--border)] px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">
            Employee profile setup
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
            Department and job title
          </h2>
          <p className="mt-1 text-sm text-[color:var(--text-tertiary)]">
            Admin/founder sets the employee department and job title. No access permissions are changed.
          </p>
        </div>

        <div className="rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-4 py-3 text-right">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
            Employees
          </p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--primary)]">
            {employees.length} records
          </p>
        </div>
      </div>

      <div className="grid gap-3 p-5">
        {employees.length ? (
          employees.map((employee) => {
            const id = textValue(employee.id, employee.user_id);
            const name = employeeName(employee);
            const email = employeeEmail(employee);
            const role = employeeRole(employee);
            const status = employeeStatus(employee);
            const department = employeeDepartment(employee);
            const jobTitle = employeeJobTitle(employee);

            return (
              <form
                key={id || email}
                action={updateEmployeeDepartmentJobTitle}
                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4"
              >
                <input type="hidden" name="employeeId" value={id} />

                <div className="grid gap-4 xl:grid-cols-[minmax(260px,1fr)_minmax(360px,1.2fr)_auto] xl:items-start">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-sm font-semibold text-[color:var(--primary)]">
                      {initials(name, email)}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-[color:var(--text-primary)]">{name}</p>
                      <p className="mt-0.5 truncate text-sm text-[color:var(--text-tertiary)]">{email}</p>
                      <p className="mt-0.5 truncate text-[11px] text-[color:var(--text-muted)]">ID {id || "—"}</p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                        Role
                      </p>
                      <div className="mt-2">
                        <Pill label={role} tone="blue" />
                      </div>
                    </div>

                    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                        Department
                      </p>
                      <div className="mt-2">
                        <Pill
                          label={department || "Not set"}
                          tone={department ? "cyan" : "muted"}
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                        Job title
                      </p>
                      <p className="mt-2 truncate text-sm font-medium text-[color:var(--text-primary)]">
                        {jobTitle || "Not set"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 xl:justify-end">
                    <Pill
                      label={status}
                      tone={status.toLowerCase() === "active" ? "green" : "muted"}
                    />
                    <button
                      type="submit"
                      className="h-10 rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-5 text-sm font-semibold text-[color:var(--primary)] transition hover:bg-[color:var(--primary-soft)]"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                      Set department
                    </span>
                    <input
                      name="department"
                      defaultValue={department}
                      placeholder="Sales"
                      className="mt-2 h-11 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 text-sm text-[color:var(--text-primary)] outline-none transition placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--border-brand)]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                      Set job title
                    </span>
                    <input
                      name="jobTitle"
                      defaultValue={jobTitle}
                      placeholder="Sales Assistant"
                      className="mt-2 h-11 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 text-sm text-[color:var(--text-primary)] outline-none transition placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--border-brand)]"
                    />
                  </label>
                </div>
              </form>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] px-5 py-8 text-center text-sm text-[color:var(--text-tertiary)]">
            No employee records found.
          </div>
        )}
      </div>
    </section>
  );
}
