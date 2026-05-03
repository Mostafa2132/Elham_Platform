"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { useFormik } from "formik";
import * as Yup from "yup";
import {
  FiUsers, FiFileText, FiSpeaker, FiBarChart2, FiImage,
  FiTrash2, FiToggleLeft, FiToggleRight, FiBell, FiPlusCircle,
  FiRefreshCw, FiX, FiZap, FiShield, FiStar, FiCheckCircle, FiAlertTriangle
} from "react-icons/fi";
import { getSupabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { compressImage } from "@/lib/image-compression";
import { useParams } from "next/navigation";
import { translations } from "@/data/translations";
import { type Profile, type Post, type Ad, type Announcement, type Locale } from "@/types";
import { POST_THEMES } from "@/lib/constants";

type AdminTab = "analytics" | "leaderboard" | "users" | "posts" | "ads" | "announcements" | "master" | "requests" | "reports";

const getTabs = (t: any) => [
  { id: "analytics" as AdminTab, label: t.admin.analytics, icon: <FiBarChart2 /> },
  { id: "leaderboard" as AdminTab, label: t.admin.leaderboard, icon: <FiStar /> },
  { id: "users" as AdminTab, label: t.admin.users, icon: <FiUsers /> },
  { id: "posts" as AdminTab, label: t.admin.posts, icon: <FiFileText /> },
  { id: "ads" as AdminTab, label: t.admin.ads, icon: <FiSpeaker /> },
  { id: "announcements" as AdminTab, label: t.admin.announcements, icon: <FiBell /> },
  { id: "requests" as AdminTab, label: t.masterAdmin.authenticityQueue, icon: <FiShield /> },
  { id: "reports" as AdminTab, label: t.admin.reports, icon: <FiAlertTriangle /> },
  { id: "master" as AdminTab, label: t.masterAdmin.title, icon: <FiZap /> },
];

export function AdminDashboard() {
  const params = useParams();
  const locale = (params?.locale as Locale) || "en";
  const isAr = locale === "ar";
  const t = translations[locale];
  const { profile } = useAuthStore();

  const supabase = getSupabase();
  const TABS = getTabs(t);
  const [tab, setTab] = useState<AdminTab>("analytics");
  const [users, setUsers] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, posts: 0, ads: 0, likes: 0 });
  const [leaderboard, setLeaderboard] = useState<(Profile & { posts_count: number; likes_count: number })[]>([]);
  const [chartData, setChartData] = useState<number[]>([]);

  const [addAdOpen, setAddAdOpen] = useState(false);
  const [addAnnOpen, setAddAnnOpen] = useState(false);
  const [requests, setRequests] = useState<Post[]>([]);
  const [reports, setReports] = useState<any[]>([]);


  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: u },
      { data: p },
      { data: a },
      { data: ann },
      { data: rep },
      { count: uc },
      { count: pc },
      { count: ac },
      { count: lc },
    ] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("posts").select("id,author_id,content,image_url,created_at,updated_at,profiles(full_name,avatar_url,email),seal_requested,is_authentic").order("created_at", { ascending: false }).limit(50),
      supabase.from("ads").select("*").order("created_at", { ascending: false }),
      supabase.from("announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("reports").select("*,profiles(full_name,email,avatar_url)").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("posts").select("*", { count: "exact", head: true }),
      supabase.from("ads").select("*", { count: "exact", head: true }),
      supabase.from("likes").select("*", { count: "exact", head: true }),
    ]);
    
    const hydratedPosts = (p ?? []).map((item: any) => ({
      ...item,
      profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
    })) as Post[];
    
    setUsers((u ?? []) as Profile[]);
    setPosts(hydratedPosts);
    setRequests(hydratedPosts.filter(p => (p as any).seal_requested && !p.is_authentic));
    setAds((a ?? []) as Ad[]);
    setAnnouncements((ann ?? []) as Announcement[]);
    setReports((rep ?? []) as any[]);
    setStats({ users: uc ?? 0, posts: pc ?? 0, ads: ac ?? 0, likes: lc ?? 0 });

    // Build Leaderboard Data
    if (u) {
      const { data: pData } = await supabase.from('posts').select('id, author_id');
      const { data: lData } = await supabase.from('likes').select('post_id');
      
      const lb = (u as Profile[]).map(user => {
        const userPosts = (pData ?? []).filter(p => p.author_id === user.id);
        const postsCount = userPosts.length;
        
        // Count likes RECEIVED by this user's posts
        const postIds = new Set(userPosts.map(p => p.id));
        const interactionsCount = (lData ?? []).filter(l => postIds.has(l.post_id)).length;
        
        return {
          ...user,
          posts_count: postsCount,
          likes_count: interactionsCount
        };
      }).sort((a, b) => (b.posts_count + b.likes_count) - (a.posts_count + a.likes_count)).slice(0, 20);
      
      setLeaderboard(lb);
    }

    // Calculate Real Chart Data (Last 7 Days)
    if (u) {
      const now = new Date();
      const last7Days = Array.from({ length: 8 }, (_, i) => {
        const d = new Date();
        d.setDate(now.getDate() - (7 - i));
        d.setHours(0, 0, 0, 0);
        return d;
      });

      const userGrowth = last7Days.map(date => {
        return (u as Profile[]).filter(user => new Date(user.created_at) <= new Date(date.getTime() + 86400000)).length;
      });
      setChartData(userGrowth);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Switch by numbers 1-8
      if (e.key >= "1" && e.key <= String(TABS.length)) {
        const index = parseInt(e.key) - 1;
        setTab(TABS[index].id);
      }
      // Switch by arrows
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const currentIndex = TABS.findIndex(t => t.id === tab);
        let nextIndex = currentIndex;
        if (e.key === "ArrowRight") nextIndex = (currentIndex + 1) % TABS.length;
        if (e.key === "ArrowLeft") nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
        setTab(TABS[nextIndex].id);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tab]);

  // إعداد اشتراك الوقت الفعلي (Real-time) لمتابعة التحديثات لحظياً
  useEffect(() => {
    const channel = supabase
      .channel("admin-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        (payload) => {
          load(); // تحديث كامل للبيانات والإحصائيات
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts" },
        (payload) => {
          const post = payload.new as Post;
          // إذا كان هناك طلب جديد أو تغيير في حالة الأصالة، نحدث البيانات فوراً
          if (post.seal_requested || post.is_authentic !== undefined) {
            load();
            if (post.seal_requested && !post.is_authentic) {
              toast.warning(locale === "ar" ? "🛡️ طلب أصالة جديد قيد الانتظار!" : "🛡️ New Authenticity Request pending!");
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "posts" },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, load, locale]);

  const deletePost = async (id: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setPosts((prev) => prev.filter((p) => p.id !== id));
    toast.success(locale === "ar" ? "تم حذف المنشور" : "Post deleted");
  };

  const deleteUser = async (id: string) => {
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setUsers((prev) => prev.filter((u) => u.id !== id));
    toast.success(locale === "ar" ? "تم حذف المستخدم" : "User removed");
  };

  const toggleAd = async (ad: Ad) => {
    const { error } = await supabase.from("ads").update({ active: !ad.active }).eq("id", ad.id);
    if (error) return toast.error(error.message);
    setAds((prev) => prev.map((a) => (a.id === ad.id ? { ...a, active: !a.active } : a)));
  };

  const deleteAd = async (id: string) => {
    const { error } = await supabase.from("ads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setAds((prev) => prev.filter((a) => a.id !== id));
    toast.success(locale === "ar" ? "تم حذف الإعلان" : "Ad removed");
  };

  const toggleAnnouncement = async (ann: Announcement) => {
    const { error } = await supabase.from("announcements").update({ active: !ann.active }).eq("id", ann.id);
    if (error) return toast.error(error.message);
    setAnnouncements((prev) => prev.map((a) => (a.id === ann.id ? { ...a, active: !a.active } : a)));
  };

  const deleteAnnouncement = async (id: string) => {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    toast.success(locale === "ar" ? "تم حذف التنبيه" : "Announcement removed");
  };

  const approveSeal = async (postId: string, authorId: string) => {
    const { error } = await supabase.from("posts").update({ is_authentic: true, seal_requested: false }).eq("id", postId);
    if (error) return toast.error(error.message);
    
    // إرسال تنبيه للمستخدم
    await supabase.from("notifications").insert({
      user_id: authorId,
      type: "seal_approved",
      target_id: postId,
      content: locale === "ar" ? "تم قبول طلب توثيق منشورك بنجاح! 🎉" : "Your post authenticity seal has been approved! 🎉"
    });

    // تحديث قائمة المنشورات العامة وقائمة الطلبات المعلقة فوراً
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_authentic: true, seal_requested: false } : p));
    setRequests(prev => prev.filter(p => p.id !== postId));
    
    toast.success(t.masterAdmin.updateSuccess);
  };

  const rejectSeal = async (postId: string, authorId: string) => {
    const { error } = await supabase.from("posts").update({ seal_requested: false }).eq("id", postId);
    if (error) return toast.error(error.message);
    
    // إرسال تنبيه للمستخدم
    await supabase.from("notifications").insert({
      user_id: authorId,
      type: "seal_rejected",
      target_id: postId,
      content: locale === "ar" ? "للأسف تم رفض طلب التوثيق لهذا المنشور." : "Your authenticity request was rejected for this post."
    });

    // تحديث قائمة المنشورات العامة وقائمة الطلبات المعلقة فوراً
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, seal_requested: false } : p));
    setRequests(prev => prev.filter(p => p.id !== postId));
    
    toast.info(locale === "ar" ? "تم رفض الطلب" : "Request rejected");
  };

  const [ritualText, setRitualText] = useState("");
  const updateRitual = async () => {
    if (!ritualText) return;
    const { error } = await supabase.from("rituals").upsert({ 
      id: "daily_ritual", 
      content: ritualText, 
      active: true,
      updated_at: new Date().toISOString()
    });
    if (error) return toast.error(error.message);
    toast.success(t.masterAdmin.updateSuccess);
    setRitualText("");
  };

  const generateRitualAI = () => {
    const enSeeds = [
      "The universe doesn't speak in whispers; it speaks in the courage of the souls who listen.",
      "Every breath is a second chance to rewrite the story of your light.",
      "Your journey isn't a destination, it's the masterpiece you create while walking.",
      "In the silence of the soul, the most profound answers are born.",
      "Let your intuition be the compass that leads you through the stardust.",
      "Growth starts the moment you decide that your light is brighter than your shadows.",
      "The world is waiting for the version of you that only you can be.",
      "Kindness is the true currency of the elite soul.",
      "May your steps today be guided by the echoes of your future self.",
      "Transcend the ordinary; the cosmic realm belongs to the dreamers."
    ];
    const arSeeds = [
      "الكون لا يتحدث همساً؛ بل يتحدث بشجاعة الأرواح التي تنصت.",
      "كل نفس هو فرصة ثانية لإعادة كتابة قصة نورك.",
      "رحلتك ليست وجهة، بل هي التحفة الفنية التي تبدعها أثناء السير.",
      "في صمت الروح، تولد الإجابات الأكثر عمقاً.",
      "اجعل حدسك هو البوصلة التي تقودك عبر غبار النجوم.",
      "النمو يبدأ في اللحظة التي تقرر فيها أن نورك أسطع من ظلالك.",
      "العالم ينتظر النسخة منك التي لا يمكن لأحد غيرك أن يكونها.",
      "اللطف هو العملة الحقيقية للروح النخبوية.",
      "لتكن خطواتك اليوم مسترشدة بصدى ذاتك المستقبلية.",
      "تجاوز المألوف؛ فالمجال الكوني ملك للحالمين."
    ];
    
    const seeds = isAr ? arSeeds : enSeeds;
    const random = seeds[Math.floor(Math.random() * seeds.length)];
    
    // Simulate typing effect
    let i = 0;
    setRitualText("");
    const interval = setInterval(() => {
      setRitualText(prev => prev + (random[i] || ""));
      i++;
      if (i >= random.length) clearInterval(interval);
    }, 20);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-2xl p-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold brand-gradient-text">{t.adminDashboard}</h1>
          <p className="text-muted text-sm mt-0.5">{t.admin.subtitle}</p>
        </div>
        <button onClick={load} className="btn-ghost flex items-center gap-2 text-sm">
          <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {t.admin.refresh}
        </button>
      </div>

      {/* Tab navigation */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="tab-bar px-4 pt-2">
          {TABS.map((tabItem, index) => (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={`tab-item group relative flex items-center gap-1.5 ${tab === tabItem.id ? "active" : ""}`}
              title={`Press ${index + 1} to switch`}
            >
              {tabItem.icon}
              <span className="hidden sm:inline">
                {t.admin[tabItem.id as keyof typeof t.admin] || tabItem.label}
              </span>
              <span className="absolute -top-1 -right-1 text-[8px] opacity-0 group-hover:opacity-40 transition-opacity font-bold bg-white/10 px-1 rounded">
                {index + 1}
              </span>
            </button>
          ))}
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {tab === "analytics" && (
                <div className="space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <StatCard label={t.admin.totalUsers} value={stats.users} icon={<FiUsers />} color="indigo" />
                    <StatCard label={t.admin.totalPosts} value={stats.posts} icon={<FiFileText />} color="purple" />
                    <StatCard label={t.admin.totalLikes} value={stats.likes} icon={<FiBarChart2 />} color="cyan" />
                    <StatCard label={t.admin.activeAds} value={stats.ads} icon={<FiSpeaker />} color="blue" />
                  </div>

                  {/* Visual Analytics Sections */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Line Chart Section */}
                    <div className="md:col-span-2 glass-card rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm tracking-tight">{isAr ? "اتجاهات النمو" : "Growth Trends"}</h3>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg">
                          {isAr ? "+14% مقارنة بالشهر الماضي" : "+14% vs last month"}
                        </span>
                      </div>
                      <div className="h-48 relative mt-4">
                        <LineChart data={chartData.length > 0 ? chartData : [0, 0, 0, 0, 0, 0, 0, 0]} color="#6366f1" />
                      </div>
                      <div className="flex justify-between text-muted text-[10px] font-bold uppercase tracking-tighter px-2">
                        {(isAr ? ["الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد", "اليوم"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Today"]).map(d => <span key={d}>{d}</span>)}
                      </div>
                    </div>

                    {/* Progress Rings Section */}
                    <div className="glass-card rounded-2xl p-6 space-y-6">
                      <h3 className="font-bold text-sm tracking-tight">{isAr ? "تحقيق الأهداف" : "Target Achievement"}</h3>
                      <div className="flex flex-col items-center justify-center gap-6 py-4">
                        {(() => {
                          const userGoal = 100;
                          const progress = Math.min(100, Math.round((stats.users / userGoal) * 100));
                          return <ProgressRing value={progress} label={isAr ? "هدف المشتركين (100)" : "User Target (100)"} color="#f59e0b" />;
                        })()}
                        <div className="grid grid-cols-2 gap-4 w-full">
                          <div className="text-center p-3 rounded-xl bg-white/5 border border-white/10">
                            <p className="text-lg font-black">{users.filter(u => u.role === "admin").length}</p>
                            <p className="text-[9px] uppercase font-bold text-muted mt-0.5">{isAr ? "مدراء" : "Admins"}</p>
                          </div>
                          <div className="text-center p-3 rounded-xl bg-white/5 border border-white/10">
                            <p className="text-lg font-black">{profile?.is_pro ? 1 : 0}</p>
                            <p className="text-[9px] uppercase font-bold text-muted mt-0.5">{isAr ? "حالة البرو" : "Your Pro Status"}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Horizontal Category Bar Section */}
                  <div className="glass-card rounded-2xl p-6 space-y-6">
                    <h3 className="font-bold text-sm tracking-tight">{locale === "ar" ? "توزيع المحتوى" : "Content Distribution"}</h3>
                    <div className="space-y-4">
                      {(() => {
                        const total = posts.length || 1;
                        
                        // Extract actual tags used in posts
                        const themeCounts: Record<string, number> = {};
                        let untagged = 0;

                        posts.forEach(p => {
                          const match = p.content.match(/\[T:([\w-]+)\]/);
                          if (match && match[1]) {
                            const tag = match[1];
                            themeCounts[tag] = (themeCounts[tag] || 0) + 1;
                          } else {
                            untagged++;
                          }
                        });

                        // Map tag IDs to beautiful names using POST_THEMES
                        const statsList = Object.entries(themeCounts).map(([tagId, count]) => {
                          const themeObj = POST_THEMES.find(t => t.id === tagId);
                          const label = themeObj ? themeObj.name : tagId.charAt(0).toUpperCase() + tagId.slice(1);
                          return { label, val: Math.round((count / total) * 100), count };
                        });

                        // Sort by most used and take top 4
                        statsList.sort((a, b) => b.count - a.count);
                        const topStats = statsList.slice(0, 4);

                        // If there are very few tags, fallback to general stats
                        if (topStats.length === 0 && untagged > 0) {
                          topStats.push({ label: isAr ? "كلاسيكي (بدون تيم)" : "Classic (No Theme)", val: 100, count: untagged });
                        } else if (untagged > 0) {
                          const topTotal = topStats.reduce((sum, item) => sum + item.val, 0);
                          const othersVal = Math.max(0, 100 - topTotal);
                          if (othersVal > 0) {
                            topStats.push({ label: isAr ? "أخرى / كلاسيكي" : "Classic / Others", val: othersVal, count: untagged });
                          }
                        }

                        return topStats.map((item, i) => (
                          <div key={item.label} className="space-y-1.5">
                            <div className="flex justify-between text-[11px] font-bold uppercase tracking-wide">
                              <span>{item.label}</span>
                              <span className="text-muted">{item.val}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${item.val}%` }}
                                transition={{ duration: 1, ease: "easeOut", delay: i * 0.1 }}
                                className={`h-full ${["bg-indigo-500", "bg-purple-500", "bg-cyan-500", "bg-amber-500"][i % 4]} shadow-[0_0_8px_rgba(0,0,0,0.5)]`} 
                              />
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                </div>
              )}

              {tab === "leaderboard" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <FiStar className="text-amber-500" />
                      {t.admin.topPosters}
                    </h3>
                    <p className="text-muted text-sm">{leaderboard.length} total creators</p>
                  </div>

                  <div className="grid gap-3">
                    {leaderboard.map((u, index) => (
                      <motion.div
                        key={u.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                        className={`glass-card rounded-2xl p-4 sm:p-5 border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 group hover:border-amber-500/30 transition-all ${
                          index === 0 ? "ring-2 ring-amber-500/20 bg-amber-500/5 shadow-[0_0_40px_rgba(245,158,11,0.15)]" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 sm:gap-5 min-w-0 w-full sm:w-auto">
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-2xl flex items-center justify-center font-black text-lg sm:text-xl ${
                            index === 0 ? "bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.6)]" :
                            index === 1 ? "bg-slate-300 text-black shadow-[0_0_20px_rgba(203,213,225,0.4)]" :
                            index === 2 ? "bg-amber-700 text-white shadow-[0_0_20px_rgba(180,83,9,0.4)]" :
                            "bg-white/5 text-muted border border-white/10"
                          }`}>
                            {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                          </div>
                          <Avatar src={u.avatar_url} name={u.full_name || u.email} size={48} />
                          <div className="min-w-0">
                            <p className="font-black text-sm sm:text-base truncate flex items-center gap-2">
                              {u.full_name || "Anonymous"}
                              {u.is_pro && <span className="text-[9px] sm:text-[10px] bg-amber-500/20 text-amber-500 px-1.5 sm:px-2 py-0.5 rounded-md font-black uppercase tracking-widest">PRO</span>}
                            </p>
                            <p className="text-muted text-xs sm:text-sm truncate opacity-60">@{u.username || u.email.split('@')[0]}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-center sm:justify-end w-full sm:w-auto shrink-0 sm:pr-4 pt-4 sm:pt-0 border-t sm:border-t-0 border-white/10">
                          <div className="text-center flex-1 sm:flex-none sm:min-w-[80px]">
                            <p className="text-xl sm:text-2xl font-black brand-gradient-text leading-none">{u.posts_count}</p>
                            <p className="text-[9px] sm:text-[10px] uppercase font-bold text-muted tracking-widest mt-2">{t.admin.postsCount}</p>
                          </div>

                          {/* فاصل وسطي دقيق */}
                          <div className="w-[1px] h-10 bg-white/10 mx-4 sm:mx-6 shrink-0" />

                          <div className="text-center flex-1 sm:flex-none sm:min-w-[80px]">
                            <p className="text-xl sm:text-2xl font-black text-cyan-400 leading-none">{u.likes_count}</p>
                            <p className="text-[9px] sm:text-[10px] uppercase font-bold text-muted tracking-widest mt-2">{t.admin.interactions}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {tab === "users" && (
                <div className="space-y-2">
                  <p className="text-muted text-sm mb-3">{users.length} total users</p>
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between border-b border-[var(--border)] py-3 gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar src={u.avatar_url} name={u.full_name ?? u.email} size={36} />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{u.full_name || "—"}</p>
                          <p className="text-muted text-xs truncate">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === "admin" ? "brand-gradient text-white" : "surface-soft text-muted"}`}>
                          {u.role}
                        </span>
                        <button onClick={() => deleteUser(u.id)} className="btn-danger p-1.5 rounded-lg">
                          <FiTrash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === "posts" && (
                <div className="space-y-4">
                  <p className="text-muted text-sm mb-2 font-bold tracking-wide uppercase">
                    {locale === "ar" ? `أحدث ${posts.length} منشورات` : `${posts.length} recent posts`}
                  </p>
                  <div className="grid gap-3">
                    {posts.map((p) => {
                      const cleanContent = p.content.replace(/\[T:\w+\]/g, "").replace(/\[P:[\w-]+\]/g, "").trim();
                      const postDate = new Date(p.created_at);
                      return (
                        <div
                          key={p.id}
                          className="glass rounded-2xl p-5 border border-white/5 flex flex-col md:flex-row gap-4 hover:border-white/10 transition-colors group"
                        >
                          {/* Author & Content */}
                          <div className="flex-1 min-w-0 flex items-start gap-3">
                            <Avatar src={p.profiles?.avatar_url} name={p.profiles?.full_name || p.profiles?.email} size={40} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-[var(--foreground)] mb-0.5">
                                {p.profiles?.full_name || p.profiles?.email?.split("@")[0] || "Anonymous"}
                              </p>
                              <p className="text-sm leading-relaxed text-muted line-clamp-3">
                                {cleanContent || <span className="italic opacity-50">Empty post</span>}
                              </p>
                            </div>
                          </div>

                          {/* Date, Time & Actions */}
                          <div className="flex items-center justify-between md:flex-col md:justify-center gap-3 shrink-0 md:w-32 border-t md:border-t-0 border-white/5 md:border-s md:ps-4 md:ms-2 pt-3 md:pt-0">
                            <div className="text-center">
                              <p className="text-xs font-bold text-[var(--foreground)]">
                                {postDate.toLocaleTimeString(isAr ? "ar-EG-u-nu-latn" : "en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                              <p className="text-[10px] uppercase tracking-widest text-muted mt-0.5">
                                {postDate.toLocaleDateString(isAr ? "ar-EG-u-nu-latn" : "en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric"
                                })}
                              </p>
                            </div>
                            <button
                              onClick={() => deletePost(p.id)}
                              className="btn-danger p-2 rounded-xl opacity-80 hover:opacity-100 transition-opacity flex items-center justify-center mx-auto"
                              title={locale === "ar" ? "حذف المنشور" : "Delete Post"}
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {tab === "ads" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-muted text-sm">{ads.length} ads</p>
                    <button onClick={() => setAddAdOpen(true)} className="btn-primary flex items-center gap-2 text-sm">
                      <FiPlusCircle size={14} /> Add Ad
                    </button>
                  </div>
                  {ads.map((ad) => (
                    <div key={ad.id} className="glass rounded-xl p-4 flex items-center gap-4">
                      <div className="relative h-16 w-24 rounded-lg overflow-hidden shrink-0 bg-[var(--bg-soft)]">
                        <img src={ad.image_url} alt={ad.title ?? "ad"} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{ad.title || "Untitled"}</p>
                        <p className="text-muted text-xs truncate">{ad.link}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded mt-1 inline-block ${
                          ad.placement === "feed" ? "bg-indigo-500/20 text-indigo-300" :
                          ad.placement === "sidebar" ? "bg-cyan-500/20 text-cyan-300" :
                          "bg-purple-500/20 text-purple-300"
                        }`}>{ad.placement}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => toggleAd(ad)} className="btn-ghost p-1.5 rounded-lg text-lg">
                          {ad.active ? <FiToggleRight className="text-[var(--accent)]" size={20} /> : <FiToggleLeft className="text-muted" size={20} />}
                        </button>
                        <button onClick={() => deleteAd(ad.id)} className="btn-danger p-1.5 rounded-lg">
                          <FiTrash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {ads.length === 0 && <p className="text-center text-muted py-8">No ads yet</p>}
                </div>
              )}

              {tab === "announcements" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-muted text-sm">{announcements.length} announcements</p>
                    <button onClick={() => setAddAnnOpen(true)} className="btn-primary flex items-center gap-2 text-sm">
                      <FiBell size={14} /> New Announcement
                    </button>
                  </div>
                  {announcements.map((ann) => (
                    <div key={ann.id} className="glass rounded-xl p-4 flex items-start gap-4">
                      <FiBell size={16} className="text-[var(--brand-a)] mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{ann.message}</p>
                        <p className="text-muted text-xs mt-1">{new Date(ann.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => toggleAnnouncement(ann)} className="btn-ghost p-1.5 rounded-lg text-lg">
                          {ann.active ? <FiToggleRight className="text-[var(--accent)]" size={20} /> : <FiToggleLeft className="text-muted" size={20} />}
                        </button>
                        <button onClick={() => deleteAnnouncement(ann.id)} className="btn-danger p-1.5 rounded-lg">
                          <FiTrash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {announcements.length === 0 && <p className="text-center text-muted py-8">No announcements yet</p>}
                </div>
              )}

              {tab === "requests" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <FiShield className="text-amber-500" />
                      {locale === "ar" ? "طلبات الأصالة" : "Authenticity Requests"}
                    </h3>
                    <p className="text-muted text-sm">{requests.length} pending</p>
                  </div>
                  
                  <div className="grid gap-4">
                    {requests.map((p) => (
                      <div key={p.id} className="glass-card rounded-2xl p-5 border border-white/5 hover:border-amber-500/20 transition-all group">
                        <div className="flex items-start gap-4">
                          <Avatar src={p.profiles?.avatar_url} size={48} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-sm">{p.profiles?.full_name}</p>
                              <span className="text-[10px] text-muted">{new Date(p.created_at).toLocaleString(locale)}</span>
                            </div>
                            <p className="text-sm leading-relaxed mb-4 text-white/80">
                              {p.content.replace(/\[T:\w+\]/g, "").replace(/\[P:[\w-]+\]/g, "").trim()}
                            </p>
                            <div className="flex gap-3">
                              <button 
                                onClick={() => approveSeal(p.id, p.author_id)}
                                className="flex-1 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all text-xs font-black uppercase tracking-wider"
                              >
                                {t.masterAdmin.approve}
                              </button>
                              <button 
                                onClick={() => rejectSeal(p.id, p.author_id)}
                                className="flex-1 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all text-xs font-black uppercase tracking-wider"
                              >
                                {t.masterAdmin.reject}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {requests.length === 0 && (
                      <div className="py-20 glass rounded-3xl border border-dashed border-white/10 text-center">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                          <FiCheckCircle size={30} className="text-muted opacity-20" />
                        </div>
                        <p className="text-muted italic">{t.masterAdmin.noRequests}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === "reports" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <FiAlertTriangle className="text-amber-500" />
                      {t.admin.reports}
                    </h3>
                  </div>
                  
                  <div className="grid gap-4">
                    {reports.length === 0 ? (
                      <div className="py-20 glass rounded-3xl border border-dashed border-white/10 text-center">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                          <FiCheckCircle size={30} className="text-muted opacity-20" />
                        </div>
                        <p className="text-muted italic">{t.admin.noReports}</p>
                      </div>
                    ) : (
                      reports.map(r => (
                        <div key={r.id} className="glass-card p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-white/5 hover:border-amber-500/20 transition-colors">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-500'}`}>
                                {r.status === 'resolved' ? t.admin.active.toUpperCase() : (isAr ? "قيد الانتظار" : "PENDING")}
                              </span>
                              <span className="text-xs text-muted uppercase font-bold tracking-wider">
                                {t.admin[r.report_type as keyof typeof t.admin] || r.report_type}
                              </span>
                              <span className="text-xs text-muted">- {new Date(r.created_at).toLocaleDateString(locale)}</span>
                            </div>
                            <p className="font-medium text-sm mb-2 text-white/90">{r.description}</p>
                            <div className="flex items-center gap-2">
                              <Avatar src={r.profiles?.avatar_url} size={20} />
                              <p className="text-xs text-muted">{t.admin.reportedBy}: {r.profiles?.full_name || r.profiles?.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {r.status === 'pending' && (
                              <button
                                onClick={async () => {
                                  await supabase.from("reports").update({ status: 'resolved' }).eq("id", r.id);
                                  
                                  // Send notification to the user
                                  await supabase.from("notifications").insert({
                                    user_id: r.user_id,
                                    type: "report_resolved",
                                    content: locale === "ar" ? "تم حل المشكلة التي أبلغت عنها. شكراً لك! 🎉" : "The problem you reported has been resolved. Thank you! 🎉"
                                  });

                                  toast.success(t.admin.markResolved);
                                  load();
                                }}
                                className="btn-primary px-4 py-2 rounded-xl text-xs font-bold"
                              >
                                {t.admin.markResolved}
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                if(confirm(isAr ? "هل أنت متأكد من حذف البلاغ؟" : "Delete report?")) {
                                  await supabase.from("reports").delete().eq("id", r.id);
                                  load();
                                }
                              }}
                              className="p-2.5 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                              title="Delete"
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {tab === "master" && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  {/* Ritual Control */}
                  <div className="glass-card rounded-3xl p-6 border border-indigo-500/20">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                        <FiRefreshCw size={20} />
                      </div>
                      <h3 className="text-lg font-bold">{t.masterAdmin.ritualControl}</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="relative group">
                        <textarea
                          value={ritualText}
                          onChange={(e) => setRitualText(e.target.value)}
                          placeholder="✨ Type the daily inspiration ritual..."
                          className="input-field min-h-[120px] resize-none text-center italic text-lg pr-12 transition-all focus:ring-indigo-500/30"
                        />
                        <button 
                          type="button"
                          onClick={generateRitualAI}
                          className="absolute bottom-4 right-4 p-2 rounded-xl bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all shadow-lg hover:shadow-indigo-500/40 group/ai"
                          title="Generate with AI"
                        >
                          <FiStar size={18} className="group-hover/ai:rotate-12 transition-transform" />
                        </button>
                      </div>
                      <button 
                        onClick={updateRitual}
                        className="w-full btn-primary py-4 rounded-2xl shadow-lg shadow-indigo-500/20 font-bold uppercase tracking-widest text-xs"
                      >
                        {t.masterAdmin.setRitual}
                      </button>
                    </div>
                  </div>

                  {/* Authenticity Queue */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 px-2">
                       <FiZap className="text-amber-500" />
                       <h3 className="font-bold uppercase tracking-widest text-xs text-muted">{t.masterAdmin.authenticityQueue}</h3>
                    </div>
                    
                    <div className="space-y-3">
                       {posts.filter(p => (p as any).seal_requested && !(p as any).is_authentic).map(p => (
                         <div key={p.id} className="glass rounded-2xl p-4 border border-white/5 flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                               <p className="text-sm italic leading-relaxed">&quot;{p.content.replace(/\[T:\w+\]/g, "").replace(/\[P:[\w-]+\]/g, "").trim()}&quot;</p>
                               <div className="mt-2 flex items-center gap-2">
                                  <Avatar src={p.profiles?.avatar_url} size={20} />
                                  <span className="text-[10px] font-bold text-muted uppercase">{p.profiles?.full_name}</span>
                               </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                               <button onClick={() => approveSeal(p.id, p.author_id)} className="btn-primary bg-emerald-500 hover:bg-emerald-600 text-white border-none py-1.5 px-4 text-xs font-bold rounded-xl">
                                  {t.masterAdmin.approve}
                                </button>
                               <button onClick={() => rejectSeal(p.id, p.author_id)} className="btn-ghost text-red-400 hover:bg-red-500/10 py-1.5 px-4 text-xs font-bold rounded-xl">
                                  {t.masterAdmin.reject}
                                </button>
                            </div>
                         </div>
                       ))}
                       {posts.filter(p => (p as any).seal_requested && !(p as any).is_authentic).length === 0 && (
                         <div className="py-12 glass rounded-2xl border border-dashed border-white/10 text-center">
                            <p className="text-muted text-sm italic">{t.masterAdmin.noRequests}</p>
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Add Ad Modal */}
      <AddAdModal
        open={addAdOpen}
        onClose={() => setAddAdOpen(false)}
        onCreated={(ad) => { setAds((prev) => [ad, ...prev]); setAddAdOpen(false); }}
      />

      {/* Add Announcement Modal */}
      <AddAnnouncementModal
        open={addAnnOpen}
        onClose={() => setAddAnnOpen(false)}
        onCreated={(ann) => { setAnnouncements((prev) => [ann, ...prev]); setAddAnnOpen(false); }}
      />
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-500/15 text-indigo-400",
    purple: "bg-purple-500/15 text-purple-400",
    cyan: "bg-cyan-500/15 text-cyan-400",
    blue: "bg-blue-500/15 text-blue-400",
  };
  return (
    <div className="glass-card rounded-2xl p-5 space-y-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-black tabular-nums">{value.toLocaleString()}</p>
        <p className="text-muted text-[10px] uppercase font-bold tracking-wider mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function LineChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 400;
  const height = 150;

  const points = data.map((d, i) => ({
    x: (i / (data.length - 1 || 1)) * width,
    y: (height - ((d - min) / range) * height) || height / 2
  }));

  const pathD = `M ${points.map(p => `${p.x || 0},${p.y || 0}`).join(" L ")}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Area */}
      <motion.path
        d={`${pathD} L ${width},${height} L 0,${height} Z`}
        fill="url(#lineGrad)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      />
      {/* Line */}
      <motion.path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, ease: "easeInOut" }}
      />
      {/* Dots */}
      {points.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="4"
          fill={color}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1 + i * 0.1 }}
          className="shadow-xl"
        />
      ))}
    </svg>
  );
}

function ProgressRing({ value, label, color }: { value: number; label: string; color: string }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-white/5"
          />
          <motion.circle
            cx="64"
            cy="64"
            r={radius}
            stroke={color}
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            strokeLinecap="round"
            className="drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
          />
        </svg>
        <div className="flex flex-col items-center justify-center z-10">
          <span className="text-2xl font-black leading-none">{value}%</span>
        </div>
      </div>
      <p className="text-[10px] uppercase font-bold text-muted mt-4 text-center tracking-widest">{label}</p>
    </div>
  );
}

function AddAdModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (ad: Ad) => void }) {
  const params = useParams();
  const locale = (params?.locale as Locale) || "en";
  const t = translations[locale];

  const supabase = getSupabase();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const formik = useFormik({
    initialValues: { title: "", link: "", placement: "feed" as Ad["placement"] },
    validationSchema: Yup.object({
      title: Yup.string().max(100),
      link: Yup.string().url("Must be a valid URL").required("Link is required"),
      placement: Yup.string().oneOf(["feed", "sidebar", "both"]).required(),
    }),
    onSubmit: async (values, helpers) => {
      if (!imageFile) return toast.error(locale === "ar" ? "يرجى اختيار صورة" : "Please select an image");
      toast.info(locale === "ar" ? "جاري رفع الصورة..." : "Uploading image...", { toastId: "upload", autoClose: false });
      
      try {
        const compressed = await compressImage(imageFile, 800); // Ads are small
        const ext = "webp";
        const path = `ads/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("ads").upload(path, compressed, { upsert: true });
        if (upErr) {
          toast.dismiss("upload");
          return toast.error(upErr.message);
        }
        
        const { data: urlData } = supabase.storage.from("ads").getPublicUrl(path);

        const { data, error } = await supabase
          .from("ads")
          .insert({ title: values.title || null, image_url: urlData.publicUrl, link: values.link, placement: values.placement, active: true })
          .select("*")
          .single();
          
        if (error) {
          toast.dismiss("upload");
          return toast.error(error.message);
        }
        
        toast.dismiss("upload");
        toast.success(locale === "ar" ? "تم إنشاء الإعلان!" : "Ad created!");
        onCreated(data as Ad);
        helpers.resetForm();
        setImageFile(null);
        setImagePreview(null);
      } catch (err) {
        toast.dismiss("upload");
        toast.error(locale === "ar" ? "فشلت معالجة الصورة" : "Failed to process image");
      }
    },
  });

  const handleImg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  return (
    <Modal open={open} onClose={onClose} title={t.modal.addAd}>
      <form onSubmit={formik.handleSubmit} className="space-y-4">
        <div>
          <label className="input-label">Ad Image *</label>
          <label className="block h-36 rounded-xl border border-[var(--border)] border-dashed cursor-pointer hover:border-[var(--brand-a)] transition-colors overflow-hidden">
            {imagePreview
              ? <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
              : <div className="flex flex-col items-center justify-center h-full text-muted gap-2">
                  <FiImage size={24} />
                  <span className="text-sm">{t.common.selectImage}</span>
                </div>
            }
            <input type="file" accept="image/*" className="hidden" onChange={handleImg} />
          </label>
        </div>
        <div>
          <label className="input-label">{t.modal.adTitle}</label>
          <input name="title" className="input-field" placeholder="Ad title..." value={formik.values.title} onChange={formik.handleChange} />
        </div>
        <div>
          <label className="input-label">{t.modal.adLink}</label>
          <input name="link" placeholder="https://..." value={formik.values.link} onChange={formik.handleChange} dir="ltr" className="input-field text-start" />
          {formik.errors.link && formik.touched.link && <p className="input-error">{formik.errors.link}</p>}
        </div>
        <div>
          <label className="input-label">{t.modal.adPlacement}</label>
          <select name="placement" className="input-field" value={formik.values.placement} onChange={formik.handleChange}>
            <option value="feed">{t.modal.feed}</option>
            <option value="sidebar">{t.modal.sidebar}</option>
            <option value="both">{t.modal.both}</option>
          </select>
        </div>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="btn-ghost">{t.common.cancel}</button>
          <button type="submit" disabled={formik.isSubmitting} className="btn-primary">
            {formik.isSubmitting ? t.loading : t.common.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AddAnnouncementModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (ann: Announcement) => void }) {
  const params = useParams();
  const locale = (params?.locale as Locale) || "en";
  const t = translations[locale];

  const supabase = getSupabase();
  const formik = useFormik({
    initialValues: { message: "" },
    validationSchema: Yup.object({ message: Yup.string().min(5).required("Message is required") }),
    onSubmit: async (values, helpers) => {
      // Deactivate all current active announcements
      await supabase.from("announcements").update({ active: false }).eq("active", true);
      const { data, error } = await supabase
        .from("announcements")
        .insert({ message: values.message, active: true })
        .select("*")
        .single();
      if (error) return toast.error(error.message);
      toast.success(locale === "ar" ? "تم إرسال التنبيه!" : "Announcement sent!");
      onCreated(data as Announcement);
      helpers.resetForm();
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={t.modal.sendAnnounce}>
      <form onSubmit={formik.handleSubmit} className="space-y-4">
        <div className="glass rounded-xl p-4 border border-indigo-500/30">
          <p className="text-sm text-muted">
            🔔 {t.modal.announceWarn}
          </p>
        </div>
        <div>
          <label className="input-label">{t.modal.message}</label>
          <textarea
            name="message"
            rows={4}
            className="input-field resize-none"
            placeholder="Write your announcement..."
            value={formik.values.message}
            onChange={formik.handleChange}
          />
          {formik.errors.message && formik.touched.message && <p className="input-error">{formik.errors.message}</p>}
        </div>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="btn-ghost">{t.common.cancel}</button>
          <button type="submit" disabled={formik.isSubmitting} className="btn-primary">
            {formik.isSubmitting ? t.loading : t.common.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}
