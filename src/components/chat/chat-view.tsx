"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiSend, FiUser, FiSearch, FiMoreVertical, FiArrowLeft, FiMessageCircle } from "react-icons/fi";
import { getSupabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";
import { useInteractionStore } from "@/store/interaction-store";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "react-toastify";
import { translations } from "@/data/translations";
import { type Profile, type Locale } from "@/types";

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
};

export function ChatView({ locale }: { locale: Locale }) {
  const supabase = getSupabase();
  const { user, profile: myProfile } = useAuthStore();
  const { unreadCountsByUser, incrementUnreadForUser, resetUnreadForUser } = useInteractionStore();
  const [conversations, setConversations] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const t = translations[locale];

  // Load conversations (users I have talked to or all users for simplicity in MVP)
  useEffect(() => {
    if (!user) return;
    const loadUsers = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", user.id)
        .limit(20);
      setConversations((data ?? []) as Profile[]);
      setLoading(false);
    };
    loadUsers();
  }, [user, supabase]);

  // Load messages when a user is selected
  useEffect(() => {
    if (!user || !selectedUser) return;

    // Reset unread for this user when opening their chat
    resetUnreadForUser(selectedUser.id);

    const loadMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: true });
      setMessages((data ?? []) as Message[]);
      
      // Note: Removed auto-scroll on open as per user request
    };

    loadMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`chat-${user.id}-${selectedUser.id}`)
      .on(
        "postgres_changes",
        { 
          event: "INSERT", 
          schema: "public", 
          table: "messages",
          filter: `receiver_id=eq.${user.id}` 
        },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.sender_id === selectedUser.id) {
            setMessages((prev) => [...prev, msg]);
            // Scroll to bottom on receive if user is chatting
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            // صفر العداد فوراً لأننا نشاهد المحادثة حالياً
            resetUnreadForUser(selectedUser.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedUser, supabase, incrementUnreadForUser, resetUnreadForUser]);

  // Separate scroll logic for sending messages (user requested "no scroll when I send")
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedUser || !newMessage.trim()) return;

    const msg = {
      sender_id: user.id,
      receiver_id: selectedUser.id,
      content: newMessage.trim(),
    };

    const { data, error } = await supabase.from("messages").insert(msg).select().single();
    if (error) return toast.error(error.message);

    setMessages((prev) => [...prev, data as Message]);
    setNewMessage("");
    // Note: We are NOT calling scrollIntoView here as per user request "مش عاوز لما ابعت رساله كدا يحصل اسكرول لتحت"
  };

  if (!user) return <div className="p-20 text-center glass rounded-3xl">{t.auth.pleaseLogin}</div>;

  return (
    <div className="glass overflow-hidden rounded-3xl border border-white/5 h-[75vh] flex">
      {/* Sidebar - Conversations */}
      <div className={`w-full md:w-80 border-r border-white/5 flex flex-col ${selectedUser ? "hidden md:flex" : "flex"}`}>
        <div className="p-4 border-b border-white/5">
          <h2 className="text-xl font-bold mb-4">{locale === "ar" ? "المحادثات" : "Messages"}</h2>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input 
              type="text" 
              placeholder={locale === "ar" ? "بحث عن أشخاص..." : "Search people..."} 
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 ring-indigo-500/20"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((u) => {
            const unread = unreadCountsByUser[u.id] || 0;
            return (
              <button
                key={u.id}
                onClick={() => setSelectedUser(u)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-all relative ${selectedUser?.id === u.id ? "bg-indigo-500/10 border-r-2 border-indigo-500" : ""}`}
              >
                <Avatar src={u.avatar_url} name={u.full_name ?? u.email} size={44} />
                <div className="text-left flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{u.full_name || u.email.split("@")[0]}</p>
                  <p className="text-xs text-muted truncate">{u.username ? `@${u.username}` : ""}</p>
                </div>
                {unread > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-black text-white shadow-[0_0_10px_rgba(244,63,94,0.4)] animate-pulse">
                    {unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col bg-black/20 ${!selectedUser ? "hidden md:flex" : "flex"}`}>
        {selectedUser ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedUser(null)} className="md:hidden p-2 -ml-2">
                  <FiArrowLeft />
                </button>
                <Avatar src={selectedUser.avatar_url} size={40} />
                <div>
                  <p className="font-bold text-sm">{selectedUser.full_name || selectedUser.email.split("@")[0]}</p>
                  <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Online</p>
                </div>
              </div>
              <button className="p-2 text-muted hover:text-white transition-colors">
                <FiMoreVertical />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender_id === user.id ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                    m.sender_id === user.id 
                    ? "bg-indigo-500 text-white rounded-tr-none shadow-lg shadow-indigo-500/20" 
                    : "glass-card border border-white/10 rounded-tl-none"
                  }`}>
                    <p className="leading-relaxed">{m.content}</p>
                    <p className={`text-[9px] mt-1 opacity-50 ${m.sender_id === user.id ? "text-right" : "text-left"}`}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="p-4 bg-white/5">
              <div className="relative flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={locale === "ar" ? "اكتب رسالة..." : "Type a message..."}
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl py-3 px-5 text-sm focus:outline-none focus:ring-2 ring-indigo-500/30 transition-all"
                />
                <button 
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white p-3 rounded-2xl transition-all shadow-lg shadow-indigo-500/30"
                >
                  <FiSend size={20} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10 opacity-50">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
              <FiMessageCircle size={40} className="text-muted" />
            </div>
            <h3 className="text-xl font-bold mb-2">{locale === "ar" ? "رسائلك" : "Your Messages"}</h3>
            <p className="max-w-xs text-sm">{locale === "ar" ? "اختر شخصاً من القائمة لبدء المحادثة معه." : "Select a person from the list to start a conversation."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
