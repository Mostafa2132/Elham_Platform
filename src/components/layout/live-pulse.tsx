"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiZap, FiUserPlus, FiTrendingUp, FiActivity } from "react-icons/fi";
import { translations } from "@/data/translations";
import { type Locale } from "@/types";

const EVENTS = (isAr: boolean) => [
  { id: 1, icon: <FiZap className="text-yellow-400" />, text: isAr ? "إلهام جديد تم نشره الآن" : "A new inspiration was just shared", color: "from-yellow-400/20" },
  { id: 2, icon: <FiUserPlus className="text-blue-400" />, text: isAr ? "انضم مبدع جديد إلى مجتمعنا" : "A new Creator just joined the elite", color: "from-blue-400/20" },
  { id: 3, icon: <FiTrendingUp className="text-emerald-400" />, text: isAr ? "تفاعل عالي على حكم اليوم" : "High engagement on today's wisdoms", color: "from-emerald-400/20" },
  { id: 4, icon: <FiActivity className="text-purple-400" />, text: isAr ? "معدل الإبداع في ارتفاع مستمر" : "Activity pulse is reaching new peaks", color: "from-purple-400/20" },
];

export function LivePulse({ locale }: { locale: Locale }) {
  const [index, setIndex] = useState(0);
  const t = translations[locale];
  const isAr = locale === "ar";
  const events = EVENTS(isAr);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % events.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [events.length]);

  return (
    <div className="w-full mb-6">
      <div className="glass-card rounded-2xl p-1 overflow-hidden relative border border-white/5 shadow-sm group">
        <div className="flex items-center gap-3 px-4 py-2 relative z-10">
          <div className="flex items-center gap-2 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80">Pulse</span>
          </div>

          <div className="h-4 w-[1px] bg-white/10" />

          <div className="flex-1 overflow-hidden h-5 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.5, ease: "circOut" }}
                className="flex items-center gap-2 whitespace-nowrap"
              >
                {events[index].icon}
                <span className="text-[11px] font-bold text-white/70 tracking-tight">
                  {events[index].text}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          <motion.div 
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] hidden sm:block"
          >
            Live Update
          </motion.div>
        </div>

        {/* Animated Background Gradient */}
        <AnimatePresence>
          <motion.div
            key={`bg-${index}`}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className={`absolute inset-0 bg-gradient-to-r ${events[index].color} to-transparent pointer-events-none`}
          />
        </AnimatePresence>
      </div>
    </div>
  );
}
