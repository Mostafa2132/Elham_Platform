"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiSend, FiUser, FiSearch, FiMoreVertical, FiArrowLeft, FiMessageCircle, FiEdit2, FiImage, FiX, FiCamera, FiTrash2 } from "react-icons/fi";
import { useSearchParams } from "next/navigation";
import { Modal } from "@/components/ui/modal";
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
  is_edited?: boolean;
  reaction?: string | null;
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
  const [chatSettings, setChatSettings] = useState<{id?: string, nickname?: string, background_url?: string}>({});
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showBgModal, setShowBgModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameInput, setRenameInput] = useState("");
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const t = translations[locale];

  const searchParams = useSearchParams();

  // Load conversations (users I have talked to or all users for simplicity in MVP)
  useEffect(() => {
    if (!user) return;
    const loadUsers = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", user.id)
        .limit(20);
      
      let usersList = (data ?? []) as Profile[];
      
      // Handle direct message link from profile
      const targetUserId = searchParams?.get("user");
      if (targetUserId && targetUserId !== user.id) {
        const existingUser = usersList.find(u => u.id === targetUserId);
        if (existingUser) {
          setSelectedUser(existingUser);
        } else {
          // User not in recent conversations, fetch them directly
          const { data: targetData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", targetUserId)
            .single();
            
          if (targetData) {
            usersList = [targetData as Profile, ...usersList];
            setSelectedUser(targetData as Profile);
          }
        }
      }
      
      setConversations(usersList);
      setLoading(false);
    };
    loadUsers();
  }, [user, supabase, searchParams]);

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
    };

    const loadSettings = async () => {
      const { data } = await supabase
        .from("chat_settings")
        .select("*")
        .eq("user_id", user.id)
        .eq("target_user_id", selectedUser.id)
        .maybeSingle();
      if (data) setChatSettings(data);
      else setChatSettings({});
    };

    loadMessages();
    loadSettings();

    // Subscribe to new messages and updates
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
            setMessages((prev) => {
              const exists = prev.find(m => m.id === msg.id);
              if (exists) {
                // Update existing message (edit or reaction)
                return prev.map(m => m.id === msg.id ? msg : m);
              } else {
                // New message
                return [...prev, msg];
              }
            });
            // Scroll ONLY the chat container down
            setTimeout(() => {
              if (messagesEndRef.current?.parentElement) {
                messagesEndRef.current.parentElement.scrollTo({
                  top: messagesEndRef.current.parentElement.scrollHeight,
                  behavior: "smooth"
                });
              }
            }, 150);
            resetUnreadForUser(selectedUser.id);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Message;
          setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedUser, supabase, incrementUnreadForUser, resetUnreadForUser]);

  const updateSetting = async (field: "nickname" | "background_url", value: string | null) => {
    if (!user || !selectedUser) return;
    const newSettings = { ...chatSettings, [field]: value };
    setChatSettings(newSettings);
    
    if (chatSettings.id) {
      await supabase.from("chat_settings").update({ [field]: value }).eq("id", chatSettings.id);
    } else {
      const { data } = await supabase.from("chat_settings").insert({
        user_id: user.id,
        target_user_id: selectedUser.id,
        [field]: value
      }).select().single();
      if (data) setChatSettings(data);
    }
  };

  const handleBgUpload = async () => {
    if (!bgFile || !user) return;
    setIsUploading(true);
    const ext = bgFile.name.split(".").pop();
    const path = `${user.id}/chat-bg-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("covers").upload(path, bgFile, { upsert: true });
    
    if (error) {
      toast.error(error.message);
    } else {
      const { data } = supabase.storage.from("covers").getPublicUrl(path);
      updateSetting("background_url", data.publicUrl);
      setShowBgModal(false);
    }
    setIsUploading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBgFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setBgPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleReact = async (msgId: string, reaction: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reaction } : m));
    await supabase.from("messages").update({ reaction }).eq("id", msgId);
    setActiveReactionMsgId(null);
  };

  const handleDeleteMessage = async () => {
    if (!messageToDelete) return;
    setIsDeleting(true);
    
    const { error } = await supabase.from("messages").delete().eq("id", messageToDelete);
    if (error) {
      toast.error(error.message);
    } else {
      setMessages(prev => prev.filter(m => m.id !== messageToDelete));
    }
    
    setIsDeleting(false);
    setMessageToDelete(null);
  };

  // Separate scroll logic for sending messages
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedUser || !newMessage.trim()) return;

    if (editingMessageId) {
      const { error } = await supabase.from("messages").update({ content: newMessage.trim(), is_edited: true }).eq("id", editingMessageId);
      if (error) return toast.error(error.message);
      
      setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, content: newMessage.trim(), is_edited: true } : m));
      setNewMessage("");
      setEditingMessageId(null);
      return;
    }

    const msg = {
      sender_id: user.id,
      receiver_id: selectedUser.id,
      content: newMessage.trim(),
    };

    const { data, error } = await supabase.from("messages").insert(msg).select().single();
    if (error) return toast.error(error.message);

    setMessages((prev) => [...prev, data as Message]);
    setNewMessage("");
    
    // Scroll ONLY the chat container, not the whole page
    setTimeout(() => {
      if (messagesEndRef.current?.parentElement) {
        messagesEndRef.current.parentElement.scrollTo({
          top: messagesEndRef.current.parentElement.scrollHeight,
          behavior: "smooth"
        });
      }
    }, 150);
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
      <div 
        className={`flex-1 flex flex-col relative bg-black/20 ${!selectedUser ? "hidden md:flex" : "flex"}`}
        style={{
          backgroundImage: chatSettings.background_url ? `url(${chatSettings.background_url})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      >
        {chatSettings.background_url && <div className="absolute inset-0 bg-black/60 z-0 backdrop-blur-[2px]" />}
        
        {selectedUser ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/10 backdrop-blur-md relative z-50">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedUser(null)} className="md:hidden p-2 -ml-2">
                  <FiArrowLeft />
                </button>
                <Avatar src={selectedUser.avatar_url} size={40} />
                <div>
                  <p className="font-bold text-sm">
                    {chatSettings.nickname || selectedUser.full_name || selectedUser.email.split("@")[0]}
                  </p>
                  <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Online</p>
                </div>
              </div>
              <div className="relative">
                <button onClick={() => setShowSettingsMenu(!showSettingsMenu)} className="p-2 text-muted hover:text-white transition-colors">
                  <FiMoreVertical />
                </button>
                {showSettingsMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 border border-white/10 rounded-2xl shadow-xl overflow-hidden py-2 z-50">
                    <button onClick={() => {
                      setRenameInput(chatSettings.nickname || selectedUser.full_name || selectedUser.email.split("@")[0] || "");
                      setShowRenameModal(true);
                      setShowSettingsMenu(false);
                    }} className="w-full px-4 py-2 text-left hover:bg-white/5 text-sm flex items-center gap-2">
                      <FiEdit2 size={14} /> {locale === "ar" ? "إعادة التسمية" : "Rename"}
                    </button>
                    <button onClick={() => {
                      setShowBgModal(true);
                      setBgPreview(null);
                      setBgFile(null);
                      setShowSettingsMenu(false);
                    }} className="w-full px-4 py-2 text-left hover:bg-white/5 text-sm flex items-center gap-2">
                      <FiImage size={14} /> {locale === "ar" ? "تغيير الخلفية" : "Change Background"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar relative z-0 pb-8 min-h-0" onClick={(e) => {
              if (e.target === e.currentTarget) setActiveReactionMsgId(null);
            }}>
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender_id === user.id ? "justify-end" : "justify-start"} relative`}>
                  <div 
                    onClick={() => setActiveReactionMsgId(activeReactionMsgId === m.id ? null : m.id)}
                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm relative cursor-pointer active:scale-[0.98] transition-transform ${
                    m.sender_id === user.id 
                    ? "bg-indigo-500 text-white rounded-tr-none shadow-lg shadow-indigo-500/20" 
                    : "glass-card border border-white/10 rounded-tl-none bg-white/10 backdrop-blur-md"
                  }`}>
                    <p className="leading-relaxed">{m.content}</p>
                    <p className={`text-[9px] mt-1 opacity-50 flex items-center gap-1 ${m.sender_id === user.id ? "justify-end" : "justify-start"}`}>
                      {m.is_edited && <span>(edited)</span>}
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    
                    {/* Reaction Badge */}
                    {m.reaction && (
                      <div className={`absolute -bottom-3 ${m.sender_id === user.id ? "left-2" : "right-2"} bg-gray-800 border border-white/10 rounded-full px-1.5 py-0.5 text-xs shadow-md z-10`}>
                        {m.reaction}
                      </div>
                    )}
                  </div>

                  {/* Message Actions (Click) */}
                  <AnimatePresence>
                    {activeReactionMsgId === m.id && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute -top-10 flex items-center gap-1 bg-gray-900/90 backdrop-blur-md rounded-xl p-1.5 shadow-xl border border-white/10 z-20 ${m.sender_id === user.id ? "right-0" : "left-0"}`}
                      >
                        <button onClick={(e) => { e.stopPropagation(); handleReact(m.id, "❤️"); }} className="p-1 hover:scale-125 transition-transform text-lg" title="Love">❤️</button>
                        <button onClick={(e) => { e.stopPropagation(); handleReact(m.id, "👍"); }} className="p-1 hover:scale-125 transition-transform text-lg" title="Like">👍</button>
                        <button onClick={(e) => { e.stopPropagation(); handleReact(m.id, "😂"); }} className="p-1 hover:scale-125 transition-transform text-lg" title="Haha">😂</button>
                        <button onClick={(e) => { e.stopPropagation(); handleReact(m.id, "😮"); }} className="p-1 hover:scale-125 transition-transform text-lg" title="Wow">😮</button>
                        <button onClick={(e) => { e.stopPropagation(); handleReact(m.id, "😢"); }} className="p-1 hover:scale-125 transition-transform text-lg" title="Sad">😢</button>
                        <button onClick={(e) => { e.stopPropagation(); handleReact(m.id, "🔥"); }} className="p-1 hover:scale-125 transition-transform text-lg" title="Fire">🔥</button>
                        
                        {m.sender_id === user.id && (
                          <div className="flex items-center border-l border-white/10 ml-1 pl-1">
                            <button onClick={(e) => { e.stopPropagation(); setEditingMessageId(m.id); setNewMessage(m.content); setActiveReactionMsgId(null); }} className="p-1.5 text-indigo-300 hover:text-white transition-colors" title="Edit">
                              <FiEdit2 size={14} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setMessageToDelete(m.id); setActiveReactionMsgId(null); }} className="p-1.5 text-rose-400 hover:text-rose-300 transition-colors" title="Delete">
                              <FiTrash2 size={14} />
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="p-4 bg-white/5 backdrop-blur-xl border-t border-white/5 relative z-10">
              {editingMessageId && (
                <div className="absolute bottom-full left-0 w-full bg-indigo-500/20 text-indigo-200 text-xs px-4 py-2 border-t border-indigo-500/30 flex justify-between items-center backdrop-blur-md">
                  <span className="flex items-center gap-2"><FiEdit2 size={12} /> {locale === "ar" ? "تعديل الرسالة..." : "Editing message..."}</span>
                  <button type="button" onClick={() => { setEditingMessageId(null); setNewMessage(""); }} className="hover:text-white"><FiX size={14} /></button>
                </div>
              )}
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
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10 opacity-50 relative z-10">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
              <FiMessageCircle size={40} className="text-muted" />
            </div>
            <h3 className="text-xl font-bold mb-2">{locale === "ar" ? "رسائلك" : "Your Messages"}</h3>
            <p className="max-w-xs text-sm">{locale === "ar" ? "اختر شخصاً من القائمة لبدء المحادثة معه." : "Select a person from the list to start a conversation."}</p>
          </div>
        )}
      </div>

      {/* Change Background Modal */}
      <Modal open={showBgModal} onClose={() => setShowBgModal(false)} title={locale === "ar" ? "تغيير خلفية المحادثة" : "Change Chat Background"} maxWidth="400px">
        <div className="space-y-4">
          <label className="relative block h-40 rounded-xl overflow-hidden cursor-pointer bg-black/40 border border-white/10 hover:border-indigo-500/50 transition-colors group">
            {(bgPreview || chatSettings.background_url) && (
              <img src={bgPreview || chatSettings.background_url || ""} alt="bg" className="w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
              <FiCamera size={24} className="text-white" />
              <span className="ml-2 text-sm font-bold text-white">{locale === "ar" ? "اختر صورة من جهازك" : "Upload Image"}</span>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          </label>
          
          <div className="flex justify-between items-center pt-2">
            <button onClick={() => { updateSetting("background_url", null); setShowBgModal(false); }} className="text-rose-400 text-xs font-bold hover:text-rose-300 transition-colors">
              {locale === "ar" ? "إزالة الخلفية" : "Remove Background"}
            </button>
            <button onClick={handleBgUpload} disabled={!bgFile || isUploading} className="btn-primary disabled:opacity-50 px-6 py-2.5 rounded-xl font-bold text-sm">
              {isUploading ? "..." : (locale === "ar" ? "حفظ التغييرات" : "Save Changes")}
            </button>
          </div>
        </div>
      </Modal>

      {/* Rename Modal */}
      <Modal open={showRenameModal} onClose={() => setShowRenameModal(false)} title={locale === "ar" ? "إعادة التسمية" : "Rename Contact"} maxWidth="400px">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted mb-2 block">
              {locale === "ar" ? "الاسم الجديد" : "New Name"}
            </label>
            <input 
              type="text" 
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              placeholder={locale === "ar" ? "أدخل الاسم..." : "Enter name..."}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 ring-indigo-500/30 transition-all"
            />
          </div>
          
          <div className="flex justify-end items-center pt-2 gap-3">
            <button onClick={() => setShowRenameModal(false)} className="px-4 py-2 text-sm text-muted hover:text-white transition-colors">
              {locale === "ar" ? "إلغاء" : "Cancel"}
            </button>
            <button onClick={() => {
              updateSetting("nickname", renameInput.trim() || null);
              setShowRenameModal(false);
            }} className="btn-primary px-6 py-2.5 rounded-xl font-bold text-sm">
              {locale === "ar" ? "حفظ" : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!messageToDelete} onClose={() => setMessageToDelete(null)} title={locale === "ar" ? "حذف الرسالة" : "Delete Message"} maxWidth="320px">
        <div className="space-y-4">
          <p className="text-sm text-center text-muted">
            {locale === "ar" ? "هل أنت متأكد أنك تريد حذف هذه الرسالة نهائياً؟" : "Are you sure you want to permanently delete this message?"}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button onClick={() => setMessageToDelete(null)} className="px-6 py-2.5 rounded-xl text-sm font-bold bg-white/5 hover:bg-white/10 transition-colors">
              {locale === "ar" ? "إلغاء" : "Cancel"}
            </button>
            <button onClick={handleDeleteMessage} disabled={isDeleting} className="px-6 py-2.5 rounded-xl text-sm font-bold bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white transition-colors shadow-lg shadow-rose-500/20">
              {isDeleting ? "..." : (locale === "ar" ? "حذف" : "Delete")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
