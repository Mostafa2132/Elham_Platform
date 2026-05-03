"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import { FiHeart, FiTrash2, FiEdit3, FiMoreHorizontal, FiX, FiZap, FiStar, FiSmile, FiDownload, FiSun, FiCoffee, FiGitBranch, FiShield, FiArchive, FiCheckCircle } from "react-icons/fi";
import Image from "next/image";
import Link from "next/link";
import confetti from "canvas-confetti";
import { getSupabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { SupportModal } from "./support-modal";
import { CreatePostModal } from "./create-post-modal";
import { FlowModal } from "./flow-modal";
import { useParams } from "next/navigation";
import { translations } from "@/data/translations";
import { type Post, type Locale, type Profile } from "@/types";
import { AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import { getBadge } from "@/lib/constants";
import { POST_THEMES } from "@/lib/constants";
import { downloadPostAsImage } from "@/lib/card-renderer";
import { ZenViewer } from "./zen-viewer";
import { useInteractionStore } from "@/store/interaction-store";

// إعدادات التفاعلات (Reactions) المتاحة للمنشورات
const REACTIONS = [
  { id: "like", icon: FiHeart, color: "text-pink-500", bg: "bg-pink-500/10", border: "border-pink-500/20", label: "Like", particles: ["#ec4899", "#f43f5e"] },
  { id: "love", icon: FiHeart, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20", label: "Love", particles: ["#ef4444", "#f43f5e"], fill: true },
  { id: "wow", icon: FiStar, color: "text-cyan-500", bg: "bg-cyan-500/10", border: "border-cyan-500/20", label: "Wow", particles: ["#06b6d4", "#22d3ee"] },
  { id: "inspiring", icon: FiZap, color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/20", label: "Inspiring", particles: ["#eab308", "#fbbf24"], fill: true },
  { id: "haha", icon: FiSmile, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20", label: "Haha", particles: ["#f97316", "#fb923c"] },
];

/**
 * مكون بطاقة المنشور (PostCard)
 * يعرض محتوى المنشور مع تأثيرات بصرية ثلاثية الأبعاد (3D Tilt) ونظام تفاعلات متطور.
 */
export function PostCard({
  post,
  canEdit,
  onLike,
  onDelete,
  onUpdated,
}: {
  post: Post;
  canEdit: boolean;
  onLike: (post: Post) => void;
  onDelete: (post: Post) => void;
  onUpdated: (updated: Post) => void;
}) {
  const params = useParams();
  const locale = (params?.locale as Locale) || "en";
  const t = translations[locale];
  
  // حالات التحكم في القوائم والمودالات
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState(post.liked_by_me ? "like" : null);
  const [zenOpen, setZenOpen] = useState(false);
  const [showTemplateSelect, setShowTemplateSelect] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const reactionBtnRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [reactionPos, setReactionPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const openMenu = () => {
    if (menuBtnRef.current) {
      const rect = menuBtnRef.current.getBoundingClientRect();
      const MENU_WIDTH = 220;
      const VIEWPORT_PADDING = 8;
      const preferredLeft = rect.right - MENU_WIDTH;
      const clampedLeft = Math.max(
        VIEWPORT_PADDING,
        Math.min(preferredLeft, window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING)
      );
      setMenuPos({
        top: rect.bottom + 6,
        left: clampedLeft,
      });
    }
    setMenuOpen(true);
  };

  // 3D Tilt setup
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [6, -6]), { stiffness: 100, damping: 25 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]), { stiffness: 100, damping: 25 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const handleMouseEnterReactions = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    // Calculate position for the portal-based popup
    if (reactionBtnRef.current) {
      const rect = reactionBtnRef.current.getBoundingClientRect();
      setReactionPos({
        top: rect.top - 8, // will be placed above via transform
        left: rect.left,
      });
    }
    setShowReactions(true);
  };

  const handleMouseLeaveReactions = () => {
    timeoutRef.current = setTimeout(() => {
      setShowReactions(false);
    }, 400);
  };

  // Parsing theme from content: "[T:midnight] Hello"
  const themeMatch = post.content.match(/\[T:([\w-]+)\]/);
  const themeId = themeMatch ? themeMatch[1] : "default";
  
  // Chain logic: Detect [P:id]
  const parentMatch = post.content.match(/\[P:([\w-]+)\]/);
  const parentId = parentMatch ? parentMatch[1] : null;
  
  // Clean content from all metadata tags
  const finalContent = post.content
    .replace(/\[T:[\w-]+\]/g, "")
    .replace(/\[P:[\w-]+\]/g, "")
    .trim();
  const displayContent = finalContent; // Kept for backwards compatibility in handleDownload

  const themeConfig = POST_THEMES.find(t => t.id === themeId) || POST_THEMES[0];

  const handleDownload = async (templateId: "standard" | "executive" | "zen" = "standard") => {
    try {
      toast.info(locale === "ar" ? "جاري تحضير البطاقة الملهِمة..." : "Preparing your inspirational card...");
      await downloadPostAsImage({
        authorName: post.profiles?.full_name || post.profiles?.email?.split("@")[0] || "Anonymous",
        avatarUrl: post.profiles?.avatar_url || null,
        content: displayContent,
        themeClass: themeConfig.class,
        templateId
      });
      setShowTemplateSelect(false);
      toast.success(locale === "ar" ? "تم تحميل البطاقة بنجاح! 🎉" : "Card downloaded successfully! 🎉");
    } catch (e) {
      toast.error(locale === "ar" ? "فشل التحميل" : "Download failed");
    }
  };

  const triggerReactionEffect = (reactionId: string, rect: DOMRect) => {
    const reaction = REACTIONS.find(r => r.id === reactionId);
    if (!reaction) return;

    confetti({
      particleCount: 20,
      spread: 70,
      origin: { 
        x: (rect.left + rect.width / 2) / window.innerWidth, 
        y: (rect.top + rect.height / 2) / window.innerHeight 
      },
      colors: reaction.particles,
      shapes: reaction.id === "wow" ? ["star"] : ["circle"],
      gravity: 1.5,
      scalar: reaction.id === "haha" ? 1.2 : 0.8,
      ticks: 60
    });
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (mins < 1) return locale === "ar" ? "الآن" : "just now";
    if (mins < 60) return rtf.format(-mins, "minute");
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return rtf.format(-hrs, "hour");
    return rtf.format(-Math.floor(hrs / 24), "day");
  };

  const requestSeal = async () => {
    const supabase = getSupabase();
    const { error } = await supabase.from("posts").update({ seal_requested: true }).eq("id", post.id);
    if (error) return toast.error(error.message);
    toast.success(t.seal.requested);
    onUpdated({ ...post, seal_requested: true });
  };

  const { savedPostIds, addSavedPost, isSaved: checkIsSaved } = useInteractionStore();
  const isSaved = checkIsSaved(post.id);
  const [vaultAnim, setVaultAnim] = useState(false);

  // Sync initial state from props to store if not already there
  useEffect(() => {
    if (post.saved_by_me && !isSaved) {
      addSavedPost(post.id);
    }
  }, [post.id, post.saved_by_me, addSavedPost, isSaved]);

  const saveToVault = async () => {
    const supabase = getSupabase();
    const { profile } = useAuthStore.getState();
    if (!profile) return toast.info(
      locale === "ar" ? "يرجى تسجيل الدخول أولاً" : "Please login to save to vault"
    );
    
    if (isSaved) {
      toast.info(locale === "ar" ? "محفوظ بالفعل!" : "Already saved!");
      return;
    }

    const { error } = await supabase.from("saved_posts").upsert({
      user_id: profile.id,
      post_id: post.id,
    });

    if (error) return toast.error(error.message);

    addSavedPost(post.id);
    // Trigger the in-card vault animation
    setVaultAnim(true);
    setTimeout(() => setVaultAnim(false), 2200);
  };

  return (
    <>
      <AnimatePresence>
        {zenOpen && (
          <ZenViewer 
            post={post} 
            locale={locale} 
            onClose={() => setZenOpen(false)} 
            themeClass={themeConfig.class} 
          />
        )}
      </AnimatePresence>

      <motion.article
        layout
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className={`relative group/card rounded-3xl p-4 transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)] sm:p-6 ${
          themeId === "default" 
            ? "glass-card" 
            : `backdrop-blur-xl border border-white/10 shadow-xl ${themeConfig.class}`
        }`}
      >
        {/* ─── Vault Saved Overlay ─── */}
        <AnimatePresence>
          {vaultAnim && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 z-50 rounded-3xl flex flex-col items-center justify-center gap-3 backdrop-blur-sm bg-black/60"
              style={{ pointerEvents: "none" }}
            >
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.05 }}
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl shadow-amber-500/40"
              >
                <FiArchive size={28} className="text-white" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-center"
              >
                <p className="font-black text-base text-white">
                  {locale === "ar" ? "تم الحفظ في الفولت! 🔐" : "Saved to Vault! 🔐"}
                </p>
                <p className="text-[11px] text-white/50 mt-1 font-bold uppercase tracking-widest">
                  {locale === "ar" ? "في بروفايلك → فولت" : "Find it in Profile → Vault"}
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      {parentId && (
        <button 
          onClick={() => setFlowOpen(true)}
          className="mb-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 w-fit hover:bg-indigo-500/10 hover:border-indigo-500/20 transition-all group"
        >
          <FiGitBranch size={12} className="text-indigo-400 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted group-hover:text-indigo-400 transition-colors">{t.flow.partOfFlow}</span>
        </button>
      )}
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-2 sm:gap-3" style={{ transform: "translateZ(20px)" }}>
          <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
            <Link href={`/${locale}/profile/${post.author_id}`} className="hover:opacity-80 transition-opacity shrink-0 mt-0.5">
              <Avatar
                src={post.profiles?.avatar_url}
                name={post.profiles?.full_name ?? post.profiles?.email}
                size={36}
              />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link href={`/${locale}/profile/${post.author_id}`} className="font-bold text-sm leading-tight transition-colors hover:text-indigo-400 break-words max-w-full">
                  {post.profiles?.full_name || post.profiles?.email?.split("@")[0] || (locale === "ar" ? "مجهول" : "Anonymous")}
                </Link>
                {/* Badge Display */}
                {(() => {
                  const badge = getBadge(post.profiles?.is_pro ? 30 : 2, locale);
                  return (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap ${badge.bg} ${badge.color}`}>
                      <span>{badge.icon}</span>
                      <span>{badge.label}</span>
                    </span>
                  );
                })()}

                {post.profiles?.is_pro && (
                  <span className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white px-1.5 py-0.5 text-[9px] font-bold tracking-wider shadow-[0_0_10px_rgba(251,191,36,0.5)] whitespace-nowrap">
                    {t.monetization.proBadge}
                  </span>
                )}
              </div>
              <p className="text-muted text-xs mt-0.5">{timeAgo(post.created_at)}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0 sm:gap-2" style={{ transform: "translateZ(25px)" }}>
          {/* Share/Zen Actions */}
          <div className="flex items-center gap-0 sm:gap-1">
            <button
               onClick={() => setCreateOpen(true)}
               className="rounded-xl p-1 text-muted transition-all duration-300 hover:bg-indigo-400/5 hover:text-indigo-400 active:scale-95 sm:p-2"
               title={t.flow.continue}
            >
              <FiGitBranch size={16} />
            </button>
            <button
              onClick={() => setSupportOpen(true)}
              className="rounded-xl p-1 text-muted transition-all duration-300 hover:bg-amber-500/5 hover:text-amber-500 active:scale-95 sm:p-2"
              title={t.monetization.supportCreator}
            >
              <FiCoffee size={16} />
            </button>
            <button
              onClick={() => setZenOpen(true)}
              className="rounded-xl p-1 text-muted transition-all duration-300 hover:bg-white/5 hover:text-foreground active:scale-95 sm:p-2"
              title={locale === "ar" ? "وضع الزن" : "Zen Mode"}
            >
              <FiSun size={16} className="transition-transform hover:rotate-45" />
            </button>
            <button
              onClick={() => setShowTemplateSelect(true)}
              className="rounded-xl p-1 text-muted transition-all duration-300 hover:bg-white/5 hover:text-foreground active:scale-95 sm:p-2"
            >
              <FiDownload size={16} />
            </button>
          </div>
            <div className="relative group/menu">
                <button
                  ref={menuBtnRef}
                  onClick={openMenu}
                  className="rounded-full p-1 text-muted transition-all hover:bg-white/10 hover:text-[var(--foreground)] sm:p-2"
                  title={t.common.edit}
                >
                  <FiMoreHorizontal size={16} />
                </button>
              </div>
            </div>

            {/* ─── Dropdown Portal — rendered at body level to escape 3D stacking context ─── */}
            {mounted && menuOpen && createPortal(
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0"
                  style={{ zIndex: 9998 }}
                  onClick={() => setMenuOpen(false)}
                />
                {/* Menu */}
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: -6 }}
                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="glass-card rounded-2xl shadow-2xl min-w-[200px] p-2 border border-white/10 backdrop-blur-3xl"
                    style={{
                      position: "fixed",
                      top: menuPos.top,
                      left: menuPos.left,
                      zIndex: 9999,
                      pointerEvents: "auto",
                    }}
                  >
                    {/* View Flow Journey */}
                    <button
                      onClick={() => { setFlowOpen(true); setMenuOpen(false); }}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold hover:bg-white/10 rounded-xl transition-all group/btn"
                    >
                      <FiGitBranch size={16} className="text-muted group-hover/btn:text-indigo-400" />
                      <span>{locale === "ar" ? "رؤية رحلة الإلهام" : "View Flow Journey"}</span>
                    </button>

                    {/* Request Authenticity Seal */}
                    {canEdit && !post.is_authentic && (
                      <button
                        disabled={post.seal_requested}
                        onClick={() => { requestSeal(); setMenuOpen(false); }}
                        className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold hover:bg-white/10 rounded-xl transition-all group/btn ${post.seal_requested ? "opacity-50" : ""}`}
                      >
                        <FiShield size={16} className="text-muted group-hover/btn:text-amber-400" />
                        <span>{post.seal_requested ? t.seal.requested : t.seal.request}</span>
                      </button>
                    )}

                    {/* ─── Save to Vault ─── */}
                    <button
                      onClick={() => { saveToVault(); setMenuOpen(false); }}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold hover:bg-white/10 rounded-xl transition-all group/btn"
                    >
                      <FiArchive
                        size={16}
                        className={`transition-colors group-hover/btn:text-amber-500 ${isSaved ? "text-amber-500" : "text-muted"}`}
                      />
                      <span className={isSaved ? "text-amber-400" : ""}>
                        {isSaved
                          ? (locale === "ar" ? "✓ تم الحفظ في الفولت" : "✓ Saved to Vault")
                          : (locale === "ar" ? "حفظ في الفولت" : "Save to Vault")}
                      </span>
                    </button>

                    {/* Edit & Delete — owner only */}
                    {canEdit && (
                      <>
                        <div className="my-1 border-t border-white/5" />
                        <button
                          onClick={() => { setEditOpen(true); setMenuOpen(false); }}
                          className="flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold hover:bg-white/10 rounded-xl transition-all group/btn"
                        >
                          <FiEdit3 size={16} className="text-muted group-hover/btn:text-[var(--brand-a)]" />
                          <span>{t.common.edit}</span>
                        </button>
                        <button
                          onClick={() => { onDelete(post); setMenuOpen(false); }}
                          className="flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10 rounded-xl transition-all group/btn"
                        >
                          <FiTrash2 size={16} className="text-red-400/70 group-hover/btn:text-red-400" />
                          <span>{t.common.delete}</span>
                        </button>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </>,
              document.body
            )}
          </div>

        {/* Content */}
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ transform: "translateZ(30px)" }}>
          {finalContent}
        </p>

        {/* Image */}
        {post.image_url && (
          <div className="relative mt-3 h-56 w-full overflow-hidden rounded-xl md:h-72">
            <Image
              src={post.image_url}
              alt="Post image"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 720px"
            />
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 flex items-center gap-3">
          {/* Reaction Picker Trigger Wrapper */}
          <div 
            ref={reactionBtnRef}
            className="relative"
            onMouseEnter={handleMouseEnterReactions}
            onMouseLeave={handleMouseLeaveReactions}
          >
            {/* Reaction popup rendered as portal at body level to escape 3D stacking context */}
            {mounted && showReactions && createPortal(
              <div
                onMouseEnter={handleMouseEnterReactions}
                onMouseLeave={handleMouseLeaveReactions}
                style={{
                  position: "fixed",
                  top: reactionPos.top,
                  left: reactionPos.left,
                  transform: "translateY(-100%)",
                  zIndex: 9999,
                  pointerEvents: "auto",
                }}
              >
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="p-2 rounded-full flex gap-2 shadow-2xl border border-white/10"
                    style={{
                      background: "rgba(17, 22, 44, 0.96)",
                      backdropFilter: "blur(20px)",
                      WebkitBackdropFilter: "blur(20px)",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
                    }}
                  >
                    {REACTIONS.map((r) => (
                      <motion.button
                        key={r.id}
                        whileHover={{ scale: 1.3, y: -5 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          setSelectedReaction(r.id);
                          onLike(post);
                          triggerReactionEffect(r.id, e.currentTarget.getBoundingClientRect());
                          setShowReactions(false);
                        }}
                        className={`p-2 rounded-full transition-all duration-200 ${r.bg} ${r.color} hover:shadow-lg`}
                        title={r.label}
                      >
                        <r.icon size={20} className={r.fill ? "fill-current" : ""} />
                      </motion.button>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>,
              document.body
            )}

            <motion.button
              onMouseEnter={() => {
                if (reactionBtnRef.current) {
                  const rect = reactionBtnRef.current.getBoundingClientRect();
                  setReactionPos({ top: rect.top - 8, left: rect.left });
                }
                setShowReactions(true);
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                if (selectedReaction) {
                  setSelectedReaction(null);
                  onLike(post);
                } else {
                  setSelectedReaction("like");
                  onLike(post);
                  triggerReactionEffect("like", e.currentTarget.getBoundingClientRect());
                }
              }}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-all duration-300 ${
                selectedReaction
                  ? `${REACTIONS.find(r => r.id === selectedReaction)?.border} ${REACTIONS.find(r => r.id === selectedReaction)?.bg} ${REACTIONS.find(r => r.id === selectedReaction)?.color} shadow-lg ring-1 ring-white/20`
                  : "border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10"
              }`}
            >
              <motion.div
                animate={selectedReaction ? { scale: [1, 1.4, 1] } : {}}
                transition={{ duration: 0.3, ease: "backOut" }}
              >
                {(() => {
                  const r = REACTIONS.find(rx => rx.id === selectedReaction) || REACTIONS[0];
                  return <r.icon size={16} className={selectedReaction && r.fill ? "fill-current" : ""} />;
                })()}
              </motion.div>
              <span className="tabular-nums font-bold">{post.likes_count ?? 0}</span>
            </motion.button>
          </div>
        </div>
      </motion.article>

      {/* Edit Modal */}
      <EditPostModal
        open={editOpen}
        post={post}
        onClose={() => setEditOpen(false)}
        onUpdated={onUpdated}
      />

      <Modal 
        open={showTemplateSelect} 
        onClose={() => setShowTemplateSelect(false)}
        title={locale === "ar" ? "اختر نمط البطاقة" : "Select Card Template"}
      >
        <div className="space-y-4 p-4">
          <button 
            onClick={() => handleDownload("standard")}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all text-left"
          >
            <div>
              <p className="font-bold">{locale === "ar" ? "الرئيسي (شفاف)" : "Standard (Glass)"}</p>
              <p className="text-xs text-muted">The classic Elham look</p>
            </div>
            <div className="h-4 w-4 rounded-full border-2 border-indigo-500" />
          </button>

          <button 
            onClick={() => handleDownload("executive")}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-amber-600/50 hover:bg-amber-600/5 transition-all text-left"
          >
            <div>
              <p className="font-bold text-amber-500">{locale === "ar" ? "الملكي (ذهبي)" : "Executive (Gold Edge)"}</p>
              <p className="text-xs text-muted">A premium, dark luxury theme</p>
            </div>
            <div className="h-4 w-4 rounded-full border-2 border-amber-600" />
          </button>

          <button 
            onClick={() => handleDownload("zen")}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left"
          >
            <div>
              <p className="font-bold text-emerald-500">{locale === "ar" ? "الهدوء (بسيط)" : "Zen (Minimalist)"}</p>
              <p className="text-xs text-muted">Pure text, zero distractions</p>
            </div>
            <div className="h-4 w-4 rounded-full border-2 border-emerald-500" />
          </button>
        </div>
      </Modal>

      {post.profiles && (
        <SupportModal 
          open={supportOpen}
          onClose={() => setSupportOpen(false)}
          profile={post.profiles as Profile}
          locale={locale}
        />
      )}

      <CreatePostModal 
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        parentId={post.id}
        onCreated={(p) => {
          onUpdated(post); // trigger refresh
          setCreateOpen(false);
          toast.success("Flow continued!");
        }}
      />

      <FlowModal
        open={flowOpen}
        onClose={() => setFlowOpen(false)}
        post={post}
        locale={locale}
      />
    </>
  );
}

function EditPostModal({
  open,
  post,
  onClose,
  onUpdated,
}: {
  open: boolean;
  post: Post;
  onClose: () => void;
  onUpdated: (p: Post) => void;
}) {
  const params = useParams();
  const locale = (params?.locale as Locale) || "en";
  const t = translations[locale];

  const supabase = getSupabase();

  // Parse existing theme
  const initialThemeMatch = post.content.match(/\[T:([\w-]+)\]/);
  const initialTheme = initialThemeMatch ? initialThemeMatch[1] : "default";
  const initialText = post.content.replace(/\[T:[\w-]+\]/g, "").replace(/\[P:[\w-]+\]/g, "").trim();

  const [selectedTheme, setSelectedTheme] = useState(initialTheme);
  const themeConfig = POST_THEMES.find(t => t.id === selectedTheme) || POST_THEMES[0];

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: { content: initialText },
    validationSchema: Yup.object({ content: Yup.string().min(4, "Too short").required("Required") }),
    onSubmit: async (values) => {
      const prefixedContent = selectedTheme !== "default" ? `[T:${selectedTheme}]${values.content}` : values.content;
      
      const { data, error } = await supabase
        .from("posts")
        .update({ content: prefixedContent, updated_at: new Date().toISOString() })
        .eq("id", post.id)
        .select()
        .single();
      
      if (error) return toast.error(error.message);
      toast.success(locale === "ar" ? "تم تحديث المنشور بنجاح" : "Post updated successfully");
      onUpdated({ ...post, content: prefixedContent });
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={t.common.edit}>
      <form onSubmit={formik.handleSubmit} className="space-y-6">
        <div className={`rounded-xl transition-all duration-500 border border-[var(--border)] overflow-hidden ${selectedTheme !== "default" ? POST_THEMES.find(t => t.id === selectedTheme)?.class : "bg-transparent"}`}>
          <textarea
            name="content"
            rows={4}
            className="w-full bg-transparent p-4 outline-none text-sm leading-relaxed placeholder:text-muted/60 resize-none font-medium"
            placeholder={t.modal.postContent}
            value={formik.values.content}
            onChange={formik.handleChange}
          />
          {formik.errors.content && formik.touched.content && (
            <p className="px-4 pb-2 text-red-500 text-xs font-semibold">{formik.errors.content as string}</p>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-muted mb-2 block">{locale === "ar" ? "تعديل الثيم" : "Edit background theme"}</label>
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {POST_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => setSelectedTheme(theme.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border-2 ${
                  selectedTheme === theme.id 
                    ? "border-[var(--brand-a)] scale-105" 
                    : "border-transparent opacity-60 grayscale hover:grayscale-0 hover:opacity-100"
                } ${theme.class}`}
              >
                {theme.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            {t.common.cancel}
          </button>
          <button type="submit" disabled={formik.isSubmitting} className="btn-primary">
            {formik.isSubmitting ? t.loading : t.common.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}
