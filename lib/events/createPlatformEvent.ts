import { createClient } from "@/lib/supabase/server";

export type PlatformEventSeverity =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "critical";

export type PlatformEventRecipientRole =
  | "admin"
  | "employee"
  | "investor"
  | string;

export type PlatformEventInput = {
  companyId: string;

  eventType: string;
  title: string;

  description?: string | null;

  referenceType?: string | null;
  referenceId?: string | null;

  actionUrl?: string | null;

  severity?: PlatformEventSeverity;

  metadata?: Record<string, unknown>;

  createNotification?: boolean;

  recipientId?: string | null;
  recipientRole?: PlatformEventRecipientRole | null;

  actorId?: string | null;
  actorRole?: string | null;
};

export type PlatformEventResult =
  | {
      success: true;
      activityId: string;
    }
  | {
      success: false;
      activityId: null;
      error: string;
    };

/**
 * Creates one standardised Helix platform event.
 *
 * The database function writes to:
 * - activity_logs
 * - notifications, when createNotification is true
 *
 * This should become the central event helper used throughout:
 * - Sales
 * - Expenses
 * - Products
 * - Accounts
 * - Customers
 * - Invoices
 * - Team
 * - Investors
 * - Reports
 * - Documents
 */
export async function createPlatformEvent(
  input: PlatformEventInput
): Promise<PlatformEventResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return {
        success: false,
        activityId: null,
        error: authError.message,
      };
    }

    if (!user) {
      return {
        success: false,
        activityId: null,
        error: "Authentication required.",
      };
    }

    const eventType = input.eventType.trim();
    const title = input.title.trim();

    if (!input.companyId) {
      return {
        success: false,
        activityId: null,
        error: "A company ID is required.",
      };
    }

    if (!eventType) {
      return {
        success: false,
        activityId: null,
        error: "An event type is required.",
      };
    }

    if (!title) {
      return {
        success: false,
        activityId: null,
        error: "An event title is required.",
      };
    }

    const actorId = input.actorId ?? user.id;

    let actorRole = input.actorRole?.trim() || null;

    if (!actorRole) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", actorId)
        .maybeSingle();

      actorRole =
        typeof profile?.role === "string"
          ? profile.role
          : null;
    }

    const { data, error } = await supabase.rpc(
      "create_platform_event",
      {
        p_company_id: input.companyId,
        p_actor_id: actorId,
        p_actor_role: actorRole,
        p_event_type: eventType,
        p_title: title,
        p_description:
          cleanOptionalText(input.description) ?? null,
        p_reference_type:
          cleanOptionalText(input.referenceType) ?? null,
        p_reference_id: input.referenceId ?? null,
        p_action_url:
          cleanOptionalText(input.actionUrl) ?? null,
        p_severity: input.severity ?? "info",
        p_metadata: input.metadata ?? {},
        p_create_notification:
          input.createNotification ?? true,
        p_recipient_id:
          input.recipientId ?? user.id,
        p_recipient_role:
          input.recipientRole ?? "admin",
      }
    );

    if (error) {
      console.error(
        "[createPlatformEvent] Database error:",
        error
      );

      return {
        success: false,
        activityId: null,
        error: error.message,
      };
    }

    if (!data || typeof data !== "string") {
      return {
        success: false,
        activityId: null,
        error:
          "The event was created but no activity ID was returned.",
      };
    }

    return {
      success: true,
      activityId: data,
    };
  } catch (error) {
    console.error(
      "[createPlatformEvent] Unexpected error:",
      error
    );

    return {
      success: false,
      activityId: null,
      error:
        error instanceof Error
          ? error.message
          : "Unable to create the platform event.",
    };
  }
}

/**
 * Throws when event creation fails.
 *
 * Use this when creating the event is required for the operation
 * to be considered successful.
 */
export async function createRequiredPlatformEvent(
  input: PlatformEventInput
): Promise<string> {
  const result = await createPlatformEvent(input);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.activityId;
}

/**
 * Creates an event without breaking the main business operation.
 *
 * Use this after a sale, expense, invoice or similar operation
 * has already succeeded. Event failure will be logged, but it
 * will not cause the financial operation to fail.
 */
export async function createBackgroundPlatformEvent(
  input: PlatformEventInput
): Promise<void> {
  const result = await createPlatformEvent(input);

  if (!result.success) {
    console.error(
      `[createBackgroundPlatformEvent] ${input.eventType}:`,
      result.error
    );
  }
}

function cleanOptionalText(
  value: string | null | undefined
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}