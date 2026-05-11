"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { FiRefreshCw, FiPlusCircle } from "react-icons/fi";
import { getSupabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";
import { PostCard } from "@/components/sections/post-card";
import { PostSkeleton } from "@/components/ui/skeletons";
import { AdBanner } from "@/components/ads/ad-card";
import { CreatePostModal } from "@/components/sections/create-post-modal";
import { useParams } from "next/navigation";
import { translations } from "@/data/translations";
import { type Post, type Ad, type Locale } from "@/types";
import { LivePulse } from "@/components/layout/live-pulse";
import { RitualBanner } from "@/components/sections/ritual-banner";
import { useInteractionStore } from "@/store/interaction-store";

// إعدادات عرض الصفحة (حجم الصفحة وعدد المنشورات بين الإعلانات)
const PAGE_SIZE = 8;
const AD_EVERY = 3; 
const REQUEST_TIMEOUT_MS = 15000;

/**
 * مكون خلاصة المنشورات (FeedList)
 * يقوم بجلب المنشورات من قاعدة البيانات مع خاصية التحميل اللانهائي (Infinite Scroll)
 * ودمج الإعلانات داخل المحتوى بشكل منسق.
 */
export function FeedList() {
  const params = useParams();
  const locale = (params?.locale as Locale) || "en";
  const t = translations[locale];

  const supabase = getSupabase();
  const { user, profile } = useAuthStore();
  
  // نستخدم ref للـ userId عشان نمنع إعادة تشغيل fetchPage عند كل تغيير في الـ auth state
  const userIdRef = useRef<string | null>(user?.id ?? null);
  useEffect(() => { userIdRef.current = user?.id ?? null; }, [user]);
  
  // حالات تخزين المنشورات والإعلانات والتحميل
  const [posts, setPosts] = useState<Post[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  
  const isFetchingRef = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const timeoutPromise = useCallback(
    (timeoutMs: number): Promise<never> =>
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), timeoutMs)
      ),
    []
  );

  const withTimeout = useCallback(
    <T,>(promise: PromiseLike<T>, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> => {
      return Promise.race([Promise.resolve(promise), timeoutPromise(timeoutMs)]);
    },
    [timeoutPromise]
  );

  // تحميل الإعلانات المخصصة للخلاصة عند بدء التشغيل
  useEffect(() => {
    withTimeout(
      supabase
        .from("ads")
        .select("*")
        .eq("active", true)
        .in("placement", ["feed", "both"])
    )
      .then(({ data }) => setAds((data ?? []) as Ad[]))
      .catch(() => setAds([]));
  }, [supabase, withTimeout]);

  /**
   * وظيفة جلب البيانات من Supabase - محسّنة بـ Parallel Queries
   * بدلاً من 3-4 رحلات متسلسلة، بنبعت طلبين بالتوازي فقط
   */
  const fetchPage = useCallback(
    async (targetPage: number) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      if (targetPage === 0) setLoading(true);
      else setLoadingMore(true);

      try {
        const from = targetPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const currentUserId = userIdRef.current;

        // 🚀 طلب واحد يجيب المنشورات + likes count مدمجة
        const postsQuery = supabase
          .from("posts")
          .select(
            `id, author_id, content, image_url, created_at, updated_at,
            is_authentic, seal_requested,
            profiles(full_name, avatar_url, email, username, is_pro),
            likes(count)`
          )
          .order("created_at", { ascending: false })
          .range(from, to);

        // 🚀 طلبان للمستخدم يشتغلان بالتوازي مع طلب المنشورات
        const userQueriesPromise = currentUserId
          ? Promise.all([
              supabase.from("likes").select("post_id").eq("user_id", currentUserId),
              supabase.from("saved_posts").select("post_id").eq("user_id", currentUserId),
            ])
          : Promise.resolve([{ data: null }, { data: null }] as const);

        // ⚡ نبعتهم كلهم بالتوازي
        const [{ data, error }, userResults] = await withTimeout(
          Promise.all([postsQuery, userQueriesPromise])
        );

        if (error) {
          toast.error(error.message);
          return;
        }

        const [{ data: myLikes }, { data: mySaves }] = userResults as [
          { data: { post_id: string }[] | null },
          { data: { post_id: string }[] | null }
        ];

        const likedIds = new Set((myLikes ?? []).map((l) => l.post_id));
        const savedIds = new Set((mySaves ?? []).map((s) => s.post_id));

        const hydrated: Post[] = (data ?? [])
          .map((item) => {
            const record = item as Record<string, unknown>;
            const likesArr = record.likes as { count: number }[] | null;
            return {
              ...record,
              profiles: Array.isArray(record.profiles)
                ? record.profiles[0] ?? null
                : record.profiles,
              likes_count: likesArr?.[0]?.count ?? 0,
              liked_by_me: likedIds.has(record.id as string),
              saved_by_me: savedIds.has(record.id as string),
            } as Post;
          })
          .filter((post) => {
            // If it's an authenticity post, check if it's older than 24h
            if (post.is_authentic) {
              const age = Date.now() - new Date(post.created_at).getTime();
              return age < 86400000; // 24 hours in ms
            }
            return true;
          });

        // مزامنة البيانات مع المخزن العام (Global Store)
        useInteractionStore.getState().addLikedPosts(Array.from(likedIds));
        useInteractionStore.getState().addSavedPosts(Array.from(savedIds));

        setPosts((prev) =>
          targetPage === 0 ? hydrated : [...prev, ...hydrated]
        );
        setHasMore(hydrated.length === PAGE_SIZE);
      } catch (err) {
        console.error("Feed fetch failed:", err);
        toast.error(locale === "ar" ? "تعذر تحميل البيانات. حاول مرة أخرى." : "Failed to load data. Please try again.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
        isFetchingRef.current = false;
      }
    },
    // ✅ نستخدم supabase و locale و withTimeout فقط — مش user مباشرة
    [supabase, locale, withTimeout]
  );

  useEffect(() => {
    fetchPage(0);
  }, [fetchPage]);

  // Refresh current feed when user returns to tab or network comes back
  useEffect(() => {
    const refreshFeed = () => {
      setPage(0);
      fetchPage(0);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshFeed();
    };

    const onOnline = () => refreshFeed();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
    };
  }, [fetchPage]);

  // مراقب التحديثات اللحظية للمنشورات الجديدة
  useEffect(() => {
    const channel = supabase
      .channel("feed-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        async (payload) => {
          const newPostRaw = payload.new as { id: string; author_id: string; content: string; image_url: string | null; created_at: string; updated_at: string };
          // جلب بيانات البروفايل للمنشور الجديد لإظهاره بشكل كامل
          const { data: profileData } = await supabase
            .from("profiles")
            .select("full_name,avatar_url,email,username,is_pro")
            .eq("id", newPostRaw.author_id)
            .single();

          const hydrated: Post = {
            ...newPostRaw,
            profiles: profileData,
            liked_by_me: false,
            likes_count: 0,
            saved_by_me: false
          };

          setPosts((prev) => [hydrated, ...prev]);
          toast.info(locale === "ar" ? "✨ منشور جديد ملهم!" : "✨ New inspiring post!");
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "posts" },
        (payload) => {
          setPosts((prev) => prev.filter((p) => p.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, locale]);

  // Infinite scroll
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          const next = page + 1;
          setPage(next);
          fetchPage(next);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, page, fetchPage]);

  const canEdit = useMemo(
    () =>
      (post: Post) =>
        !!user &&
        (post.author_id === user.id || profile?.role === "admin"),
    [profile?.role, user]
  );

  const handleLike = async (post: Post) => {
    if (!user) return toast.info(locale === "ar" ? "يرجى تسجيل الدخول للإعجاب" : "Please login to like posts");
    
    const optimistic = !post.liked_by_me;
    
    // تحديث الواجهة فوراً (Optimistic UI)
    setPosts((prev) =>
      prev.map((item) =>
        item.id === post.id
          ? {
              ...item,
              liked_by_me: optimistic,
              likes_count: Math.max(0, (item.likes_count ?? 0) + (optimistic ? 1 : -1)),
            }
          : item
      )
    );

    if (optimistic) {
      const { error } = await supabase
        .from("likes")
        .insert({ user_id: user.id, post_id: post.id });
      
      if (!error) {
        if (post.author_id !== user.id) {
          await supabase.from("notifications").insert({
            user_id: post.author_id,
            type: "like",
            actor_id: user.id,
            target_id: post.id,
            content: locale === "ar" ? "أعجب بمنشورك" : "liked your post"
          });
        }
      } else {
        // تراجع عن التغيير في حالة الخطأ
        setPosts((prev) => prev.map((item) => item.id === post.id ? { ...item, liked_by_me: false, likes_count: Math.max(0, (item.likes_count ?? 1) - 1) } : item));
      }
    } else {
      // إلغاء الإعجاب
      const { error } = await supabase
        .from("likes")
        .delete()
        .eq("user_id", user.id)
        .eq("post_id", post.id);
        
      if (error) {
        // تراجع عن التغيير في حالة الخطأ
        setPosts((prev) => prev.map((item) => item.id === post.id ? { ...item, liked_by_me: true, likes_count: (item.likes_count ?? 0) + 1 } : item));
      }
    }
  };

  const handleDelete = async (post: Post) => {
    const backup = [...posts];
    setPosts((prev) => prev.filter((x) => x.id !== post.id));
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) {
      toast.error(error.message);
      setPosts(backup);
    } else {
      toast.success(locale === "ar" ? "تم الحذف" : "Post deleted");
    }
  };

  const handleUpdated = (updated: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleCreated = (newPost: Post) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  // Interleave ads into posts
  const feedItems = useMemo(() => {
    if (!ads.length) return posts.map((p) => ({ type: "post" as const, data: p }));
    const items: ({ type: "post"; data: Post } | { type: "ad"; data: Ad })[] = [];
    let adIdx = 0;
    posts.forEach((post, i) => {
      items.push({ type: "post", data: post });
      if ((i + 1) % AD_EVERY === 0 && adIdx < ads.length) {
        items.push({ type: "ad", data: ads[adIdx % ads.length] });
        adIdx++;
      }
    });
    return items;
  }, [posts, ads]);

  return (
    <>
      <LivePulse locale={locale} />
      <RitualBanner locale={locale} />
      
      {/* Create post button */}
      {user && (
        <motion.button
          onClick={() => setCreateOpen(true)}
          className="glass w-full rounded-2xl px-5 py-4 flex items-center gap-3 text-start hover:border-[var(--border-hover)] transition-colors"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.99 }}
        >
          <div className="h-9 w-9 rounded-full brand-gradient flex items-center justify-center shrink-0">
            <FiPlusCircle size={18} className="text-white" />
          </div>
          <span className="text-muted text-sm">{t.modal.postContent}</span>
        </motion.button>
      )}

      {/* Feed */}
      <section className="space-y-4">
        <AnimatePresence mode="popLayout">
          {feedItems.map((item, i) =>
            item.type === "post" ? (
              <PostCard
                key={item.data.id}
                post={item.data}
                canEdit={canEdit(item.data)}
                onLike={handleLike}
                onDelete={handleDelete}
                onUpdated={handleUpdated}
              />
            ) : (
              <motion.div
                key={`ad-${i}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <AdBanner ad={item.data} />
              </motion.div>
            )
          )}
        </AnimatePresence>

        {loading && posts.length === 0 && Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />)}

        {/* Infinite scroll sentinel */}
        <div ref={loadMoreRef} className="h-4" />

        {loadingMore && (
          <div className="flex justify-center py-4">
            <FiRefreshCw className="animate-spin text-[var(--muted)]" size={20} />
          </div>
        )}

        {!loading && !hasMore && posts.length > 0 && (
          <p className="text-center text-muted text-sm py-4">{locale === "ar" ? "لقد وصلت للنهاية ✨" : "You've reached the end ✨"}</p>
        )}

        {!loading && posts.length === 0 && (
          <div className="glass rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3">✨</div>
            <p className="font-medium">{t.noPosts}</p>
            <p className="text-muted text-sm mt-1">{locale === "ar" ? "كُن أول من يشارك قصة ملهمة" : "Be the first to share something inspiring"}</p>
            {user && (
              <button onClick={() => setCreateOpen(true)} className="btn-primary mt-4">
                {t.createPost}
              </button>
            )}
          </div>
        )}
      </section>

      <CreatePostModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
