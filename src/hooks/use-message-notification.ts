"use client";

import { useEffect, useRef } from "react";
import { getSupabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";
import { useInteractionStore } from "@/store/interaction-store";

/**
 * Hook to handle real-time message notifications globally.
 * It listens for new messages where the current user is the receiver
 * and increments the unread count in the interaction store.
 */
export function useMessageNotification() {
  const { user } = useAuthStore();
  const { incrementUnreadForUser, setUnreadCounts } = useInteractionStore();
  const supabase = getSupabase();
  const processedMessages = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    // 1. Initial Load: Fetch unread counts from Supabase
    const fetchInitialUnread = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("sender_id")
        .eq("receiver_id", user.id)
        .eq("is_read", false);

      if (!error && data) {
        // Group by sender and set counts
        const counts: Record<string, number> = {};
        data.forEach((msg) => {
          counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
        });
        
        setUnreadCounts(counts);
      }
    };

    fetchInitialUnread();

    // 2. Real-time Subscription: Listen for new messages
    const channel = supabase
      .channel("global-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          const newMsg = payload.new;
          
          // منع التكرار باستخدام معرف الرسالة
          if (processedMessages.current.has(newMsg.id)) return;
          processedMessages.current.add(newMsg.id);
          // تنظيف الذاكرة كل فترة
          if (processedMessages.current.size > 100) processedMessages.current.clear();

          const { activeChatId } = useInteractionStore.getState();
          if (newMsg.sender_id !== user.id && newMsg.sender_id !== activeChatId) {
            incrementUnreadForUser(newMsg.sender_id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]); // الاعتماد على ID المستخدم فقط لضمان عدم تكرار التشغيل
}
