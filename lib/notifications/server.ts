import { createClient } from "@/lib/supabase/server";

export async function getUserNotifications(userId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  return data || [];
}