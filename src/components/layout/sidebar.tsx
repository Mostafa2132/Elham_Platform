"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  FiHome, FiUser, FiShield, FiPlusCircle, FiTrendingUp, FiStar, FiSpeaker, FiPower, FiWind, FiAward, FiBookOpen, FiMessageSquare
} from "react-icons/fi";
import { toast } from "react-toastify";
import { getSupabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";
import { useInteractionStore } from "@/store/interaction-store";
import { AdCard } from "@/components/ads/ad-card";
import { AdSkeleton } from "@/components/ui/skeletons";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { translations } from "@/data/translations";
import { getBadge } from "@/lib/constants";
import { type Ad, type Locale } from "@/types";

/**
 * مكون القائمة الجانبية (Sidebar)
 * يحتوي على روابط التنقل، التريندات، الإعلانات، ومعلومات المستخدم
 */
export function Sidebar({ locale }: { locale: string }) {
  const { user, profile } = useAuthStore();
  const unreadChatCount = useInteractionStore(state => state.getGlobalUnreadCount());
  const { pendingRequestsCount, pendingReportsCount, setPendingCounts } = useInteractionStore();
  const adminNotificationCount = pendingRequestsCount + pendingReportsCount;
  const pathname = usePathname();
  const router = useRouter();
  const isAr = locale === "ar";
  
  // حالات تخزين البيانات (Ads, Trends, Stats)
  const [ads, setAds] = useState<Ad[]>([]);
  const [adsLoading, setAdsLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [trends, setTrends] = useState<{ tag: string; count: number; growth: string }[]>([]);
  const [stats, setStats] = useState({ inspirations: 0, masters: 0 });
  
  const t = translations[locale as Locale] || translations.en;
  const supabase = getSupabase();

  // تحميل بيانات القائمة الجانبية عند تحميل المكون
  useEffect(() => {
    const loadSidebarData = async () => {
      // 1. تحميل الإعلانات المخصصة للقائمة الجانبية
      const { data: adsData } = await supabase
        .from("ads")
        .select("*")
        .eq("active", true)
        .in("placement", ["sidebar", "both"]);
      setAds((adsData ?? []) as Ad[]);
      setAdsLoading(false);

      // 2. تحميل التريندات (أكثر الهاشتاجات تداولاً) وإحصائيات المجتمع
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      const [
        { data: recentPosts },
        { count: dailyInspirations },
        { count: activeMasters }
      ] = await Promise.all([
        supabase.from("posts").select("content").limit(100).order("created_at", { ascending: false }),
        supabase.from("posts").select("*", { count: "exact", head: true }).gt("created_at", yesterday),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_pro", true)
      ]);

      setStats({
        inspirations: dailyInspirations ?? 0,
        masters: activeMasters ?? 0
      });

      // تحليل المحتوى لاستخراج الهاشتاجات (Tags)
      if (recentPosts) {
        const tagMap: Record<string, number> = {};
        recentPosts.forEach(p => {
          const tags = p.content.match(/#[\w\u0621-\u064A]+/g);
          tags?.forEach((tag: string) => {
            tagMap[tag] = (tagMap[tag] || 0) + 1;
          });
        });

        const sortedTrends = Object.entries(tagMap)
          .map(([tag, count]) => ({ tag, count, growth: "+new" }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        
      setTrends(sortedTrends);
      }

      // 3. Load Admin Pending Counts if user is admin
      if (profile?.role === "admin") {
        const [{ count: reqCount }, { count: repCount }] = await Promise.all([
          supabase.from("posts").select("*", { count: "exact", head: true }).eq("seal_requested", true).eq("is_authentic", false),
          supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending")
        ]);
        setPendingCounts(reqCount ?? 0, repCount ?? 0);
      }
    };

    loadSidebarData();

    // 4. Real-time subscription for admin counts
    let channel: any;
    if (profile?.role === "admin") {
      channel = supabase
        .channel("admin-sidebar-counts")
        .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, async () => {
          const { count } = await supabase.from("posts").select("*", { count: "exact", head: true }).eq("seal_requested", true).eq("is_authentic", false);
          setPendingCounts(count ?? 0, useInteractionStore.getState().pendingReportsCount);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, async () => {
          const { count } = await supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending");
          setPendingCounts(useInteractionStore.getState().pendingRequestsCount, count ?? 0);
        })
        .subscribe();
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, profile?.role, setPendingCounts]);

  // وظيفة تسجيل الخروج
  const logout = async () => {
    setShowLogoutModal(false);
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
  };

  // عناصر القائمة الأساسية
  const navItems = [
    { href: `/${locale}`, label: t.nav.home, icon: <FiHome size={18} /> },
    ...(user ? [
      { href: `/${locale}/chat`, label: t.nav.messages, icon: <FiMessageSquare size={18} /> },
      { href: `/${locale}/profile`, label: t.nav.profile, icon: <FiUser size={18} /> },
    ] : []),
    ...(profile?.role === "admin" ? [
      { href: `/${locale}/admin`, label: t.nav.admin, icon: <FiShield size={18} /> },
    ] : []),
  ];


  return (
    <aside className="hidden lg:flex flex-col gap-6 w-72 shrink-0 sticky top-24 h-fit">
      {/* User card refined */}
      {user && profile && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-[2rem] p-5 relative overflow-hidden group shadow-xl"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--brand-a)]/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-700" />
          
          <Link href={`/${locale}/profile`} className="flex items-center gap-4 relative z-10">
            <div className="relative">
              <Avatar src={profile.avatar_url} name={profile.full_name ?? profile.email} size={52} />
              {profile.is_pro && (
                <div className="absolute -bottom-1 -right-1 bg-amber-400 p-1 rounded-full shadow-lg border-2 border-[var(--bg)]">
                  <FiStar size={10} className="text-white fill-white" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm tracking-tight truncate group-hover:text-[var(--brand-a)] transition-colors">
                {profile.full_name || t.profile}
              </p>
              {(() => {
                const badge = getBadge(profile.is_pro ? 30 : 5, locale as Locale);
                return (
                  <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 opacity-80 ${badge.color}`}>
                    {badge.label}
                  </p>
                );
              })()}
            </div>
          </Link>
        </motion.div>
      )}

      {/* Navigation - Ultra Glass */}
      <nav className="glass-card rounded-[2rem] p-2 space-y-1 shadow-lg">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const isMessages = item.href.includes("/chat");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-5 py-3.5 rounded-2xl transition-all duration-300 relative group/item ${
                isActive
                  ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white shadow-[0_8px_20px_rgba(99,102,241,0.15)] border border-indigo-500/30"
                  : "text-muted hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-xl transition-all duration-300 ${isActive ? "bg-indigo-500 text-white" : "bg-white/5 group-hover/item:bg-white/10"}`}>
                  {item.icon}
                </div>
                <span className="font-bold text-sm tracking-wide">{item.label}</span>
              </div>
              
              {isMessages && unreadChatCount > 0 && (
                <div className="relative flex items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-20"></span>
                  <span className="relative flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-pink-600 px-1.5 text-[10px] font-black text-white shadow-lg shadow-rose-500/30">
                    {unreadChatCount}
                  </span>
                </div>
              )}

              {item.href.includes("/admin") && adminNotificationCount > 0 && (
                <div className="relative flex items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-20"></span>
                  <span className="relative flex h-2 w-2 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50" />
                </div>
              )}

              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className={`absolute inset-y-2 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.8)] ${isAr ? "left-2" : "right-2"}`}
                />
              )}
            </Link>
          );
        })}
        {user && (
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center gap-4 rounded-2xl px-5 py-3.5 text-sm font-bold text-red-500/60 hover:text-red-500 hover:bg-red-500/5 transition-all duration-500 group mt-1"
          >
            <motion.div
              whileHover={{ scale: 1.15 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <FiPower size={18} className="group-hover:drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
            </motion.div>
            {t.nav.logout}
          </button>
        )}
      </nav>

      {/* Community Pulse - New Section */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card rounded-[2rem] p-6 space-y-4 shadow-lg border-l-4 border-l-[var(--brand-a)]"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted">{t.communityPulse}</h3>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
        </div>
        <div className="space-y-4">
          <div className="group cursor-default">
            <div className="flex items-center gap-2 mb-0.5">
              <FiWind className="text-[var(--brand-a)]" size={20} />
              <p className="text-xl font-black group-hover:text-[var(--brand-a)] transition-colors">{stats.inspirations}</p>
            </div>
            <p className="text-[10px] uppercase font-bold text-muted tracking-wider">{t.stats.newInspirations}</p>
          </div>
          <div className="group cursor-default">
            <div className="flex items-center gap-2 mb-0.5">
              <FiAward className="text-amber-500" size={20} />
              <p className="text-xl font-black group-hover:text-amber-500 transition-colors">{stats.masters}</p>
            </div>
            <p className="text-[10px] uppercase font-bold text-muted tracking-wider">{t.stats.activeMasters}</p>
          </div>
        </div>
      </motion.div>

      {/* Trending Now - Ranked Redesign */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card rounded-[2rem] p-6 space-y-5 shadow-xl bg-gradient-to-b from-white/5 to-transparent"
      >
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-[var(--brand-glow)]">
            <FiTrendingUp size={16} className="text-[var(--brand-a)]" />
          </div>
          <h3 className="font-bold text-sm">{t.trendingNow}</h3>
        </div>
        
        <div className="space-y-4">
          {trends.map((item, i) => (
            <div key={item.tag} className="flex items-center justify-between group cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black text-white/10 group-hover:text-[var(--brand-a)]/30 transition-colors leading-none italic">
                  {(i + 1).toString().padStart(2, "0")}
                </span>
                <div className="space-y-0.5">
                  <p className="text-sm font-bold group-hover:text-[var(--brand-a)] transition-colors leading-tight">
                    {item.tag}
                  </p>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-tighter">
                    {item.count} {isAr ? "منشور" : "posts"}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                {item.growth}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Sidebar Ads */}
      {adsLoading && <AdSkeleton />}
      {ads.map((ad) => (
        <motion.div
          key={ad.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="hover:scale-[1.02] transition-transform duration-300"
        >
          <AdCard ad={ad} />
        </motion.div>
      ))}

      {/* Upgrade to Pro Button - Hide if user is already Pro */}
      {user && profile && profile.is_pro === false && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={async () => {
            try {
              const res = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.id, email: user.email, locale }),
              });
              const { url, error } = await res.json();
              if (error) throw new Error(error);
              if (url) window.location.href = url;
            } catch (err: unknown) {
              toast.error((err as Error).message || "Failed to checkout");
            }
          }}
          className="w-full relative group overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-amber-400 to-orange-500 shadow-xl shadow-orange-500/20"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
          <div className="relative z-10 flex items-center justify-center gap-3">
            <FiStar className="text-white fill-white" size={20} />
            <span className="text-white font-black uppercase tracking-widest text-sm drop-shadow-md">
              {t.monetization.getPro}
            </span>
          </div>
        </motion.button>
      )}

      {/* Elegant Mini Footer */}
      <div className="px-6 flex flex-wrap gap-x-4 gap-y-2 opacity-30 hover:opacity-100 transition-opacity duration-500 mt-4">
        {["Privacy", "Terms", "Support", "Cookies"].map(link => (
          <button key={link} className="text-[10px] font-black uppercase tracking-widest hover:text-[var(--brand-a)] transition-colors">
            {link}
          </button>
        ))}
        <p className="text-[10px] font-bold w-full mt-2">© 2026 ELHAM ELITE</p>
      </div>

      <Modal open={showLogoutModal} onClose={() => setShowLogoutModal(false)} title={isAr ? "تسجيل الخروج" : "Logout"}>
        <div className="space-y-6">
          <p className="text-muted">
            {isAr ? "هل أنت متأكد أنك تريد تسجيل الخروج من إلهام؟" : "Are you sure you want to log out from Elham?"}
          </p>
          <div className="flex items-center gap-3 justify-end">
            <button onClick={() => setShowLogoutModal(false)} className="btn-ghost">
              {t.common.cancel}
            </button>
            <button onClick={logout} className="btn-primary bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-0">
              {t.nav.logout}
            </button>
          </div>
        </div>
      </Modal>
    </aside>
  );
}
