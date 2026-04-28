"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiGitBranch, FiZap } from "react-icons/fi";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { getSupabase } from "@/lib/supabase";
import { type Post, type Locale } from "@/types";
import { translations } from "@/data/translations";

interface FlowModalProps {
  open: boolean;
  onClose: () => void;
  post: Post;
  locale: Locale;
}

export function FlowModal({ open, onClose, post, locale }: FlowModalProps) {
  const supabase = getSupabase();
  const t = translations[locale];
  const [ancestors, setAncestors] = useState<Post[]>([]);
  const [descendants, setDescendants] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;

    const fetchFlow = async () => {
      setLoading(true);
      
      // 1. Fetch Ancestors (Recursive-ish for UI)
      const chain: Post[] = [];
      const currentPost = post;
      
      const parentMatch = currentPost.content.match(/\[P:([\w-]+)\]/);
      if (parentMatch) {
         const { data: parent } = await supabase
            .from("posts")
            .select("*, profiles(*)")
            .eq("id", parentMatch[1])
            .single();
         if (parent) chain.unshift(parent as any);
      }
      setAncestors(chain);

      // 2. Fetch Descendants (Direct children)
      const { data: children } = await supabase
        .from("posts")
        .select("*, profiles(*)")
        .ilike("content", `%[P:${post.id}]%`)
        .order("created_at", { ascending: true });
      
      setDescendants((children ?? []) as Post[]);
      setLoading(false);
    };

    fetchFlow();
  }, [open, post, supabase]);

  const renderMiniCard = (p: Post, isCurrent = false) => {
    const content = p.content.replace(/\[T:\w+\]/, "").replace(/\[P:[\w-]+\]/, "").trim();
    return (
      <div className={`relative p-4 rounded-2xl border transition-all ${isCurrent ? "bg-indigo-500/10 border-indigo-500/30 scale-105 shadow-lg shadow-indigo-500/10" : "bg-white/5 border-white/10 opacity-70"}`}>
        <div className="flex items-center gap-3 mb-2">
          <Avatar src={p.profiles?.avatar_url} size={24} />
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{p.profiles?.full_name}</span>
        </div>
        <p className="text-sm italic leading-relaxed">&quot;{content}&quot;</p>
        {isCurrent && (
           <div className="absolute -top-2 -right-2 bg-indigo-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
              {t.flow.youAreHere}
           </div>
        )}
      </div>
    );
  };

  return (
    <Modal open={open} onClose={onClose} title={t.flow.journey}>
      <div className="space-y-8 py-4 relative">
        {loading ? (
          <div className="flex justify-center py-12">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
              <FiZap className="text-indigo-500" size={32} />
            </motion.div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 relative">
            {/* Thread Line */}
            <div className="absolute top-8 bottom-8 w-[1px] bg-gradient-to-b from-transparent via-white/10 to-transparent left-1/2 -translate-x-1/2 -z-10" />

            {/* Ancestors */}
            {ancestors.map(p => (
              <div key={p.id} className="w-full max-w-sm">
                 {renderMiniCard(p)}
                 <div className="flex justify-center -mb-2 mt-2">
                    <FiGitBranch size={16} className="text-white/10" />
                 </div>
              </div>
            ))}

            {/* Target Post */}
            <div className="w-full max-w-sm">
               {renderMiniCard(post, true)}
            </div>

            {/* Descendants */}
            {descendants.length > 0 ? (
               descendants.map(p => (
                <div key={p.id} className="w-full max-w-sm">
                   <div className="flex justify-center -mt-2 mb-2">
                      <FiGitBranch size={16} className="text-white/10" />
                   </div>
                   {renderMiniCard(p)}
                </div>
              ))
            ) : (
               <div className="text-[10px] text-muted uppercase tracking-[0.3em] font-bold mt-4">
                  {t.flow.endOfFlow}
               </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
