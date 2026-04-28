"use client";

import { useEffect } from "react";
import { getSupabase } from "@/lib/supabase";
import { ensureProfile } from "@/lib/ensure-profile";
import { useAuthStore } from "@/store/auth-store";
import type { Profile } from "@/types";

const PROFILE_FIELDS = "id,email,full_name,username,avatar_url,cover_url,bio,location,website,twitter,instagram,github,role,created_at";

export function useAuthSession() {
  const { setUser, setProfile, setLoading } = useAuthStore();
  const supabase = getSupabase();

  useEffect(() => {
    let active = true;

    const fetchProfile = async (userId: string): Promise<Profile | null> => {
      const { data } = await supabase
        .from("profiles")
        .select(PROFILE_FIELDS)
        .eq("id", userId)
        .single();
      return (data as Profile | null) ?? null;
    };

    const load = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!active) return;
      setUser(user ?? null);

      if (user) {
        await ensureProfile(user);
        const profile = await fetchProfile(user.id);
        if (!active) return;
        setProfile(profile);
      } else {
        setProfile(null);
      }

      setLoading(false);
    };

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (!session?.user) {
          setProfile(null);
          return;
        }
        await ensureProfile(session.user);
        const profile = await fetchProfile(session.user.id);
        setProfile(profile);
      }
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [setLoading, setProfile, setUser, supabase]);
}
