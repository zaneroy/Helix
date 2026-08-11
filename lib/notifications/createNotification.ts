"use server";

import { createClient } from "@/lib/supabase/server";

type CreateNotificationInput = {
  recipientId: string;
  companyId: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string | null;
};

export async function createNotification({
  recipientId,
  companyId,
  type,
  title,
  message,
  actionUrl,
}: CreateNotificationInput) {
  const supabase = await createClient();

  await supabase.from("notifications").insert({
    recipient_id: recipientId,
    company_id: companyId,
    type,
    title,
    message,
    action_url: actionUrl ?? null,
    read: false,
  });
}