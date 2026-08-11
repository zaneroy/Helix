"use server";

import { createClient } from "@/lib/supabase/server";

export type EventActorRole =
  | "admin"
  | "employee"
  | "investor"
  | "system";

export type EventSeverity =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "critical";

type NotificationAudience = {
  recipientIds?: string[];
  roles?: Exclude<EventActorRole, "system">[];
  title?: string;
  message?: string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
  excludeActor?: boolean;
};

type EmitEventInput = {
  companyId: string;
  actorId?: string | null;
  actorRole?: EventActorRole;

  type: string;
  title: string;
  message: string;

  recipients?: string[];
  recipientRoles?: Exclude<EventActorRole, "system">[];
  notifications?: NotificationAudience[];

  actionUrl?: string | null;
  metadata?: Record<string, unknown>;

  referenceType?: string | null;
  referenceId?: string | null;
  severity?: EventSeverity;
};

type ResolvedActor = {
  role: EventActorRole;
  name: string | null;
  email: string | null;
};

type NotificationInsert = {
  company_id: string;
  recipient_id: string;
  recipient_role: string;
  actor_id: string | null;
  type: string;
  title: string;
  message: string;
  reference_type: string | null;
  reference_id: string | null;
  action_url: string | null;
  metadata: Record<string, unknown>;
  read: boolean;
};

function isEventActorRole(value: unknown): value is EventActorRole {
  return (
    value === "admin" ||
    value === "employee" ||
    value === "investor" ||
    value === "system"
  );
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function cleanText(value: string | null | undefined) {
  const text = String(value || "").trim();
  return text.length > 0 ? text : null;
}

function inferSeverity(type: string): EventSeverity {
  const value = type.toLowerCase();

  if (
    value.includes("critical") ||
    value.includes("failed") ||
    value.includes("error")
  ) {
    return "error";
  }

  if (
    value.includes("deleted") ||
    value.includes("cancelled") ||
    value.includes("rejected") ||
    value.includes("overdue") ||
    value.includes("low_stock") ||
    value.includes("suspended")
  ) {
    return "warning";
  }

  if (
    value.includes("created") ||
    value.includes("added") ||
    value.includes("recorded") ||
    value.includes("approved") ||
    value.includes("completed") ||
    value.includes("paid") ||
    value.includes("sent") ||
    value.includes("restored")
  ) {
    return "success";
  }

  return "info";
}

async function resolveActor({
  actorId,
  actorRole,
}: {
  actorId: string | null;
  actorRole?: EventActorRole;
}): Promise<ResolvedActor> {
  if (!actorId) {
    return {
      role: actorRole || "system",
      name: null,
      email: null,
    };
  }

  const supabase = await createClient();

  const { data: actor, error } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", actorId)
    .maybeSingle();

  if (error) {
    console.error("[emitEvent] Unable to resolve actor:", error);
  }

  return {
    role: isEventActorRole(actor?.role)
      ? actor.role
      : actorRole || "system",
    name: actor?.full_name || null,
    email: actor?.email || null,
  };
}

async function resolveRoleRecipients({
  companyId,
  roles,
}: {
  companyId: string;
  roles: Exclude<EventActorRole, "system">[];
}) {
  if (roles.length === 0) return [];

  const supabase = await createClient();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("company_id", companyId)
    .in("role", roles)
    .neq("access_status", "inactive");

  if (error) {
    console.error(
      "[emitEvent] Unable to resolve role recipients:",
      error
    );
    return [];
  }

  return uniqueStrings((profiles || []).map((profile) => profile.id));
}

async function getRecipientRole(recipientId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", recipientId)
    .maybeSingle();

  return typeof data?.role === "string" ? data.role : "admin";
}

export async function emitEvent({
  companyId,
  actorId = null,
  actorRole,
  type,
  title,
  message,
  recipients = [],
  recipientRoles = [],
  notifications = [],
  actionUrl = null,
  metadata = {},
  referenceType = null,
  referenceId = null,
  severity,
}: EmitEventInput) {
  const supabase = await createClient();

  const normalizedCompanyId = cleanText(companyId);
  const normalizedType = cleanText(type);
  const normalizedTitle = cleanText(title);
  const normalizedMessage = cleanText(message);

  if (
    !normalizedCompanyId ||
    !normalizedType ||
    !normalizedTitle ||
    !normalizedMessage
  ) {
    console.error("[emitEvent] Missing required event fields.");
    return {
      success: false as const,
      activityId: null,
      error: "Missing required event fields.",
    };
  }

  const actor = await resolveActor({
    actorId,
    actorRole,
  });

  const eventMetadata: Record<string, unknown> = {
    ...metadata,
    actorRole: actor.role,
    actorName: actor.name,
    actorEmail: actor.email,
  };

  /*
   * Create one canonical activity row first.
   *
   * This uses the correct plural table: activity_logs.
   * Notifications are then linked back to this activity row through
   * metadata.activity_log_id, so the database mirroring trigger skips
   * them and does not create duplicates.
   */
  const { data: activityRow, error: activityError } = await supabase
    .from("activity_logs")
    .insert({
      company_id: normalizedCompanyId,
      actor_id: actorId,
      actor_role: actor.role,
      event_type: normalizedType,
      title: normalizedTitle,
      description: normalizedMessage,
      reference_type: cleanText(referenceType),
      reference_id: cleanText(referenceId),
      action_url: cleanText(actionUrl),
      severity: severity || inferSeverity(normalizedType),
      metadata: eventMetadata,
    })
    .select("id")
    .single();

  if (activityError || !activityRow?.id) {
    console.error(
      "[emitEvent] Activity log insert failed:",
      activityError
    );

    return {
      success: false as const,
      activityId: null,
      error:
        activityError?.message ||
        "Unable to create the activity record.",
    };
  }

  const activityId = String(activityRow.id);

  const notificationRows = new Map<string, NotificationInsert>();

  const defaultRoleRecipientIds = await resolveRoleRecipients({
    companyId: normalizedCompanyId,
    roles: uniqueStrings(recipientRoles) as Exclude<
      EventActorRole,
      "system"
    >[],
  });

  const defaultRecipients = uniqueStrings([
    ...recipients,
    ...defaultRoleRecipientIds,
  ]);

  for (const recipientId of defaultRecipients) {
    notificationRows.set(recipientId, {
      company_id: normalizedCompanyId,
      recipient_id: recipientId,
      recipient_role: await getRecipientRole(recipientId),
      actor_id: actorId,
      type: normalizedType,
      title: normalizedTitle,
      message: normalizedMessage,
      reference_type: cleanText(referenceType),
      reference_id: cleanText(referenceId),
      action_url: cleanText(actionUrl),
      metadata: {
        ...eventMetadata,
        activity_log_id: activityId,
      },
      read: false,
    });
  }

  for (const audience of notifications) {
    const audienceRoles = uniqueStrings(
      audience.roles || []
    ) as Exclude<EventActorRole, "system">[];

    const roleRecipientIds = await resolveRoleRecipients({
      companyId: normalizedCompanyId,
      roles: audienceRoles,
    });

    let audienceRecipientIds = uniqueStrings([
      ...(audience.recipientIds || []),
      ...roleRecipientIds,
    ]);

    if (audience.excludeActor && actorId) {
      audienceRecipientIds = audienceRecipientIds.filter(
        (recipientId) => recipientId !== actorId
      );
    }

    for (const recipientId of audienceRecipientIds) {
      notificationRows.set(recipientId, {
        company_id: normalizedCompanyId,
        recipient_id: recipientId,
        recipient_role: await getRecipientRole(recipientId),
        actor_id: actorId,
        type: normalizedType,
        title: cleanText(audience.title) || normalizedTitle,
        message: cleanText(audience.message) || normalizedMessage,
        reference_type: cleanText(referenceType),
        reference_id: cleanText(referenceId),
        action_url:
          audience.actionUrl === undefined
            ? cleanText(actionUrl)
            : cleanText(audience.actionUrl),
        metadata: {
          ...eventMetadata,
          ...(audience.metadata || {}),
          activity_log_id: activityId,
        },
        read: false,
      });
    }
  }

  if (notificationRows.size > 0) {
    const { error: notificationError } = await supabase
      .from("notifications")
      .insert(Array.from(notificationRows.values()));

    if (notificationError) {
      console.error(
        "[emitEvent] Notification insert failed:",
        notificationError
      );

      return {
        success: false as const,
        activityId,
        error: notificationError.message,
      };
    }
  }

  return {
    success: true as const,
    activityId,
    error: null,
  };
}