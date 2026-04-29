"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { FiEdit3, FiMapPin, FiLink, FiTwitter, FiInstagram, FiGithub, FiCalendar, FiMail, FiCoffee, FiZap, FiArchive, FiLock, FiTrash2 } from "react-icons/fi";
import { toast } from "react-toastify";
import { getSupabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";
import { Avatar } from "@/components/ui/avatar";
import { PostCard } from "@/components/sections/post-card";
import { PostSkeleton } from "@/components/ui/skeletons";
import { EditProfileModal } from "@/components/profile/edit-profile-modal";
import { useParams } from "next/navigation";
import { translations } from "@/data/translations";
import { type Profile, type Post, type Locale } from "@/types";
import { getBadge } from "@/lib/constants";
import { useInteractionStore } from "@/store/interaction-store";

const TABS = ["Posts", "Likes", "Insights", "Vault", "Info"] as const;
type Tab = (typeof TABS)[number];

interface ProfileViewProps {
  profileId?: string; // if omitted, shows current user profile
}

export function ProfileView({ profileId }: ProfileViewProps) {
  const params = useParams();
  const locale = (params?.locale as Locale) || "en";
  const t = translations[locale];

  const supabase = getSupabase();
  const { user, profile: authProfile, setProfile } = useAuthStore();
  const [profile, setLocalProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [vaultPosts, setVaultPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Posts");
  const [editOpen, setEditOpen] = useState(false);
  const [followStats, setFollowStats] = useState({ followers: 0, following: 0, isFollowing: false });
  const [followLoading, setFollowLoading] = useState(false);
  const [collections, setCollections] = useState<{id: string, name: string}[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);

  const targetId = profileId ?? user?.id;
  const isOwn = !profileId || profileId === user?.id;

  useEffect(() => {
    if (!targetId) return;
    const load = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", targetId)
          .single();
        if (error || !data) {
          toast.error("Profile not found");
        } else {
          setLocalProfile(data as Profile);
        }
        
        // Load follow stats
        const [
          { count: followersCount },
          { count: followingCount },
          { data: followStatus }
        ] = await Promise.all([
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", targetId),
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", targetId),
          user ? supabase.from("follows").select("*").eq("follower_id", user.id).eq("following_id", targetId).maybeSingle() : Promise.resolve({ data: null })
        ]);

        setFollowStats({
          followers: followersCount ?? 0,
          following: followingCount ?? 0,
          isFollowing: !!followStatus
        });
      } catch (err) {
        console.error("Profile load failed:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [targetId, supabase, user]);

  const toggleFollow = async () => {
    if (!user) return toast.info("Please login to follow");
    if (isOwn) return;
    
    setFollowLoading(true);
    if (followStats.isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetId);
      setFollowStats(prev => ({ ...prev, followers: prev.followers - 1, isFollowing: false }));
      toast.success(locale === "ar" ? "تم إلغاء المتابعة" : "Unfollowed");
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: targetId });
      setFollowStats(prev => ({ ...prev, followers: prev.followers + 1, isFollowing: true }));
      toast.success(locale === "ar" ? "تمت المتابعة" : "Following");
    }
    setFollowLoading(false);
  };

  useEffect(() => {
    if (!targetId) return;
    const loadPosts = async () => {
      try {
        setPostsLoading(true);
        const { data } = await supabase
          .from("posts")
          .select("id,author_id,content,image_url,created_at,updated_at,profiles(full_name,avatar_url,email,username,is_pro),is_authentic,seal_requested")
          .eq("author_id", targetId)
          .order("created_at", { ascending: false });

        if (data) {
          const hydrated = await hydratePosts(data, user?.id, supabase);
          setPosts(hydrated);
        }
      } catch (err) {
        console.error("Profile posts load failed:", err);
      } finally {
        setPostsLoading(false);
      }
    };
    loadPosts();
  }, [targetId, supabase, user?.id]);

  useEffect(() => {
    if (!targetId) return;
    const refreshVisibleData = () => {
      if (document.visibilityState !== "visible") return;
      if (activeTab === "Likes") loadLikes();
      else if (activeTab === "Vault") loadVault(selectedCollection);
      else {
        // default tab refresh
        supabase
          .from("posts")
          .select("id,author_id,content,image_url,created_at,updated_at,profiles(full_name,avatar_url,email,username,is_pro),is_authentic,seal_requested")
          .eq("author_id", targetId)
          .order("created_at", { ascending: false })
          .then(async ({ data }) => {
            if (!data) return;
            const hydrated = await hydratePosts(data, user?.id, supabase);
            setPosts(hydrated);
          });
      }
    };

    document.addEventListener("visibilitychange", refreshVisibleData);
    window.addEventListener("online", refreshVisibleData);
    return () => {
      document.removeEventListener("visibilitychange", refreshVisibleData);
      window.removeEventListener("online", refreshVisibleData);
    };
  }, [activeTab, targetId, selectedCollection, user?.id]);

  /**
   * وظيفة مساعدة لترطيب المنشورات (جلب عدد الإعجابات وحالة الحفظ)
   */
  async function hydratePosts(rawData: unknown[], currentUserId: string | undefined, /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ supabase: any): Promise<Post[]> {
    const posts = rawData.map((item) => {
      const r = item as Record<string, unknown>;
      return { ...r, profiles: Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles } as Post;
    });

    if (!posts.length) return [];

    const postIds = posts.map(p => p.id);
    
    // 1. جلب عدد الإعجابات لكل منشور
    const { data: likeCounts } = await supabase
      .from("likes")
      .select("post_id")
      .in("post_id", postIds);

    const counts = (likeCounts as { post_id: string }[] | null)?.reduce((acc: Record<string, number>, item) => {
      acc[item.post_id] = (acc[item.post_id] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>) ?? {};

    // 2. جلب حالة الإعجاب والحفظ للمستخدم الحالي
    let likedIds = new Set<string>();
    const savedIds = new Set<string>();

    if (currentUserId) {
      const [
        { data: myLikes },
        { data: mySaves }
      ] = await Promise.all([
        supabase.from("likes").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
        supabase.from("saved_posts").select("post_id, collection_id").eq("user_id", currentUserId).in("post_id", postIds)
      ]);

      likedIds = new Set((myLikes as { post_id: string }[] | null ?? []).map((l) => l.post_id));
      const mySavesTyped = mySaves as { post_id: string, collection_id: string | null }[] | null ?? [];
      const savesMap = new Map<string, string | null>(mySavesTyped.map((s) => [s.post_id, s.collection_id]));
      mySavesTyped.forEach(s => savedIds.add(s.post_id));
      
      posts.forEach(p => {
        p.liked_by_me = likedIds.has(p.id);
        p.saved_by_me = savesMap.has(p.id);
        p.collection_id = savesMap.get(p.id) || null;
      });
    }

    // مزامنة البيانات مع المخزن العام (Global Store)
    useInteractionStore.getState().addLikedPosts(Array.from(likedIds));
    useInteractionStore.getState().addSavedPosts(Array.from(savedIds));

    return posts.map(p => ({
      ...p,
      likes_count: counts[p.id] ?? 0,
    }));
  }

  const loadLikes = async () => {
    if (!targetId) return;
    const { data: likeRows } = await supabase
      .from("likes")
      .select("post_id")
      .eq("user_id", targetId);
    if (!likeRows?.length) { setLikedPosts([]); return; }
    const ids = likeRows.map((l) => l.post_id);
    const { data } = await supabase
      .from("posts")
      .select("id,author_id,content,image_url,created_at,updated_at,profiles(full_name,avatar_url,email,username,is_pro),is_authentic,seal_requested")
      .in("id", ids)
      .order("created_at", { ascending: false });
    
    if (data) {
      const hydrated = await hydratePosts(data, user?.id, supabase);
      setLikedPosts(hydrated);
    }
  };

  const loadVault = async (collectionId?: string | null) => {
    if (!isOwn || !user) return;
    
    // Fetch collections
    const { data: colData } = await supabase.from("collections").select("id, name").eq("user_id", user.id);
    setCollections(colData ?? []);

    let query = supabase
      .from("saved_posts")
      .select("post_id")
      .eq("user_id", user.id);
    
    if (collectionId) {
      query = query.eq("collection_id", collectionId);
    }

    const { data: savedRows } = await query;
    if (!savedRows?.length) { setVaultPosts([]); return; }
    
    const ids = savedRows.map((s) => s.post_id);
    const { data } = await supabase
      .from("posts")
      .select("id,author_id,content,image_url,created_at,updated_at,profiles(full_name,avatar_url,email,username,is_pro),is_authentic,seal_requested")
      .in("id", ids)
      .order("created_at", { ascending: false });

    if (data) {
      const hydrated = await hydratePosts(data, user?.id, supabase);
      setVaultPosts(hydrated);
    }
  };

  const createCollection = async (name: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("collections")
      .insert({ user_id: user.id, name })
      .select()
      .single();
    
    if (error) return toast.error(error.message);
    setCollections(prev => [...prev, data]);
    toast.success(locale === "ar" ? "تم إنشاء المجموعة" : "Collection created");
  };

  useEffect(() => {
    if (activeTab === "Likes") loadLikes();
    if (activeTab === "Vault") loadVault(selectedCollection);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, targetId, selectedCollection]);

  const handleProfileUpdated = (updated: Profile) => {
    setLocalProfile(updated);
    if (isOwn) setProfile(updated); // sync Zustand store
  };

  const handleLike = async (post: Post) => {
    if (!user) return toast.info("Please login first");
    const optimistic = !post.liked_by_me;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, liked_by_me: optimistic, likes_count: (p.likes_count ?? 0) + (optimistic ? 1 : -1) }
          : p
      )
    );
    if (optimistic) {
      await supabase.from("likes").insert({ user_id: user.id, post_id: post.id });
    } else {
      await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", post.id);
    }
  };

  const handleDelete = async (post: Post) => {
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) toast.error(error.message);
    else toast.success("Post deleted");
  };

  const handleUpdated = (updated: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  if (loading) {
    return (
      <div className="space-y-0">
        <div className="skeleton h-44 w-full rounded-t-2xl" />
        <div className="glass rounded-b-2xl px-6 pb-6 pt-0">
          <div className="flex items-end gap-4 -mt-10 mb-4">
            <div className="skeleton h-20 w-20 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="glass rounded-2xl p-12 text-center">
        <p className="text-muted">Profile not found</p>
      </div>
    );
  }

  const joinedDate = new Date(profile.created_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <div className="space-y-4">
        {/* Profile Header Card */}
        <div className="glass overflow-hidden rounded-3xl">
          {/* Cover */}
          <div className="relative h-44 bg-gradient-to-br from-indigo-500/60 via-purple-500/60 to-cyan-500/40">
            {profile.cover_url && (
              <Image
                src={profile.cover_url}
                alt="Cover"
                fill
                className="object-cover"
                sizes="100vw"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          </div>

          {/* Profile info */}
          <div className="px-6 pb-6">
            <div className="flex flex-wrap items-end justify-between -mt-10 mb-4 relative z-10 gap-4">
              <div className="ring-4 ring-[var(--bg-soft)] rounded-full bg-[var(--bg-soft)] shrink-0">
                <Avatar src={profile.avatar_url} name={profile.full_name ?? profile.email} size={80} />
              </div>
              <div className="flex items-center gap-2 mt-12">
                {!isOwn && (
                  <>
                    <button 
                      onClick={toggleFollow}
                      disabled={followLoading}
                      className={`btn-primary px-6 h-10 text-sm font-bold rounded-2xl transition-all ${
                        followStats.isFollowing 
                          ? "bg-white/10 text-white border border-white/10 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20" 
                          : "bg-indigo-600 text-white border-none shadow-lg shadow-indigo-600/20"
                      }`}
                    >
                      {followLoading ? "..." : (followStats.isFollowing ? (locale === "ar" ? "إلغاء المتابعة" : "Unfollow") : (locale === "ar" ? "متابعة" : "Follow"))}
                    </button>
                    <button onClick={() => toast.success("Simulating checkout... Thanks for supporting!")} className="btn-primary flex items-center gap-2 text-sm bg-gradient-to-r from-amber-500 to-orange-500 border-none text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40">
                      <FiCoffee size={14} /> {t.monetization.supportCreator}
                    </button>
                  </>
                )}
                {isOwn && (
                  <button
                    onClick={() => setEditOpen(true)}
                    className="btn-ghost flex items-center gap-2 text-sm"
                  >
                    <FiEdit3 size={14} /> {t.profileView.editProfile}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <h1 className="text-xl font-bold leading-tight flex items-center gap-2 flex-wrap">
                  <span>{profile.full_name || "Anonymous"}</span>
                  
                  {/* Badge Display */}
                  {(() => {
                    const badge = getBadge(posts.length, locale);
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.bg} ${badge.color} border border-current/20`}>
                        <span>{badge.icon}</span>
                        <span>{badge.label}</span>
                      </span>
                    );
                  })()}

                  {profile.is_pro && (
                    <span className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white px-2 py-0.5 text-[10px] font-bold tracking-wider shadow-[0_0_12px_rgba(251,191,36,0.5)]">
                      {t.monetization.proBadge}
                    </span>
                  )}
                </h1>
                {profile.username && (
                  <p className="text-muted text-sm">@{profile.username}</p>
                )}
              </div>

              {profile.bio && (
                <p className="text-sm leading-relaxed max-w-lg">{profile.bio}</p>
              )}

              {/* Meta info */}
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-muted text-xs pt-1">
                {profile.location && (
                  <span className="flex items-center gap-1.5">
                    <FiMapPin size={12} />
                    {profile.location}
                  </span>
                )}
                {profile.website && (
                  <a
                    href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-[var(--brand-a)] transition-colors"
                  >
                    <FiLink size={12} />
                    {profile.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
                <span className="flex items-center gap-1.5">
                  <FiCalendar size={12} />
                  {t.profileView.joined} {joinedDate}
                </span>
              </div>

              {/* Social links */}
              {(profile.twitter || profile.instagram || profile.github) && (
                <div className="flex gap-3 pt-1">
                  {profile.twitter && (
                    <a
                      href={`https://twitter.com/${profile.twitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost p-2 rounded-full"
                      aria-label="Twitter"
                    >
                      <FiTwitter size={15} />
                    </a>
                  )}
                  {profile.instagram && (
                    <a
                      href={`https://instagram.com/${profile.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost p-2 rounded-full"
                      aria-label="Instagram"
                    >
                      <FiInstagram size={15} />
                    </a>
                  )}
                  {profile.github && (
                    <a
                      href={`https://github.com/${profile.github}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost p-2 rounded-full"
                      aria-label="GitHub"
                    >
                      <FiGithub size={15} />
                    </a>
                  )}
                </div>
              )}

              {/* Stats */}
              <div className="flex gap-6 pt-2 border-t border-[var(--border)] text-sm">
                <div>
                  <span className="font-bold">{posts.length}</span>
                  <span className="text-muted ms-1.5">{t.profileView.postsTab}</span>
                </div>
                <div>
                  <span className="font-bold">{followStats.followers}</span>
                  <span className="text-muted ms-1.5">{locale === "ar" ? "متابع" : "Followers"}</span>
                </div>
                <div>
                  <span className="font-bold">{followStats.following}</span>
                  <span className="text-muted ms-1.5">{locale === "ar" ? "يتابع" : "Following"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="tab-bar px-4 pt-2">
            {TABS.filter(t => t !== "Vault" || isOwn).map((tab) => (
              <button
                key={tab}
                className={`tab-item ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "Posts" ? t.profileView.postsTab : 
                 tab === "Likes" ? t.profileView.likesTab : 
                 tab === "Insights" ? (locale === "ar" ? "التحليلات" : "Insights") : 
                 tab === "Vault" ? t.vault.title :
                 t.profileView.infoTab}
              </button>
            ))}
          </div>

          <div className="p-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                {activeTab === "Posts" && (
                  <div className="space-y-4">
                    {postsLoading && <PostSkeleton />}
                    {!postsLoading && posts.length === 0 && (
                      <p className="text-center text-muted py-8">{t.noPosts}</p>
                    )}
                    {posts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        canEdit={!!user && (post.author_id === user.id || authProfile?.role === "admin")}
                        onLike={handleLike}
                        onDelete={handleDelete}
                        onUpdated={handleUpdated}
                      />
                    ))}
                  </div>
                )}

                {activeTab === "Likes" && (
                  <div className="space-y-4">
                    {likedPosts.length === 0 && (
                      <p className="text-center text-muted py-8">{t.profileView.noLikedPosts}</p>
                    )}
                    {likedPosts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        canEdit={false}
                        onLike={handleLike}
                        onDelete={handleDelete}
                        onUpdated={handleUpdated}
                      />
                    ))}
                  </div>
                )}

                {activeTab === "Info" && (
                  <div className="space-y-4">
                    <InfoRow icon={<FiMail size={14} />} label="Email" value={profile.email} />
                    {profile.location && (
                      <InfoRow icon={<FiMapPin size={14} />} label={t.modal.location} value={profile.location} />
                    )}
                    {profile.website && (
                      <InfoRow
                        icon={<FiLink size={14} />}
                        label={t.modal.website}
                        value={profile.website}
                        href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                      />
                    )}
                    {profile.bio && (
                      <InfoRow label={t.modal.bio} value={profile.bio} />
                    )}
                    <InfoRow icon={<FiCalendar size={14} />} label={t.profileView.joined} value={joinedDate} />
                    {profile.role === "admin" && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted">{t.profileView.role}</span>
                        <span className="brand-gradient text-white text-xs px-2 py-0.5 rounded-full font-medium">
                          Admin
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "Insights" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                        <p className="text-[10px] font-black uppercase text-muted mb-1">{t.profileView.insights.reach}</p>
                        <p className="text-2xl font-black text-indigo-400">
                          {posts.reduce((acc, p) => acc + (p.likes_count ?? 0), 0)}
                        </p>
                        <p className="text-[9px] text-muted mt-1">{t.profileView.insights.reachDesc}</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                        <p className="text-[10px] font-black uppercase text-muted mb-1">{t.profileView.insights.velocity}</p>
                        <p className="text-2xl font-black text-emerald-400">
                          {posts.length > 0 ? (posts.length / 7).toFixed(1) : 0}
                        </p>
                        <p className="text-[9px] text-muted mt-1">{t.profileView.insights.velocityDesc}</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                       <p className="text-[10px] font-black uppercase text-muted mb-4">{t.profileView.insights.creativePulse}</p>
                       <div className="h-24 w-full flex items-end gap-1">
                          {Array.from({ length: 12 }).map((_, i) => {
                            const val = Math.random() * 80 + 10;
                            return (
                              <motion.div 
                                key={i}
                                initial={{ height: 0 }}
                                animate={{ height: `${val}%` }}
                                className="flex-1 rounded-t-sm bg-gradient-to-t from-indigo-500/20 to-indigo-500/60"
                              />
                            );
                          })}
                       </div>
                       <div className="flex justify-between text-[8px] text-muted mt-2 font-bold uppercase tracking-widest">
                          <span>{t.profileView.insights.activityRange}</span>
                          <span>{t.profileView.insights.growthLevel}</span>
                       </div>
                    </div>

                    <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 flex items-center gap-3">
                      <FiZap className="text-indigo-400" />
                      <p className="text-[11px] font-medium leading-relaxed">
                        {t.profileView.insights.topCreator}
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === "Vault" && isOwn && (
                  <div className="space-y-4">
                    {/* Vault Header */}
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-9 h-9 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <FiArchive size={16} className="text-amber-400" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{locale === "ar" ? "فولت الحكمة الخاص بك" : "Your Wisdom Vault"}</p>
                        <p className="text-[10px] text-muted uppercase tracking-widest font-bold">
                          {vaultPosts.length} {locale === "ar" ? "منشور محفوظ" : "saved posts"}
                        </p>
                      </div>
                      <div className="ms-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                        <FiLock size={10} className="text-amber-400" />
                        <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">
                          {locale === "ar" ? "خاص" : "Private"}
                        </span>
                      </div>
                    </div>

                    {/* Collections Bar */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-4">
                      <button
                        onClick={() => setSelectedCollection(null)}
                        className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          selectedCollection === null
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-white/5 border-white/10 text-muted hover:border-white/20"
                        }`}
                      >
                        {locale === "ar" ? "الكل" : "All"}
                      </button>
                      {collections.map((col) => (
                        <button
                          key={col.id}
                          onClick={() => setSelectedCollection(col.id)}
                          className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap ${
                            selectedCollection === col.id
                              ? "bg-amber-500 text-white border-amber-500"
                              : "bg-white/5 border-white/10 text-muted hover:border-white/20"
                          }`}
                        >
                          {col.name}
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          const name = prompt(locale === "ar" ? "أدخل اسم المجموعة الجديدة:" : "Enter new collection name:");
                          if (name) createCollection(name);
                        }}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all border border-dashed border-amber-500/30 text-amber-500 hover:bg-amber-500/5 whitespace-nowrap"
                      >
                        + {locale === "ar" ? "مجموعة جديدة" : "New Collection"}
                      </button>
                    </div>

                    {vaultPosts.length === 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="py-16 text-center rounded-3xl border border-dashed border-amber-500/20 bg-amber-500/5"
                      >
                        <div className="text-5xl mb-4">🔐</div>
                        <p className="font-bold text-sm mb-1">{locale === "ar" ? "الفولت فارغ" : "Your vault is empty"}</p>
                        <p className="text-muted text-xs max-w-[220px] mx-auto leading-relaxed">
                          {locale === "ar"
                            ? "احفظ المنشورات الملهِمة من خلال قائمة ••• في أي بوست"
                            : "Save inspiring posts using the ••• menu on any post"}
                        </p>
                      </motion.div>
                    )}

                    <div className="grid gap-3">
                      {vaultPosts.map((post, i) => {
                        const clean = post.content
                          .replace(/^\[T:\w+\]/, "")
                          .replace(/\[P:[\w-]+\]/g, "")
                          .trim();
                        return (
                          <motion.div
                            key={post.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="group relative p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all"
                          >
                            {/* Vault glow accent */}
                            <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl bg-gradient-to-b from-amber-400/60 to-amber-600/20" />

                            <div className="flex items-start gap-3">
                              <Avatar
                                src={post.profiles?.avatar_url}
                                name={post.profiles?.full_name ?? post.profiles?.email}
                                size={36}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-amber-400/80 mb-1">
                                  {post.profiles?.full_name || post.profiles?.email?.split("@")[0]}
                                </p>
                                <p className="text-sm leading-relaxed line-clamp-3 text-foreground/80">
                                  {clean}
                                </p>
                                
                                {/* Collection Selector */}
                                <div className="mt-3 flex items-center gap-2">
                                  <select
                                    value={post.collection_id || ""}
                                    onChange={async (e) => {
                                      const colId = e.target.value || null;
                                      const { error } = await supabase
                                        .from("saved_posts")
                                        .update({ collection_id: colId })
                                        .eq("user_id", user!.id)
                                        .eq("post_id", post.id);
                                      
                                      if (error) return toast.error(error.message);
                                      toast.success(locale === "ar" ? "تم النقل" : "Moved to collection");
                                      loadVault(selectedCollection);
                                    }}
                                    className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-muted focus:outline-none focus:border-amber-500/50"
                                  >
                                    <option value="" className="bg-slate-900">{locale === "ar" ? "بلا مجموعة" : "No Collection"}</option>
                                    {collections.map(c => (
                                      <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <button
                                onClick={async () => {
                                  await supabase.from("saved_posts").delete().eq("user_id", user!.id).eq("post_id", post.id);
                                  setVaultPosts(prev => prev.filter(p => p.id !== post.id));
                                  toast.success(locale === "ar" ? "تم الحذف من الفولت" : "Removed from vault");
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-400"
                                title={locale === "ar" ? "إزالة من الفولت" : "Remove from vault"}
                              >
                                <FiTrash2 size={14} />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <EditProfileModal
        open={editOpen}
        profile={profile}
        onClose={() => setEditOpen(false)}
        onUpdated={handleProfileUpdated}
      />
    </>
  );
}

function InfoRow({
  icon,
  label,
  value,
  href,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-[var(--border)] last:border-0">
      {icon && <span className="text-muted mt-0.5">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-muted text-xs mb-0.5">{label}</p>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--brand-a)] hover:underline truncate block">
            {value}
          </a>
        ) : (
          <p className="text-sm">{value}</p>
        )}
      </div>
    </div>
  );
}
