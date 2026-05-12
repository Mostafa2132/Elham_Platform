"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiWind, FiZap, FiSun } from "react-icons/fi";
import { Avatar } from "@/components/ui/avatar";
import { type Post, type Locale } from "@/types";
import { translations } from "@/data/translations";

export function ZenViewer({ 
  post, 
  locale, 
  onClose,
  themeClass
}: { 
  post: Post; 
  locale: Locale; 
  onClose: () => void;
  themeClass: string;
}) {
  const t = translations[locale];
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // منع التمرير في الخلفية أثناء فتح الـ Modal
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={`fixed top-0 left-0 w-screen h-screen z-[9999] flex items-center justify-center p-6 md:p-12 overflow-hidden bg-[#0B0F19] text-white`}
    >
      {/* Dynamic Atmosphere Particles (Optimized) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              x: [0, 30, 0],
              y: [0, 30, 0],
              opacity: [0.05, 0.1, 0.05],
            }}
            transition={{
              duration: 8 + i * 4,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute rounded-full blur-[40px] will-change-transform"
            style={{
              width: "50vw",
              height: "50vw",
              left: `${i * 30}%`,
              top: `${i * 20}%`,
              background: i % 2 === 0 ? "var(--brand-a)" : "var(--accent)"
            }}
          />
        ))}
      </div>

      {/* Close Button */}
      <button 
        onClick={onClose}
        className="absolute top-8 right-8 z-20 btn-ghost p-3 rounded-full hover:bg-white/10 transition-colors"
      >
        <FiX size={28} />
      </button>

      {/* Main Content */}
      <motion.div
        initial={{ y: 50, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-4xl w-full relative z-10 text-center space-y-12"
      >
        <div className="flex flex-col items-center gap-6">
          <Avatar src={post.profiles?.avatar_url} name={post.profiles?.full_name} size={64} />
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-xs font-black uppercase tracking-[0.3em] text-white/40"
          >
            {post.profiles?.full_name} {t.actions.sharingInspiration}
          </motion.p>
        </div>

        <div className="relative">
          <FiWind className="absolute -top-16 -left-8 md:-left-16 text-white/5 text-8xl rotate-12" />
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-serif font-black italic first-letter:text-[1.5em] leading-[1.3] text-white drop-shadow-2xl">
            {post.content.replace(/\[T:\w+\]/g, "").replace(/\[P:[\w-]+\]/g, "").trim()}
          </h1>
          <FiSun className="absolute -bottom-16 -right-8 md:-right-16 text-white/5 text-8xl" />
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex items-center justify-center gap-4 text-white/20"
        >
          <div className="h-[1px] w-12 bg-current" />
          <p className="text-[10px] font-bold uppercase tracking-widest leading-none">
            {t.brand} • {t.actions.zenExperience}
          </p>
          <div className="h-[1px] w-12 bg-current" />
        </motion.div>
      </motion.div>

      {/* Overlay Effects */}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)]/40 via-transparent to-transparent pointer-events-none" />
    </motion.div>,
    document.body
  );
}
