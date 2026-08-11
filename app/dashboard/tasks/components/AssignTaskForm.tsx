"use client";

import { useMemo, useState } from "react";
import type { AdminEmployee } from "../page";

type ServerAction = (formData: FormData) => void | Promise<void>;

type Props = {
  employees: AdminEmployee[];
  selectedEmployeeId: string;
  onSelectedEmployeeChange: (employeeId: string) => void;
  createTask: ServerAction;
};

type TaskPriority = "low" | "normal" | "high";
type TaskStatus = "todo" | "in_progress" | "done";

export default function AssignTaskForm({
  employees,
  selectedEmployeeId,
  onSelectedEmployeeChange,
  createTask,
}: Props) {
  const [priority, setPriority] =
    useState<TaskPriority>("normal");
  const [status, setStatus] = useState<TaskStatus>("todo");

  const activeEmployees = useMemo(
    () =>
      employees.filter(
        (employee) =>
          (employee.access_status || "active") !== "suspended"
      ),
    [employees]
  );

  const selectedEmployee =
    activeEmployees.find(
      (employee) => employee.id === selectedEmployeeId
    ) || null;

  if (employees.length === 0) {
    return (
      <section className="rounded-2xl border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] p-6 shadow-[var(--shadow-card)]">
        <EmptyState
          title="No employees available"
          text="Invite and activate an employee before assigning work."
        />
      </section>
    );
  }

  return (
    <section
      id="assign-task"
      className="overflow-hidden rounded-2xl border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]"
    >
      <div className="relative border-b border-[color:var(--border)] px-6 py-6">
        <div className="pointer-events-none absolute right-0 top-0 h-44 w-44 rounded-full bg-[color:var(--primary-soft)] blur-3xl" />

        <div className="relative flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
            <TaskIcon />
          </span>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">
              Operational assignment
            </p>

            <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-[color:var(--text-primary)]">
              Assign New Task
            </h2>

            <p className="mt-2 max-w-xl text-xs leading-5 text-[color:var(--text-tertiary)]">
              Create a real employee task with ownership, priority,
              workflow status and a clear deadline.
            </p>
          </div>
        </div>
      </div>

      <form action={createTask} className="space-y-5 p-6">
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <FieldGroup label="Task owner">
              <select
                name="assigned_to"
                value={
                  selectedEmployeeId === "all"
                    ? ""
                    : selectedEmployeeId
                }
                onChange={(event) =>
                  onSelectedEmployeeChange(event.target.value)
                }
                required
                className={fieldClass}
              >
                <option value="">Select employee</option>

                {activeEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name ||
                      employee.email ||
                      "Unnamed Employee"}
                  </option>
                ))}
              </select>
            </FieldGroup>

            <FieldGroup label="Task title">
              <input
                name="title"
                required
                maxLength={160}
                placeholder="e.g. Reconcile June supplier invoices"
                className={fieldClass}
              />
            </FieldGroup>

            <FieldGroup label="Description">
              <textarea
                name="description"
                placeholder="Add expected outcome, context, instructions or review criteria..."
                className={`${fieldClass} min-h-36 resize-y py-3 leading-6`}
              />
            </FieldGroup>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[color:var(--text-muted)]">
                Assignment summary
              </p>

              <div className="mt-4 flex items-center gap-3">
                <Avatar
                  name={
                    selectedEmployee?.full_name ||
                    selectedEmployee?.email ||
                    "Employee"
                  }
                />

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[color:var(--text-primary)]">
                    {selectedEmployee?.full_name ||
                      selectedEmployee?.email ||
                      "No employee selected"}
                  </p>

                  <p className="mt-1 truncate text-[10px] text-[color:var(--text-muted)]">
                    {selectedEmployee?.email ||
                      "Choose an active employee"}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <MiniMetric
                  label="Priority"
                  value={formatLabel(priority)}
                  tone={
                    priority === "high"
                      ? "red"
                      : priority === "low"
                        ? "muted"
                        : "cyan"
                  }
                />

                <MiniMetric
                  label="Initial status"
                  value={formatLabel(status)}
                  tone={
                    status === "done"
                      ? "green"
                      : status === "in_progress"
                        ? "amber"
                        : "muted"
                  }
                />
              </div>
            </div>

            <FieldGroup label="Priority">
              <select
                name="priority"
                value={priority}
                onChange={(event) =>
                  setPriority(
                    event.target.value as TaskPriority
                  )
                }
                className={fieldClass}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </FieldGroup>

            <FieldGroup label="Initial status">
              <select
                name="status"
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value as TaskStatus
                  )
                }
                className={fieldClass}
              >
                <option value="todo">To Do</option>
                <option value="in_progress">
                  In Progress
                </option>
                <option value="done">Done</option>
              </select>
            </FieldGroup>

            <FieldGroup label="Due date">
              <input
                type="date"
                name="due_date"
                min={new Date().toISOString().slice(0, 10)}
                className={fieldClass}
              />
            </FieldGroup>
          </div>
        </div>

        {activeEmployees.length < employees.length && (
          <div className="rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-4 py-3 text-xs leading-5 text-[color:var(--warning)]">
            Suspended employees are excluded from new task
            assignments until their workspace access is restored.
          </div>
        )}

        <div className="flex flex-col justify-between gap-4 border-t border-[color:var(--border)] pt-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-2 text-xs text-[color:var(--text-muted)]">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--primary)]" />
            <p className="max-w-lg leading-5">
              Publishing creates the task, notifies the employee and
              records the assignment in Activity.
            </p>
          </div>

          <button
            type="submit"
            disabled={activeEmployees.length === 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-5 text-xs font-semibold text-[color:var(--primary)] shadow-[var(--shadow-brand)] transition hover:bg-[color:var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PublishIcon />
            Publish Task
          </button>
        </div>
      </form>
    </section>
  );
}

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[9px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
        {label}
      </span>

      {children}
    </label>
  );
}

function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "cyan" | "green" | "amber" | "red" | "muted";
}) {
  const colour = {
    cyan: "text-[color:var(--primary)]",
    green: "text-[color:var(--success)]",
    amber: "text-[color:var(--warning)]",
    red: "text-[color:var(--danger)]",
    muted: "text-[color:var(--text-secondary)]",
  }[tone];

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-3">
      <p className="text-[8px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
        {label}
      </p>

      <p className={`mt-1.5 text-xs font-semibold ${colour}`}>
        {value}
      </p>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-xs font-semibold text-[color:var(--primary)]">
      {initials || "U"}
    </span>
  );
}

function EmptyState({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-10 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
        <TaskIcon />
      </span>

      <p className="mt-4 text-sm font-medium text-[color:var(--text-secondary)]">
        {title}
      </p>

      <p className="mt-2 text-xs text-[color:var(--text-muted)]">{text}</p>
    </div>
  );
}

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

const fieldClass =
  "h-12 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--border-brand)]";

function SvgIcon({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function TaskIcon() {
  return (
    <SvgIcon>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="m8 9 2 2 4-4" />
      <path d="M8 15h8" />
    </SvgIcon>
  );
}

function PublishIcon() {
  return (
    <SvgIcon>
      <path d="M12 21V9" />
      <path d="m7 14 5-5 5 5" />
      <path d="M5 3h14" />
    </SvgIcon>
  );
}