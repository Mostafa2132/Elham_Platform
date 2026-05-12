"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiRefreshCw, FiZap, FiEdit3, FiPlus } from "react-icons/fi";
import { getSupabase } from "@/lib/supabase";
import { translations } from "@/data/translations";
import { type Locale } from "@/types";
import { CreatePostModal } from "@/components/sections/create-post-modal";

export function RitualBanner({ locale }: { locale: Locale }) {
  const t = translations[locale];
  const supabase = getSupabase();
  const [ritual, setRitual] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    const fetchRitual = async () => {
      const { data } = await supabase
        .from("rituals")
        .select("content, updated_at")
        .eq("id", "daily_ritual")
        .maybeSingle();
      
      if (data) {
        setRitual(data.content);
        setUpdatedAt(data.updated_at);
      }
      setLoading(false);
    };

    fetchRitual();
    
    // Subscribe to changes
    const channel = supabase
      .channel("ritual-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "rituals" }, (payload) => {
        if (payload.new && "content" in payload.new) {
          setRitual((payload.new as any).content);
          setUpdatedAt((payload.new as any).updated_at);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  useEffect(() => {
    if (!updatedAt) return;
    
    const updateTimer = () => {
      const created = new Date(updatedAt).getTime();
      const now = Date.now();
      const diff = 86400000 - (now - created);
      
      if (diff <= 0) {
        setTimeLeft("Renewing...");
        return;
      }
      
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${hours}h ${mins}m`);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [updatedAt]);

  if (loading) return null;
  
  const isExpired = updatedAt && (Date.now() - new Date(updatedAt).getTime() > 86400000);

  if (!ritual || isExpired) return (
    <div className="text-center text-xs text-muted/40 my-4 italic">
      {isExpired ? (locale === "ar" ? "في انتظار إلهام اليوم الجديد..." : "Waiting for today's new inspiration...") : ""}
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mb-8 group"
    >
      <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
      
      <div className="relative glass rounded-3xl p-6 md:p-8 flex flex-col items-center text-center space-y-4 border border-white/10 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <FiRefreshCw size={80} className="animate-spin-slow" />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-white/20" />
          <span className="text-[10px] font-black uppercase tracking-[0.5em] text-indigo-400">
            {t.ritual.title}
          </span>
          <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-white/20" />
        </div>

        <h2 className="text-xl md:text-3xl font-serif italic font-medium leading-relaxed max-w-2xl text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
          &quot;{ritual}&quot;
        </h2>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 w-full">
           <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-bold text-indigo-400 uppercase tracking-widest whitespace-nowrap">
              <FiZap size={10} className="animate-pulse" /> {t.ritual.activeNow}
           </div>
           
           {timeLeft && (
             <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold text-amber-500 uppercase tracking-widest shadow-[0_0_15px_rgba(245,158,11,0.1)] whitespace-nowrap">
               <span className="opacity-50">{t.ritual.endsIn}</span>
               <span className="font-black tabular-nums">{timeLeft}</span>
             </div>
           )}
           
           <button 
             onClick={() => setCreateOpen(true)}
             className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-white text-[10px] font-black text-indigo-600 uppercase tracking-widest transition-all shadow-xl hover:scale-[1.02] active:scale-95 w-full sm:w-auto mt-1 sm:mt-0"
           >
             <FiPlus size={12} />
             {t.ritual.participate}
           </button>
        </div>
      </div>

      <CreatePostModal 
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          // Optional: refresh feed
        }}
      />

      <style jsx global>{`
        .animate-spin-slow {
          animation: spin 12s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </motion.div>
  );
}
