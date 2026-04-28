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
const PAGE_SIZE = 6;
const AD_EVERY = 3; 

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

  // تحميل الإعلانات المخصصة للخلاصة عند بدء التشغيل
  useEffect(() => {
    supabase
      .from("ads")
      .select("*")
      .eq("active", true)
      .in("placement", ["feed", "both"])
      .then(({ data }) => setAds((data ?? []) as Ad[]));
  }, [supabase]);

  /**
   * وظيفة جلب البيانات من Supabase
   * تدعم الصفحات (Pagination) لتحسين الأداء وتقليل استهلاك البيانات
   */
  const fetchPage = useCallback(
    async (targetPage: number) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      if (targetPage === 0) setLoading(true);
      else setLoadingMore(true);

      const from = targetPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from("posts")
        .select(
          "id,author_id,content,image_url,created_at,updated_at,profiles(full_name,avatar_url,email,username,is_pro)"
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        toast.error(error.message);
        setLoading(false);
        setLoadingMore(false);
        isFetchingRef.current = false;
        return;
      }

      const hydrated: Post[] = (data ?? []).map((item) => {
        const record = item as Record<string, unknown>;
        return {
          ...record,
          profiles: Array.isArray(record.profiles)
            ? record.profiles[0] ?? null
            : record.profiles,
        } as Post;
      });

      if (hydrated.length) {
        const postIds = hydrated.map((p) => p.id);
        const { data: likeCounts } = await supabase
          .from("likes")
          .select("post_id")
          .in("post_id", postIds);

        const counts =
          (likeCounts as { post_id: string }[] | null)?.reduce((acc: Record<string, number>, item) => {
            acc[item.post_id] = (acc[item.post_id] ?? 0) + 1;
            return acc;
          }, {} as Record<string, number>) ?? {};

        let likedIds = new Set<string>();
        let savedIds = new Set<string>();
        
        if (user) {
          const [
            { data: myLikes },
            { data: mySaves }
          ] = await Promise.all([
            supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", postIds),
            supabase.from("saved_posts").select("post_id").eq("user_id", user.id).in("post_id", postIds)
          ]);
          
          likedIds = new Set((myLikes as { post_id: string }[] | null ?? []).map((l) => l.post_id));
          savedIds = new Set((mySaves as { post_id: string }[] | null ?? []).map((s) => s.post_id));
        }

        hydrated.forEach((p) => {
          p.liked_by_me = likedIds.has(p.id);
          p.saved_by_me = savedIds.has(p.id);
          p.likes_count = counts[p.id] ?? 0;
        });

        // مزامنة البيانات مع المخزن العام (Global Store)
        useInteractionStore.getState().addLikedPosts(Array.from(likedIds));
        useInteractionStore.getState().addSavedPosts(Array.from(savedIds));
      }

      setPosts((prev) =>
        targetPage === 0 ? hydrated : [...prev, ...hydrated]
      );
      setHasMore(hydrated.length === PAGE_SIZE);
      setLoading(false);
      setLoadingMore(false);
      isFetchingRef.current = false;
    },
    [supabase, user]
  );

  useEffect(() => {
    fetchPage(0);
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
