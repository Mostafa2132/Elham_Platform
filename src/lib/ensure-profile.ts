"use client";

import { type User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

const ADMIN_EMAIL = "12m0stafa7@gmail.com";

export async function ensureProfile(user: User) {
  const supabase = getSupabase();
  const email = user.email ?? "";
  // Get existing profile to avoid overwriting custom data
  const { data: existing } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  const fullName =
    existing?.full_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null;

  const avatarUrl =
    existing?.avatar_url ??
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null;

  const role = existing?.role ?? (email === ADMIN_EMAIL ? "admin" : "user");

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email,
      full_name: fullName,
      avatar_url: avatarUrl,
      role: existing?.role || role, // Preserve existing role, default to logic
    },
    { onConflict: "id" }
  );

  return { error };
}
