"use client";

import { useMemo, useState } from "react";
import type { AdminEmployee, AdminTask } from "../page";

type ServerAction = (formData: FormData) => void | Promise<void>;

type Props = {
  employees: AdminEmployee[];
  tasks: AdminTask[];
  selectedEmployeeId: string;
  onSelectedEmployeeChange: (employeeId: string) => void;
  updateTask: ServerAction;
  deleteTask: ServerAction;
};

type TaskColumn = {
  id: "todo" | "in_progress" | "done";
  title: string;
  description: string;
};

type ConfirmDeleteState = {
  taskId: string;
  title: string;
} | null;

const columns: TaskColumn[] = [
  {
    id: "todo",
    title: "To Do",
    description: "Ready to begin",
  },
  {
    id: "in_progress",
    title: "In Progress",
    description: "Currently being worked",
  },
  {
    id: "done",
    title: "Done",
    description: "Completed work",
  },
];

export default function TaskBoard({
  employees,
  tasks,
  selectedEmployeeId,
  onSelectedEmployeeChange,
  updateTask,
  deleteTask,
}: Props) {
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<
    "all" | "low" | "normal" | "high"
  >("all");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(
    null
  );
  const [confirmDelete, setConfirmDelete] =
    useState<ConfirmDeleteState>(null);

  const employeeMap = useMemo(
    () =>
      new Map(
        employees.map((employee) => [employee.id, employee])
      ),
    [employees]
  );

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return tasks.filter((task) => {
      const employee = employeeMap.get(task.assigned_to || "");

      const matchesEmployee =
        selectedEmployeeId === "all" ||
        task.assigned_to === selectedEmployeeId;

      const matchesPriority =
        priorityFilter === "all" ||
        (task.priority || "normal") === priorityFilter;

      const matchesQuery =
        !normalizedQuery ||
        `${task.title} ${task.description || ""} ${
          employee?.full_name || ""
        } ${employee?.email || ""}`
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesEmployee && matchesPriority && matchesQuery;
    });
  }, [
    tasks,
    employeeMap,
    query,
    priorityFilter,
    selectedEmployeeId,
  ]);

  const groupedTasks = useMemo(() => {
    return {
      todo: filteredTasks.filter(
        (task) => (task.status || "todo") === "todo"
      ),
      in_progress: filteredTasks.filter(
        (task) => task.status === "in_progress"
      ),
      done: filteredTasks.filter(
        (task) => task.status === "done"
      ),
    };
  }, [filteredTasks]);

  return (
    <section className="overflow-hidden rounded-2xl border border-[color:var(--border-brand)] bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
      <div className="border-b border-[color:var(--border)] p-6">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">
                Task intelligence
              </p>
            </div>

            <h2 className="mt-3 text-xl font-semibold tracking-[-0.025em] text-[color:var(--text-primary)]">
              Employee Task Board
            </h2>

            <p className="mt-2 max-w-2xl text-xs leading-5 text-[color:var(--text-tertiary)]">
              Review task flow, update status, change ownership and
              remove obsolete work from one operational board.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tasks..."
              className="h-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-xs text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--border-brand)]"
            />

            <select
              value={selectedEmployeeId}
              onChange={(event) =>
                onSelectedEmployeeChange(event.target.value)
              }
              className="h-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs text-[color:var(--text-secondary)] outline-none"
            >
              <option value="all">All employees</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name ||
                    employee.email ||
                    "Unnamed Employee"}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(
                  event.target.value as
                    | "all"
                    | "low"
                    | "normal"
                    | "high"
                )
              }
              className="h-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs text-[color:var(--text-secondary)] outline-none"
            >
              <option value="all">All priorities</option>
              <option value="high">High priority</option>
              <option value="normal">Normal priority</option>
              <option value="low">Low priority</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-px bg-[color:var(--surface-soft)] xl:grid-cols-3">
        {columns.map((column) => {
          const columnTasks = groupedTasks[column.id];

          return (
            <div
              key={column.id}
              className="min-h-[520px] bg-[color:var(--surface)] p-4"
            >
              <div className="flex items-start justify-between gap-4 px-1 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <ColumnDot status={column.id} />
                    <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">
                      {column.title}
                    </h3>
                  </div>

                  <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">
                    {column.description}
                  </p>
                </div>

                <span className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2.5 py-1 text-[10px] font-medium text-[color:var(--text-tertiary)]">
                  {columnTasks.length}
                </span>
              </div>

              <div className="space-y-3">
                {columnTasks.length > 0 ? (
                  columnTasks.map((task) => {
                    const employee = employeeMap.get(
                      task.assigned_to || ""
                    );

                    return (
                      <TaskCard
                        key={task.id}
                        task={task}
                        employee={employee || null}
                        employees={employees}
                        editing={editingTaskId === task.id}
                        onEdit={() => setEditingTaskId(task.id)}
                        onCancelEdit={() =>
                          setEditingTaskId(null)
                        }
                        updateTask={updateTask}
                        onDelete={() =>
                          setConfirmDelete({
                            taskId: task.id,
                            title: task.title,
                          })
                        }
                      />
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] p-8 text-center">
                    <p className="text-xs text-[color:var(--text-muted)]">
                      No tasks in this stage.
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {confirmDelete && (
        <DeleteTaskModal
          state={confirmDelete}
          deleteTask={deleteTask}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </section>
  );
}

function TaskCard({
  task,
  employee,
  employees,
  editing,
  onEdit,
  onCancelEdit,
  updateTask,
  onDelete,
}: {
  task: AdminTask;
  employee: AdminEmployee | null;
  employees: AdminEmployee[];
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  updateTask: ServerAction;
  onDelete: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  const overdue =
    Boolean(task.due_date) &&
    String(task.due_date) < today &&
    task.status !== "done";

  if (editing) {
    return (
      <form
        action={updateTask}
        className="rounded-2xl border border-[color:var(--border-brand)] bg-[color:var(--surface-soft)] p-4"
      >
        <input type="hidden" name="id" value={task.id} />

        <label className="block">
          <span className={labelClass}>Task title</span>
          <input
            name="title"
            defaultValue={task.title}
            required
            className={fieldClass}
          />
        </label>

        <label className="mt-3 block">
          <span className={labelClass}>Employee</span>
          <select
            name="assigned_to"
            defaultValue={task.assigned_to || ""}
            required
            className={fieldClass}
          >
            <option value="">Select employee</option>
            {employees.map((item) => (
              <option key={item.id} value={item.id}>
                {item.full_name ||
                  item.email ||
                  "Unnamed Employee"}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block">
          <span className={labelClass}>Description</span>
          <textarea
            name="description"
            defaultValue={task.description || ""}
            className={`${fieldClass} min-h-24 resize-y py-3`}
          />
        </label>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Status</span>
            <select
              name="status"
              defaultValue={task.status || "todo"}
              className={fieldClass}
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </label>

          <label className="block">
            <span className={labelClass}>Priority</span>
            <select
              name="priority"
              defaultValue={task.priority || "normal"}
              className={fieldClass}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        <label className="mt-3 block">
          <span className={labelClass}>Due date</span>
          <input
            type="date"
            name="due_date"
            defaultValue={task.due_date || ""}
            className={fieldClass}
          />
        </label>

        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            className="h-10 flex-1 rounded-xl border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-4 text-xs font-semibold text-[color:var(--primary)] transition hover:bg-[color:var(--primary-soft)]"
          >
            Save Changes
          </button>

          <button
            type="button"
            onClick={onCancelEdit}
            className="h-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-xs font-medium text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <article className="group rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 transition hover:border-[color:var(--border-brand)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5 text-[color:var(--text-primary)]">
            {task.title}
          </p>

          <p className="mt-1 truncate text-[10px] text-[color:var(--primary)]">
            {employee?.full_name ||
              employee?.email ||
              "Unknown employee"}
          </p>
        </div>

        <PriorityBadge
          priority={task.priority || "normal"}
        />
      </div>

      {task.description && (
        <p className="mt-3 line-clamp-3 text-xs leading-5 text-[color:var(--text-tertiary)]">
          {task.description}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniMetric
          label="Due"
          value={formatDate(task.due_date)}
          alert={overdue}
        />

        <MiniMetric
          label="Created"
          value={formatDate(task.created_at)}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={task.status || "todo"} />

        {overdue && (
          <span className="rounded-full border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[color:var(--danger)]">
            Overdue
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 border-t border-[color:var(--border)] pt-3">
        <button
          type="button"
          onClick={onEdit}
          className="h-9 rounded-lg border border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] px-3 text-[10px] font-medium text-[color:var(--primary)] transition hover:bg-[color:var(--primary-soft)]"
        >
          Edit
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="h-9 rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-3 text-[10px] font-medium text-[color:var(--danger)] transition hover:bg-[color:var(--danger-soft)]"
        >
          Delete
        </button>
      </div>
    </article>
  );
}

function DeleteTaskModal({
  state,
  deleteTask,
  onClose,
}: {
  state: Exclude<ConfirmDeleteState, null>;
  deleteTask: ServerAction;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-[color:var(--overlay-strong)] px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[color:var(--danger-border)] bg-[image:var(--gradient-panel)] shadow-[var(--shadow-card)]">
        <div className="border-b border-[color:var(--border)] px-6 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--danger)]">
            Permanent task removal
          </p>

          <h3 className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">
            Delete this task?
          </h3>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
            This removes the task from the employee workflow and
            records the deletion in Activity.
          </p>

          <div className="mt-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-3">
            <p className="text-sm font-medium text-[color:var(--text-primary)]">
              {state.title}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-[color:var(--border)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-xs font-medium text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
          >
            Keep Task
          </button>

          <form action={deleteTask}>
            <input
              type="hidden"
              name="id"
              value={state.taskId}
            />

            <button
              type="submit"
              className="h-10 rounded-xl border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-4 text-xs font-semibold text-[color:var(--danger)] transition hover:bg-[color:var(--danger-soft)]"
            >
              Delete Task
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const fieldClass =
  "mt-2 h-10 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs text-[color:var(--text-primary)] outline-none focus:border-[color:var(--border-brand)]";

const labelClass =
  "text-[9px] uppercase tracking-[0.11em] text-[color:var(--text-muted)]";

function ColumnDot({
  status,
}: {
  status: "todo" | "in_progress" | "done";
}) {
  const colour =
    status === "done"
      ? "bg-[color:var(--success)]"
      : status === "in_progress"
        ? "bg-[color:var(--warning)]"
        : "bg-[color:var(--surface)]";

  return <span className={`h-2 w-2 rounded-full ${colour}`} />;
}

function MiniMetric({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2.5">
      <p className="text-[8px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
        {label}
      </p>
      <p
        className={`mt-1 text-[10px] font-medium ${
          alert ? "text-[color:var(--danger)]" : "text-[color:var(--text-secondary)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === "done"
      ? "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
      : status === "in_progress"
        ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
        : "border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)]";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] ${style}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function PriorityBadge({
  priority,
}: {
  priority: string;
}) {
  const style =
    priority === "high"
      ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
      : priority === "low"
        ? "border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-tertiary)]"
        : "border-[color:var(--border-brand)] bg-[color:var(--primary-soft)] text-[color:var(--primary)]";

  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] ${style}`}
    >
      {priority}
    </span>
  );
}

function formatDate(value: string | null) {
  if (!value) return "No date";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}