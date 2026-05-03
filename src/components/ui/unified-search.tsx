"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiSearch, FiX, FiUser, FiFileText, FiTrendingUp } from "react-icons/fi";
import { getSupabase } from "@/lib/supabase";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { translations } from "@/data/translations";
import { type Profile, type Post, type Locale } from "@/types";
import Link from "next/link";

interface SearchResult {
  users: Profile[];
  posts: Post[];
}

export function UnifiedSearch({ locale, open, onClose }: { locale: Locale; open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>({ users: [], posts: [] });
  const [loading, setLoading] = useState(false);
  const t = translations[locale];
  const supabase = getSupabase();

  useEffect(() => {
    if (query.length < 2) {
      setResults({ users: [], posts: [] });
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      const [userRes, postRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .or(`full_name.ilike.%${query}%,username.ilike.%${query}%`)
          .limit(5),
        supabase
          .from("posts")
          .select("*, profiles(*)")
          .ilike("content", `%${query}%`)
          .limit(5)
      ]);

      setResults({
        users: (userRes.data ?? []) as Profile[],
        posts: (postRes.data ?? []) as Post[]
      });
      setLoading(false);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query, supabase]);

  return (
    <Modal open={open} onClose={onClose} title={t.search.title}>
      <div className="space-y-6">
        <div className="relative">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input 
            autoFocus
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search.placeholder}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm focus:outline-none focus:ring-2 ring-indigo-500/30 transition-all"
          />
        </div>

        {/* Results */}
        <div className="space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 opacity-40">
              <div className="w-10 h-10 border-2 border-t-indigo-500 border-indigo-500/10 rounded-full animate-spin mb-4" />
              <p className="text-xs uppercase font-black tracking-widest">{t.loading}</p>
            </div>
          )}

          {!loading && query.length >= 2 && results.users.length === 0 && results.posts.length === 0 && (
            <div className="text-center py-20 opacity-40">
              <p>{t.search.noResults}</p>
            </div>
          )}

          {!loading && query.length < 2 && (
            <div className="text-center py-20 opacity-20">
              <FiTrendingUp size={40} className="mx-auto mb-4" />
              <p className="text-sm italic">{t.search.startTyping}</p>
            </div>
          )}

          {/* Users Section */}
          {results.users.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-2 flex items-center gap-2">
                <FiUser size={12} />
                {t.search.people}
              </h4>
              <div className="grid gap-2">
                {results.users.map((u) => (
                  <Link
                    key={u.id}
                    href={`/${locale}/profile/${u.id}`}
                    onClick={onClose}
                    className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group"
                  >
                    <Avatar src={u.avatar_url} name={u.full_name ?? u.username} size={40} />
                    <div>
                      <p className="font-bold text-sm group-hover:text-indigo-400 transition-colors">{u.full_name || u.username}</p>
                      <p className="text-[10px] text-muted tracking-tight">@{u.username || "user"}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Posts Section */}
          {results.posts.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-2 flex items-center gap-2">
                <FiFileText size={12} />
                {t.search.posts}
              </h4>
              <div className="grid gap-3">
                {results.posts.map((p) => (
                  <Link
                    key={p.id}
                    href={`/${locale}/profile/${p.author_id}`} // Link to author for now or dedicated post page if exists
                    onClick={onClose}
                    className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar src={p.profiles?.avatar_url} size={20} />
                      <span className="text-[10px] font-bold text-muted">{p.profiles?.full_name}</span>
                    </div>
                    <p className="text-xs line-clamp-2 text-white/80 leading-relaxed group-hover:text-white transition-colors">
                      {p.content.replace(/\[T:\w+\]/g, "").replace(/\[P:[\w-]+\]/g, "").trim()}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
