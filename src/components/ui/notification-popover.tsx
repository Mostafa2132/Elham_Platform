"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiBell, FiCheck, FiTrash2, FiHeart, FiShield, FiUserPlus, FiChevronRight } from "react-icons/fi";
import { getSupabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";
import { Avatar } from "@/components/ui/avatar";
import { type Locale } from "@/types";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  user_id: string;
  type: string;
  content: string;
  is_read: boolean;
  created_at: string;
  actor_id: string;
  target_id?: string;
  actor?: {
    full_name: string;
    avatar_url: string;
    username: string;
  };
}

export function NotificationPopover({ locale }: { locale: Locale }) {
  const supabase = getSupabase();
  const router = useRouter();
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const isAr = locale === "ar";

  const timeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (seconds < 60) return isAr ? "الآن" : "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return isAr ? `منذ ${minutes} دقيقة` : `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return isAr ? `منذ ${hours} ساعة` : `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return isAr ? `منذ ${days} أيام` : `${days}d ago`;
    
    return then.toLocaleDateString(locale);
  };

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("*, actor:actor_id(full_name, avatar_url, username)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) console.error("Error fetching notifications:", error);
    else {
      const rows = data || [];
      setNotifications(rows);
      setUnreadCount(rows.filter(n => !n.is_read).length);
    }
    setLoading(false);
  };

  const fetchUnreadCount = async () => {
    if (!user) return;
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("is_read", "is", true);

    if (error) {
      console.error("Error fetching unread notifications count:", error);
      return;
    }
    setUnreadCount(count ?? 0);
  };

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    fetchUnreadCount();

    const channel = supabase
      .channel(`notifications-realtime`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const newNotif = payload.new as Notification;
          if (newNotif.user_id === user.id) {
            setUnreadCount((prev) => prev + 1);
            if (open) fetchNotifications();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, open]);

  const markAsRead = async (id: string) => {
    const target = notifications.find(n => n.id === id);
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      if (target && !target.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .not("is_read", "is", true);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const deleteNotification = async (id: string) => {
    const target = notifications.find(n => n.id === id);
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);

    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (target && !target.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.is_read) markAsRead(notif.id);
    setOpen(false);

    if (notif.type === "like" || notif.type === "seal_approved" || notif.type === "seal_rejected") {
      if (notif.target_id) {
        // We can't jump directly to a post in feed easily without a dedicated post page, 
        // but we can scroll to it or go to profile. For now, let's go to profile or home.
        // If there's a post modal or page, we'd go there.
        router.push(`/${locale}/profile`);
      }
    } else if (notif.type === "follow") {
      router.push(`/${locale}/profile/${notif.actor?.username || ""}`);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "like": return <FiHeart className="text-rose-500" />;
      case "follow": return <FiUserPlus className="text-blue-500" />;
      case "seal_approved": return <FiShield className="text-emerald-500" />;
      case "seal_rejected": return <FiShield className="text-rose-500" />;
      default: return <FiBell className="text-amber-500" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="btn-ghost rounded-full p-2 relative group"
        aria-label="Notifications"
      >
        <FiBell size={18} className={unreadCount > 0 ? "animate-swing" : ""} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-[var(--bg)]">
            {unreadCount > 9 ? "+9" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div 
              className="fixed inset-0 z-40 bg-black/5" 
              onClick={() => setOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={`fixed top-[74px] left-2 right-2 z-50 w-auto bg-[var(--bg-soft)] backdrop-blur-2xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-[var(--border-hover)] overflow-hidden sm:absolute sm:top-full sm:left-auto sm:right-0 sm:mt-2 sm:w-96 ${isAr ? "sm:right-0" : "sm:right-0"}`}
            >
              <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-black/5 dark:bg-white/5">
                <h3 className="font-bold text-sm text-[var(--text)]">{isAr ? "التنبيهات" : "Notifications"}</h3>
                <button 
                  onClick={markAllAsRead}
                  className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {isAr ? "تحديد الكل كمقروء" : "Mark all as read"}
                </button>
              </div>

              <div className="max-h-[400px] overflow-y-auto no-scrollbar">
                {loading && notifications.length === 0 ? (
                  <div className="p-8 text-center text-muted text-sm italic">
                    {isAr ? "جاري التحميل..." : "Loading..."}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <FiBell size={32} className="mx-auto text-white/5" />
                    <p className="text-muted text-sm font-medium">
                      {isAr ? "لا توجد تنبيهات بعد" : "No notifications yet"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {notifications.map((n) => (
                      <div 
                        key={n.id} 
                        className={`group relative flex gap-3 p-4 transition-all hover:bg-[var(--bg)]/40 ${!n.is_read ? "bg-indigo-500/10" : ""}`}
                      >
                        <div className="shrink-0 cursor-pointer" onClick={() => handleNotificationClick(n)}>
                          <Avatar src={n.actor?.avatar_url} name={n.actor?.full_name || "User"} size={42} />
                        </div>
                        
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleNotificationClick(n)}>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="p-1 rounded-md bg-white/5 text-[10px]">
                              {getIcon(n.type)}
                            </span>
                            <span className="text-[10px] text-muted font-bold uppercase tracking-tighter">
                              {timeAgo(n.created_at)}
                            </span>
                          </div>
                          <p className="text-xs leading-relaxed">
                            <span className="font-bold text-[var(--text)]">{n.actor?.full_name || (isAr ? "مستخدم" : "User")}</span>
                            {" "}
                            {n.content}
                          </p>
                        </div>

                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!n.is_read && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                              className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10"
                              title={isAr ? "تحديد كمقروء" : "Mark as read"}
                            >
                              <FiCheck size={14} />
                            </button>
                          )}
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                            className="p-1.5 rounded-lg text-muted hover:text-rose-500 hover:bg-rose-500/10"
                            title={isAr ? "حذف" : "Delete"}
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>

                        {!n.is_read && (
                          <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-full" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @keyframes swing {
          0% { transform: rotate(0deg); }
          20% { transform: rotate(15deg); }
          40% { transform: rotate(-10deg); }
          60% { transform: rotate(5deg); }
          80% { transform: rotate(-5deg); }
          100% { transform: rotate(0deg); }
        }
        .animate-swing {
          animation: swing 1s ease-in-out infinite;
          transform-origin: top center;
        }
      `}</style>
    </div>
  );
}
