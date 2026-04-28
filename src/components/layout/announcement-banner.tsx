"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiBell } from "react-icons/fi";
import { getSupabase } from "@/lib/supabase";
import { type Announcement } from "@/types";

export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = getSupabase();

    const load = async () => {
      const { data } = await supabase
        .from("announcements")
        .select("id,message,active,created_at")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (data) {
        const stored = JSON.parse(localStorage.getItem("elham-dismissed-announcements") ?? "[]");
        setDismissed(new Set(stored));
        setAnnouncement(data as Announcement);
      }
    };

    load();

    // Realtime subscription
    const channel = supabase
      .channel("announcements-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const dismiss = (id: string) => {
    const newSet = new Set([...dismissed, id]);
    setDismissed(newSet);
    localStorage.setItem("elham-dismissed-announcements", JSON.stringify([...newSet]));
  };

  const visible = announcement && !dismissed.has(announcement.id);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="announcement-banner"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <FiBell size={15} className="shrink-0" />
          <span className="text-sm font-medium">{announcement!.message}</span>
          <button
            onClick={() => dismiss(announcement!.id)}
            className="ml-2 rounded-full p-1 hover:bg-white/20 transition-colors"
            aria-label="Dismiss announcement"
          >
            <FiX size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
