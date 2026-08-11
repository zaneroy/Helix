export type ActivityEventType =
  | "task_assigned"
  | "task_updated"
  | "task_completed"
  | "task_deleted"
  | "expense_created"
  | "expense_approved"
  | "expense_rejected"
  | "sale_created"
  | "sale_confirmed"
  | "investor_request"
  | "capital_approved"
  | "capital_rejected"
  | "capital_completed"
  | "document_shared"
  | "document_viewed"
  | "report_published"
  | "announcement"
  | "employee_invited"
  | "investor_invited"
  | "employee_suspended"
  | "investor_suspended"
  | "employee_removed"
  | "investor_removed"
  | "password_reset"
  | "note_added";

export type ActivityLog = {
  id: string;
  company_id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  target_id: string | null;
  target_type: string | null;
  event_type: ActivityEventType | string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

export type Notification = {
  id: string;
  company_id: string;
  recipient_id: string | null;
  recipient_role: string | null;
  title: string;
  message: string | null;
  type: ActivityEventType | string;
  reference_type: string | null;
  reference_id: string | null;
  read: boolean | null;
  created_at: string | null;
  read_at: string | null;
};

export type CreateActivityInput = {
  companyId: string;
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  targetId?: string | null;
  targetType?: string | null;
  eventType: ActivityEventType | string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
};

export type CreateNotificationInput = {
  companyId: string;
  recipientId: string;
  recipientRole?: string | null;
  title: string;
  message?: string | null;
  type: ActivityEventType | string;
  referenceType?: string | null;
  referenceId?: string | null;
};