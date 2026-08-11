"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationRead(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const notificationId = String(formData.get("notification_id") || "");

  await supabase
    .from("notifications")
    .update({
      read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .eq("recipient_id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/investors");
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard/settings");
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from("notifications")
    .update({
      read: true,
      read_at: new Date().toISOString(),
    })
    .eq("recipient_id", user.id)
    .eq("read", false);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/investors");
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard/settings");
}