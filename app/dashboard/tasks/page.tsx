import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { emitEvent } from "@/lib/events/emitEvent";
import { getUserNotifications } from "@/lib/notifications/server";
import AdminTasksClient from "./AdminTasksClient";
import { reviewEmployeeExpenseFromProfile } from "@/lib/actions/reviewEmployeeExpense";

export type AdminEmployee = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  company_id: string | null;
  created_at: string | null;
  access_status?: string | null;
};

export type AdminTask = {
  id: string;
  company_id: string;
  assigned_to: string | null;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  created_at: string | null;
};

export type AdminEmployeeSale = {
  id: string;
  created_by: string | null;
  total_amount: number | string | null;
  profit_amount: number | string | null;
  sold_at: string | null;
};

export type AdminEmployeeExpense = {
  id: string;
  created_by: string | null;
  title: string | null;
  category: string | null;
  amount: number | string | null;
  payee: string | null;
  payment_method: string | null;
  expense_date: string | null;
  notes: string | null;
  status: string | null;
};

export type AdminExpensePaymentAccount = {
  id: string;
  name: string;
  account_type: string;
  accounting_account_id: string | null;
  currency: string;
  status: string;
};

export type AdminEmployeeNote = {
  id: string;
  employee_id: string;
  notes: string | null;
};

type EmployeeSummary = {
  id: string;
  full_name: string | null;
  email: string | null;
  access_status: string | null;
};

function getEmployeeName(employee: {
  full_name?: string | null;
  email?: string | null;
}) {
  return employee.full_name || employee.email || "Employee";
}

function displayValue(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  return normalized || "blank";
}

function formatStatus(value: string | null | undefined) {
  const normalized = String(value || "todo");

  return normalized
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatPriority(value: string | null | undefined) {
  const normalized = String(value || "normal");

  return normalized
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No due date";

  const parsedDate = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function getAdminContext() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

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

async function getEmployee(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  employeeId: string
): Promise<EmployeeSummary | null> {
  const { data: employee } = await supabase
    .from("profiles")
    .select("id, full_name, email, access_status")
    .eq("id", employeeId)
    .eq("company_id", companyId)
    .eq("role", "employee")
    .single();

  return (employee as EmployeeSummary | null) || null;
}

function revalidateTaskPages() {
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");
  revalidatePath("/employee");
  revalidatePath("/employee/tasks");
  revalidatePath("/employee/profile");
}

async function createTask(formData: FormData) {
  "use server";

  const { supabase, profile, user } = await getAdminContext();

  const assignedTo = String(formData.get("assigned_to") || "");
  const title = String(formData.get("title") || "").trim();
  const description =
    String(formData.get("description") || "").trim() || null;
  const status = String(formData.get("status") || "todo");
  const priority = String(formData.get("priority") || "normal");
  const dueDate = String(formData.get("due_date") || "") || null;

  if (!assignedTo || !title) {
    redirect(
      "/dashboard/tasks?error=Employee and task title are required."
    );
  }

  const employee = await getEmployee(
    supabase,
    profile.company_id,
    assignedTo
  );

  if (!employee) {
    redirect("/dashboard/tasks?error=Employee not found.");
  }

  const { data: createdTask, error } = await supabase
    .from("tasks")
    .insert({
      company_id: profile.company_id,
      assigned_to: assignedTo,
      title,
      description,
      status,
      priority,
      due_date: dueDate,
    })
    .select(
      "id, company_id, assigned_to, title, description, status, priority, due_date, created_at"
    )
    .single();

  if (error || !createdTask) {
    redirect(
      `/dashboard/tasks?error=${encodeURIComponent(
        error?.message || "Task could not be created."
      )}`
    );
  }

  const employeeName = getEmployeeName(employee);

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id, employee.id],
    type: "task_assigned",
    title: "Task assigned",
    message: `"${title}" was assigned to ${employeeName}. Priority: ${formatPriority(
      priority
    )}; status: ${formatStatus(status)}; due: ${formatDate(dueDate)}.`,
    actionUrl: null,
    metadata: {
      taskId: createdTask.id,
      employeeId: employee.id,
      employeeName,
      employeeEmail: employee.email,
      title,
      description,
      status,
      priority,
      dueDate,
      assignedBy: user.id,
    },
  });

  revalidateTaskPages();

  redirect("/dashboard/tasks?success=Task assigned successfully.");
}

async function updateTask(formData: FormData) {
  "use server";

  const { supabase, profile, user } = await getAdminContext();

  const taskId = String(formData.get("id") || "");
  const assignedTo = String(formData.get("assigned_to") || "");
  const title = String(formData.get("title") || "").trim();
  const description =
    String(formData.get("description") || "").trim() || null;
  const status = String(formData.get("status") || "todo");
  const priority = String(formData.get("priority") || "normal");
  const dueDate = String(formData.get("due_date") || "") || null;

  if (!taskId || !assignedTo || !title) {
    redirect("/dashboard/tasks?error=Missing task details.");
  }

  const { data: previousTask, error: taskLookupError } = await supabase
    .from("tasks")
    .select(
      "id, company_id, assigned_to, title, description, status, priority, due_date"
    )
    .eq("id", taskId)
    .eq("company_id", profile.company_id)
    .single();

  if (taskLookupError || !previousTask) {
    redirect("/dashboard/tasks?error=Task not found.");
  }

  const newEmployee = await getEmployee(
    supabase,
    profile.company_id,
    assignedTo
  );

  if (!newEmployee) {
    redirect("/dashboard/tasks?error=Assigned employee not found.");
  }

  const previousEmployee = previousTask.assigned_to
    ? await getEmployee(
        supabase,
        profile.company_id,
        previousTask.assigned_to
      )
    : null;

  const { error } = await supabase
    .from("tasks")
    .update({
      assigned_to: assignedTo,
      title,
      description,
      status,
      priority,
      due_date: dueDate,
    })
    .eq("id", taskId)
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      `/dashboard/tasks?error=${encodeURIComponent(error.message)}`
    );
  }

  const changes: string[] = [];

  if (previousTask.title !== title) {
    changes.push(
      `title "${displayValue(previousTask.title)}" → "${displayValue(
        title
      )}"`
    );
  }

  if ((previousTask.description || null) !== description) {
    if (!previousTask.description && description) {
      changes.push("description added");
    } else if (previousTask.description && !description) {
      changes.push("description removed");
    } else {
      changes.push("description updated");
    }
  }

  if (previousTask.assigned_to !== assignedTo) {
    changes.push(
      `assignee "${getEmployeeName(
        previousEmployee || {}
      )}" → "${getEmployeeName(newEmployee)}"`
    );
  }

  if ((previousTask.status || "todo") !== status) {
    changes.push(
      `status "${formatStatus(
        previousTask.status
      )}" → "${formatStatus(status)}"`
    );
  }

  if ((previousTask.priority || "normal") !== priority) {
    changes.push(
      `priority "${formatPriority(
        previousTask.priority
      )}" → "${formatPriority(priority)}"`
    );
  }

  if ((previousTask.due_date || null) !== dueDate) {
    changes.push(
      `due date "${formatDate(
        previousTask.due_date
      )}" → "${formatDate(dueDate)}"`
    );
  }

  const employeeName = getEmployeeName(newEmployee);

  const message =
    changes.length > 0
      ? `"${title}" for ${employeeName}: ${changes.join("; ")}.`
      : `"${title}" for ${employeeName} was saved with no visible changes.`;

  const recipients = Array.from(
    new Set(
      [
        user.id,
        previousTask.assigned_to,
        assignedTo,
      ].filter((recipient): recipient is string => Boolean(recipient))
    )
  );

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients,
    type: "task_updated",
    title: "Task updated",
    message,
    actionUrl: null,
    metadata: {
      taskId,
      changedFields: changes,
      previous: {
        assignedTo: previousTask.assigned_to,
        employeeName: getEmployeeName(previousEmployee || {}),
        title: previousTask.title,
        description: previousTask.description,
        status: previousTask.status,
        priority: previousTask.priority,
        dueDate: previousTask.due_date,
      },
      updated: {
        assignedTo,
        employeeName,
        title,
        description,
        status,
        priority,
        dueDate,
      },
    },
  });

  revalidateTaskPages();

  redirect("/dashboard/tasks?success=Task updated successfully.");
}

async function deleteTask(formData: FormData) {
  "use server";

  const { supabase, profile, user } = await getAdminContext();

  const taskId = String(formData.get("id") || "");

  if (!taskId) {
    redirect("/dashboard/tasks?error=Task not found.");
  }

  const { data: task, error: taskLookupError } = await supabase
    .from("tasks")
    .select(
      "id, assigned_to, title, description, status, priority, due_date"
    )
    .eq("id", taskId)
    .eq("company_id", profile.company_id)
    .single();

  if (taskLookupError || !task) {
    redirect("/dashboard/tasks?error=Task not found.");
  }

  const employee = task.assigned_to
    ? await getEmployee(
        supabase,
        profile.company_id,
        task.assigned_to
      )
    : null;

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      `/dashboard/tasks?error=${encodeURIComponent(error.message)}`
    );
  }

  const employeeName = getEmployeeName(employee || {});

  const recipients = Array.from(
    new Set(
      [user.id, task.assigned_to].filter(
        (recipient): recipient is string => Boolean(recipient)
      )
    )
  );

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients,
    type: "task_deleted",
    title: "Task removed",
    message: `"${task.title}" was removed from ${employeeName}.`,
    actionUrl: null,
    metadata: {
      taskId,
      employeeId: task.assigned_to,
      employeeName,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.due_date,
    },
  });

  revalidateTaskPages();

  redirect("/dashboard/tasks?success=Task deleted successfully.");
}

async function saveEmployeeNote(formData: FormData) {
  "use server";

  const { supabase, profile, user } = await getAdminContext();

  const employeeId = String(formData.get("employee_id") || "");
  const notes = String(formData.get("notes") || "").trim();

  if (!employeeId) {
    redirect("/dashboard/tasks?error=Employee not found.");
  }

  const employee = await getEmployee(
    supabase,
    profile.company_id,
    employeeId
  );

  if (!employee) {
    redirect("/dashboard/tasks?error=Employee not found.");
  }

  const { data: previousNote } = await supabase
    .from("employee_notes")
    .select("notes")
    .eq("company_id", profile.company_id)
    .eq("employee_id", employeeId)
    .maybeSingle();

  const previousNotes = previousNote?.notes || "";

  const { error } = await supabase.from("employee_notes").upsert(
    {
      company_id: profile.company_id,
      employee_id: employeeId,
      notes,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "company_id,employee_id",
    }
  );

  if (error) {
    redirect(
      `/dashboard/tasks?error=${encodeURIComponent(error.message)}`
    );
  }

  const employeeName = getEmployeeName(employee);

  let title = "Employee note saved";
  let message = `The private note for ${employeeName} was saved with no visible changes.`;
  let changeType = "unchanged";

  if (!previousNotes && notes) {
    title = "Employee note added";
    message = `A private note was added for ${employeeName}.`;
    changeType = "created";
  } else if (previousNotes && !notes) {
    title = "Employee note cleared";
    message = `The private note for ${employeeName} was cleared.`;
    changeType = "cleared";
  } else if (previousNotes !== notes) {
    title = "Employee note updated";
    message = `The private note for ${employeeName} was updated.`;
    changeType = "updated";
  }

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id],
    type: `employee_note_${changeType}`,
    title,
    message,
    actionUrl: "/dashboard/tasks",
    metadata: {
      employeeId,
      employeeName,
      employeeEmail: employee.email,
      previousNotes,
      updatedNotes: notes,
      changeType,
    },
  });

  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard");

  redirect("/dashboard/tasks?success=Employee note saved.");
}

async function suspendEmployee(formData: FormData) {
  "use server";

  const { supabase, profile, user } = await getAdminContext();

  const employeeId = String(formData.get("employee_id") || "");

  if (!employeeId) {
    redirect("/dashboard/tasks?error=Employee not found.");
  }

  const employee = await getEmployee(
    supabase,
    profile.company_id,
    employeeId
  );

  if (!employee) {
    redirect("/dashboard/tasks?error=Employee not found.");
  }

  const previousStatus = employee.access_status || "active";

  const { error } = await supabase
    .from("profiles")
    .update({
      access_status: "suspended",
    })
    .eq("id", employeeId)
    .eq("company_id", profile.company_id)
    .eq("role", "employee");

  if (error) {
    redirect(
      `/dashboard/tasks?error=${encodeURIComponent(error.message)}`
    );
  }

  const employeeName = getEmployeeName(employee);

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id, employeeId],
    type: "employee_suspended",
    title: "Employee access suspended",
    message: `${employeeName}'s company access was changed from ${previousStatus} to suspended.`,
    actionUrl: null,
    metadata: {
      employeeId,
      employeeName,
      employeeEmail: employee.email,
      previousAccessStatus: previousStatus,
      newAccessStatus: "suspended",
    },
  });

  revalidateTaskPages();

  redirect("/dashboard/tasks?success=Employee suspended.");
}

async function reactivateEmployee(formData: FormData) {
  "use server";

  const { supabase, profile, user } = await getAdminContext();

  const employeeId = String(formData.get("employee_id") || "");

  if (!employeeId) {
    redirect("/dashboard/tasks?error=Employee not found.");
  }

  const employee = await getEmployee(
    supabase,
    profile.company_id,
    employeeId
  );

  if (!employee) {
    redirect("/dashboard/tasks?error=Employee not found.");
  }

  const previousStatus = employee.access_status || "suspended";

  const { error } = await supabase
    .from("profiles")
    .update({
      access_status: "active",
    })
    .eq("id", employeeId)
    .eq("company_id", profile.company_id)
    .eq("role", "employee");

  if (error) {
    redirect(
      `/dashboard/tasks?error=${encodeURIComponent(error.message)}`
    );
  }

  const employeeName = getEmployeeName(employee);

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id, employeeId],
    type: "employee_reactivated",
    title: "Employee access restored",
    message: `${employeeName}'s company access was changed from ${previousStatus} to active.`,
    actionUrl: null,
    metadata: {
      employeeId,
      employeeName,
      employeeEmail: employee.email,
      previousAccessStatus: previousStatus,
      newAccessStatus: "active",
    },
  });

  revalidateTaskPages();

  redirect("/dashboard/tasks?success=Employee reactivated.");
}

async function removeEmployeeAccess(formData: FormData) {
  "use server";

  const { supabase, profile, user } = await getAdminContext();

  const employeeId = String(formData.get("employee_id") || "");

  if (!employeeId) {
    redirect("/dashboard/tasks?error=Employee not found.");
  }

  const employee = await getEmployee(
    supabase,
    profile.company_id,
    employeeId
  );

  if (!employee) {
    redirect("/dashboard/tasks?error=Employee not found.");
  }

  const employeeName = getEmployeeName(employee);
  const previousStatus = employee.access_status || "active";

  const { error } = await supabase
    .from("profiles")
    .update({
      company_id: null,
      role: null,
      access_status: "removed",
    })
    .eq("id", employeeId)
    .eq("company_id", profile.company_id)
    .eq("role", "employee");

  if (error) {
    redirect(
      `/dashboard/tasks?error=${encodeURIComponent(error.message)}`
    );
  }

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id, employeeId],
    type: "employee_access_removed",
    title: "Employee access removed",
    message: `${employeeName} was removed from the company. Previous access status: ${previousStatus}.`,
    actionUrl: null,
    metadata: {
      employeeId,
      employeeName,
      employeeEmail: employee.email,
      previousAccessStatus: previousStatus,
      newAccessStatus: "removed",
      previousRole: "employee",
      companyAccessRemoved: true,
    },
  });

  revalidateTaskPages();

  redirect("/dashboard/tasks?success=Employee access removed.");
}

async function sendEmployeePasswordReset(formData: FormData) {
  "use server";

  const { supabase, profile, user } = await getAdminContext();

  const employeeId = String(formData.get("employee_id") || "");

  if (!employeeId) {
    redirect("/dashboard/tasks?error=Employee not found.");
  }

  const employee = await getEmployee(
    supabase,
    profile.company_id,
    employeeId
  );

  if (!employee?.email) {
    redirect("/dashboard/tasks?error=Employee email not found.");
  }

  const employeeName = getEmployeeName(employee);

  const { error } = await supabase.auth.resetPasswordForEmail(
    employee.email,
    {
      redirectTo: `${
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
      }/reset-password`,
    }
  );

  if (error) {
    await emitEvent({
      companyId: profile.company_id,
      actorId: user.id,
      recipients: [user.id],
      type: "employee_password_reset_failed",
      title: "Employee password reset failed",
      message: `A password reset email could not be sent to ${employeeName} at ${employee.email}. Reason: ${error.message}`,
      actionUrl: "/dashboard/tasks",
      metadata: {
        employeeId,
        employeeName,
        employeeEmail: employee.email,
        reason: error.message,
      },
    });

    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard/activity");

    redirect(
      `/dashboard/tasks?error=${encodeURIComponent(error.message)}`
    );
  }

  await emitEvent({
    companyId: profile.company_id,
    actorId: user.id,
    recipients: [user.id, employeeId],
    type: "employee_password_reset_sent",
    title: "Employee password reset sent",
    message: `A password reset email was sent to ${employeeName} at ${employee.email}.`,
    actionUrl: null,
    metadata: {
      employeeId,
      employeeName,
      employeeEmail: employee.email,
      requestedBy: user.id,
    },
  });

  revalidateTaskPages();

  redirect("/dashboard/tasks?success=Password reset email sent.");
}

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
}) {
  const params = await searchParams;
  const { supabase, user, profile } = await getAdminContext();

  const [
    { data: company },
    { data: employees },
    { data: tasks },
    { data: sales },
    { data: expenses },
    { data: expenseAccounts },
    { data: employeeNotes },
    notifications,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("currency")
      .eq("id", profile.company_id)
      .single(),

    supabase
      .from("profiles")
      .select(
        "id, full_name, email, role, company_id, created_at, access_status"
      )
      .eq("company_id", profile.company_id)
      .eq("role", "employee")
      .order("full_name", { ascending: true }),

    supabase
      .from("tasks")
      .select(
        "id, company_id, assigned_to, title, description, status, priority, due_date, created_at"
      )
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false }),

    supabase
      .from("sales")
      .select(
        "id, created_by, total_amount, profit_amount, sold_at"
      )
      .eq("company_id", profile.company_id),

    supabase
      .from("expenses")
      .select(
        "id, created_by, title, category, amount, payee, payment_method, expense_date, notes, status"
      )
      .eq("company_id", profile.company_id),

    supabase
      .from("cash_accounts")
      .select(
        "id, name, account_type, accounting_account_id, currency, status"
      )
      .eq("company_id", profile.company_id)
      .eq("status", "active")
      .order("created_at", { ascending: true }),

    supabase
      .from("employee_notes")
      .select("id, employee_id, notes")
      .eq("company_id", profile.company_id),

    getUserNotifications(user.id),
  ]);

  return (
    <AdminTasksClient
      adminName={profile.full_name || user.email || "Founder"}
      currency={company?.currency || "USD"}
      employees={(employees || []) as AdminEmployee[]}
      tasks={(tasks || []) as AdminTask[]}
      sales={(sales || []) as AdminEmployeeSale[]}
      expenses={(expenses || []) as AdminEmployeeExpense[]}
      expenseAccounts={
        (expenseAccounts || []) as AdminExpensePaymentAccount[]
      }
      employeeNotes={(employeeNotes || []) as AdminEmployeeNote[]}
      error={params?.error}
      success={params?.success}
      createTask={createTask}
      updateTask={updateTask}
      deleteTask={deleteTask}
      saveEmployeeNote={saveEmployeeNote}
      suspendEmployee={suspendEmployee}
      reactivateEmployee={reactivateEmployee}
      removeEmployeeAccess={removeEmployeeAccess}
      sendEmployeePasswordReset={sendEmployeePasswordReset}
      reviewEmployeeExpense={reviewEmployeeExpenseFromProfile}
      notifications={notifications}
      userId={user.id}
    />
  );
}
