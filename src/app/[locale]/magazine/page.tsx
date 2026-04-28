"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiWind, FiChevronDown, FiZap } from "react-icons/fi";
import { getSupabase } from "@/lib/supabase";
import { type Post, type Locale } from "@/types";
import { useParams, useRouter } from "next/navigation";
import { translations } from "@/data/translations";
import { Avatar } from "@/components/ui/avatar";

export default function MagazinePage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as Locale) || "en";
  const t = translations[locale];
  const supabase = getSupabase();
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("posts")
        .select("id,content,profiles(full_name,avatar_url)")
        .order("created_at", { ascending: false })
        .limit(10);
      setPosts((data ?? []) as any);
      setLoading(false);
    };
    load();
  }, [supabase]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-white/20"
        >
          <FiZap size={48} />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#020202] text-white z-[50] overflow-hidden">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 z-0">
         <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-900/20 via-black to-black" />
         <motion.div 
            animate={{ opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 5, repeat: Infinity }}
            className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"
         />
      </div>

      {/* Header */}
      <div className="absolute top-0 left-0 w-full p-6 md:p-10 flex justify-between items-center z-20">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 brand-gradient rounded-lg flex items-center justify-center font-black text-lg">E</div>
          <span className="font-serif italic text-xl tracking-tighter">{t.magazine.title}</span>
        </div>
        <button 
          onClick={() => router.back()}
          className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
        >
          <FiX size={24} />
        </button>
      </div>

      {/* Scroll Container */}
      <div className="h-screen w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth relative z-10 no-scrollbar">
        {posts.map((post, i) => (
          <section 
            key={post.id} 
            className="h-screen w-full snap-start flex flex-col items-center justify-center p-8 md:p-24 relative"
          >
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-5xl w-full flex flex-col items-center text-center space-y-12"
            >
              <div className="space-y-4">
                <Avatar src={post.profiles?.avatar_url} size={64} />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">
                  {post.profiles?.full_name}
                </p>
              </div>

              <h2 className="text-4xl md:text-6xl lg:text-8xl font-serif italic font-black leading-tight drop-shadow-2xl">
                {post.content.replace(/\[T:\w+\]/g, "").replace(/\[P:[\w-]+\]/g, "").trim()}
              </h2>

              <div className="flex items-center gap-4 text-white/10">
                <div className="h-[1px] w-24 bg-current" />
                <FiWind size={24} />
                <div className="h-[1px] w-24 bg-current" />
              </div>
            </motion.div>

            {i < posts.length - 1 && (
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce text-white/20">
                <FiChevronDown size={32} />
              </div>
            )}
          </section>
        ))}
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
