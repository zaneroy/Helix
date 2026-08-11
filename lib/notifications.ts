import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateNotificationInput } from "@/types/notifications";

export async function createNotification(
  supabase: SupabaseClient,
  input: CreateNotificationInput
) {
  const { error } = await supabase.from("notifications").insert({
    company_id: input.companyId,
    recipient_id: input.recipientId,
    recipient_role: input.recipientRole || null,
    title: input.title,
    message: input.message || null,
    type: input.type,
    reference_type: input.referenceType || null,
    reference_id: input.referenceId || null,
  });

  return { error };
}

export async function createNotifications(
  supabase: SupabaseClient,
  inputs: CreateNotificationInput[]
) {
  if (!inputs.length) return { error: null };

  const { error } = await supabase.from("notifications").insert(
    inputs.map((input) => ({
      company_id: input.companyId,
      recipient_id: input.recipientId,
      recipient_role: input.recipientRole || null,
      title: input.title,
      message: input.message || null,
      type: input.type,
      reference_type: input.referenceType || null,
      reference_id: input.referenceId || null,
    }))
  );

  return { error };
}