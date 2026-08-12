"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-[var(--button-radius)] border border-[var(--primary-border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--primary)] shadow-[var(--shadow-xs)] transition duration-[var(--duration-fast)] hover:border-[var(--primary)] hover:bg-[var(--primary)] hover:text-[var(--text-on-brand)]"
    >
      Logout
    </button>
  );
}