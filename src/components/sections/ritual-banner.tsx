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
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const fetchRitual = async () => {
      const { data } = await supabase
        .from("rituals")
        .select("content")
        .eq("id", "daily_ritual")
        .maybeSingle();
      
      if (data) setRitual(data.content);
      setLoading(false);
    };

    fetchRitual();
    
    // Subscribe to changes
    const channel = supabase
      .channel("ritual-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "rituals" }, (payload) => {
        if (payload.new && "content" in payload.new) {
          setRitual((payload.new as any).content);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  if (loading) return null;
  if (!ritual) return (
    <div className="text-center text-xs text-rose-500 my-4 opacity-50">
      [Debug] No active ritual found in the database. Make sure the rituals-schema.sql was run successfully and a ritual is set.
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

        <div className="flex items-center gap-4 pt-2">
           <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-bold text-indigo-400 uppercase tracking-widest">
              <FiZap size={10} /> {t.ritual.activeNow}
           </div>
           
           <button 
             onClick={() => setCreateOpen(true)}
             className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 hover:bg-white text-[10px] font-black text-white hover:text-indigo-600 uppercase tracking-widest transition-all shadow-lg"
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
