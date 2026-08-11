import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateActivityInput } from "@/types/notifications";

export async function createActivity(
  supabase: SupabaseClient,
  input: CreateActivityInput
) {
  const { error } = await supabase.from("activity_log").insert({
    company_id: input.companyId,
    actor_id: input.actorId || null,
    actor_name: input.actorName || null,
    actor_role: input.actorRole || null,
    target_id: input.targetId || null,
    target_type: input.targetType || null,
    event_type: input.eventType,
    title: input.title,
    description: input.description || null,
    metadata: input.metadata || {},
  });

  return { error };
}