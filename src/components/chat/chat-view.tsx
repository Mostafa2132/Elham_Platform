"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FiSearch, FiSend, FiMoreVertical, FiImage, FiSmile, 
  FiChevronLeft, FiCheck, FiCheckCircle, FiUser, FiArrowLeft,
  FiEdit3, FiTrash2, FiSettings, FiType, FiX, FiMessageSquare, FiUploadCloud, FiAlertCircle, FiZoomIn
} from "react-icons/fi";
import { getSupabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";
import { useInteractionStore } from "@/store/interaction-store";
import { translations } from "@/data/translations";
import { Avatar } from "@/components/ui/avatar";
import { type Profile, type Locale } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { toast } from "react-toastify";

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  is_read: boolean;
  is_edited: boolean;
  reaction: string | null;
}

interface ChatSettings {
  nickname: string | null;
  background_url: string | null;
}

const REACTIONS = ["❤️", "👍", "🔥", "😂", "😮", "🙏"];

export default function ChatView({ locale }: { locale: string }) {
  const { user, profile } = useAuthStore();
  const { unreadCountsByUser, resetUnreadForUser, setActiveChatId } = useInteractionStore();
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Image Confirm State
  const [imageToConfirm, setImageToConfirm] = useState<File | null>(null);
  const [imageConfirmPreview, setImageConfirmPreview] = useState<string | null>(null);
  
  // Settings States
  const [chatSettings, setChatSettings] = useState<ChatSettings | null>(null);
  const [tempNickname, setTempNickname] = useState<string>("");
  const [tempBgUrl, setTempBgUrl] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  const supabase = getSupabase();
  const t = translations[locale as Locale] || translations.en;
  const isAr = locale === "ar";
  const dateLocale = isAr ? ar : enUS;

  useEffect(() => {
    const fetchUsers = async () => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").neq("id", user.id).order("full_name");
      if (data) setUsers(data as Profile[]);
      setLoading(false);
    };
    fetchUsers();
  }, [user, supabase]);

  useEffect(() => {
    if (!user || !selectedUser) {
      setMessages([]);
      setChatSettings(null);
      return;
    }

    const loadChatData = async () => {
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: true });

      if (msgs) setMessages(msgs as ChatMessage[]);

      const { data: settings } = await supabase
        .from("chat_settings")
        .select("nickname, background_url")
        .eq("user_id", user.id)
        .eq("target_user_id", selectedUser.id)
        .maybeSingle();

      if (settings) {
        setChatSettings(settings);
        setTempNickname(settings.nickname || "");
        setTempBgUrl(settings.background_url);
      } else {
        setChatSettings(null);
        setTempNickname("");
        setTempBgUrl(null);
      }
      
      await supabase.from("messages").update({ is_read: true }).eq("sender_id", selectedUser.id).eq("receiver_id", user.id).eq("is_read", false);
      resetUnreadForUser(selectedUser.id);
      setActiveChatId(selectedUser.id);
    };

    loadChatData();

    const channel = supabase
      .channel(`chat:${user.id}:${selectedUser.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const newMsg = payload.new as ChatMessage;
          if ((newMsg.sender_id === user.id && newMsg.receiver_id === selectedUser.id) || 
              (newMsg.sender_id === selectedUser.id && newMsg.receiver_id === user.id)) {
            setMessages((prev) => [...prev, newMsg]);
          }
        } else if (payload.eventType === "UPDATE") {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
        } else if (payload.eventType === "DELETE") {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
      setActiveChatId(null);
    };
  }, [selectedUser, user, supabase]);

  useEffect(() => {
    if (messagesEndRef.current && selectedUser) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [messages, selectedUser]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user || !selectedUser || (!newMessage.trim() && !uploading)) return;

    setSending(true);
    const content = newMessage.trim();
    const msgToEdit = editingMessage;
    
    if (msgToEdit) {
      setEditingMessage(null);
      setNewMessage("");
      setMessages(prev => prev.map(m => m.id === msgToEdit.id ? { ...m, content, is_edited: true } : m));
      const { error } = await supabase.from("messages").update({ content, is_edited: true }).eq("id", msgToEdit.id);
      if (error) toast.error("Failed to edit message");
    } else {
      setNewMessage("");
      const { error } = await supabase.from("messages").insert({ sender_id: user.id, receiver_id: selectedUser.id, content });
      if (error) toast.error("Failed to send message");
    }
    setSending(false);
  };

  const onSelectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageToConfirm(file);
    setImageConfirmPreview(URL.createObjectURL(file));
  };

  const handleSendImage = async () => {
    if (!imageToConfirm || !user || !selectedUser) return;

    const file = imageToConfirm;
    setImageToConfirm(null);
    setImageConfirmPreview(null);
    setSending(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('chat-images').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(fileName);
      
      const { error } = await supabase.from("messages").insert({ 
        sender_id: user.id, 
        receiver_id: selectedUser.id, 
        content: "", 
        image_url: publicUrl 
      });
      if (error) throw error;
      toast.success(isAr ? "تم إرسال الصورة" : "Image sent");
    } catch (err: any) {
      toast.error(isAr ? "فشل إرسال الصورة" : "Failed to send image: " + err.message);
    } finally {
      setSending(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const startEditing = (msg: ChatMessage) => {
    setEditingMessage(msg);
    setNewMessage(msg.content);
    setTimeout(() => { inputRef.current?.focus(); }, 100);
  };

  const handleReaction = async (messageId: string, emoji: string | null) => {
    setHoveredMessageId(null);
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reaction: emoji } : m));
    await supabase.from("messages").update({ reaction: emoji }).eq("id", messageId);
  };

  const confirmDelete = async () => {
    if (!messageToDelete) return;
    const id = messageToDelete;
    setMessageToDelete(null);
    setMessages(prev => prev.filter(m => m.id !== id));
    await supabase.from("messages").delete().eq("id", id);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedUser) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('chat-backgrounds').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('chat-backgrounds').getPublicUrl(fileName);
      setTempBgUrl(publicUrl);
      toast.info(isAr ? "تم اختيار الصورة، اضغط حفظ للتأكيد" : "Image selected, click Save to confirm");
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const saveSettings = async () => {
    if (!user || !selectedUser) return;
    setLoading(true);
    const { error } = await supabase.from("chat_settings").upsert({
      user_id: user.id,
      target_user_id: selectedUser.id,
      nickname: tempNickname || null,
      background_url: tempBgUrl
    }, { onConflict: 'user_id,target_user_id' });

    if (error) {
      toast.error("Failed to save settings: " + error.message);
    } else {
      setChatSettings({ nickname: tempNickname || null, background_url: tempBgUrl });
      setShowSettings(false);
      toast.success(isAr ? "تم حفظ الإعدادات" : "Settings saved!");
    }
    setLoading(false);
  };

  const filteredUsers = users.filter(u => 
    (u.full_name || u.email || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayName = chatSettings?.nickname || selectedUser?.full_name || selectedUser?.email.split("@")[0];

  return (
    <div className="flex h-[calc(100vh-140px)] glass-card rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/5 mx-auto max-w-7xl relative">
      
      {/* Sidebar */}
      <div className={`w-full md:w-80 border-r border-white/5 flex flex-col ${selectedUser ? "hidden md:flex" : "flex"} bg-black/20 z-20`}>
        <div className="p-6 border-b border-white/5">
          <h2 className="text-2xl font-black mb-4 tracking-tight">{t.chat.title}</h2>
          <div className="relative group">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-[var(--brand-a)] transition-colors" />
            <input 
              type="text" placeholder={t.chat.search} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-a)]/30 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          {loading && users.length === 0 ? (
            <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-[var(--brand-a)] border-t-transparent rounded-full animate-spin" /></div>
          ) : filteredUsers.map((u) => (
            <button key={u.id} onClick={() => { setSelectedUser(u); resetUnreadForUser(u.id); }}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all group relative ${selectedUser?.id === u.id ? "bg-white/10 shadow-lg" : "hover:bg-white/5"}`}
            >
              <div className="relative">
                <Avatar src={u.avatar_url} name={u.full_name || u.email} size={44} />
                {unreadCountsByUser[u.id] > 0 && (
                  <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border-2 border-[#0a0a0a]" />
                  </div>
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`font-bold truncate text-sm ${selectedUser?.id === u.id ? "text-white" : "text-white/80"}`}>{u.full_name || u.email.split("@")[0]}</p>
                  {unreadCountsByUser[u.id] > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-lg shadow-rose-500/20">
                      {unreadCountsByUser[u.id]}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted truncate opacity-70 uppercase tracking-widest">@{u.username || "user"}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col relative ${!selectedUser ? "hidden md:flex" : "flex"} bg-white/[0.02] overflow-hidden`}>
        {selectedUser ? (
          <>
            {chatSettings?.background_url && (
              <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-black/50 z-10" />
                <img src={chatSettings.background_url} alt="bg" className="w-full h-full object-cover" />
              </div>
            )}

            {/* Header */}
            <div className="p-4 md:p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.03] z-20 backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <button onClick={() => setSelectedUser(null)} className="md:hidden p-2 hover:bg-white/5 rounded-full"><FiArrowLeft size={20} /></button>
                <div className="relative">
                  <Avatar src={selectedUser.avatar_url} name={selectedUser.full_name || selectedUser.email} size={44} />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-4 border-[#0a0a0a] rounded-full" />
                </div>
                <div>
                  <h3 className="font-bold text-white leading-tight">{displayName}</h3>
                  <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{t.chat.online}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowSettings(true)} className="p-2.5 rounded-2xl hover:bg-white/5 text-muted transition-all">
                <FiSettings size={20} />
              </button>
            </div>

            {/* Messages Area */}
            <div 
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto px-6 py-8 space-y-6 custom-scrollbar z-10 flex flex-col scroll-smooth relative"
            >
              {messages.map((msg, index) => {
                const isOwn = msg.sender_id === user?.id;
                const showDate = index === 0 || new Date(msg.created_at).getTime() - new Date(messages[index-1].created_at).getTime() > 3600000;

                return (
                  <div key={msg.id} className="space-y-4">
                    {showDate && (
                      <div className="flex justify-center my-8">
                        <span className="px-5 py-1.5 rounded-full bg-white/5 border border-white/5 text-[10px] font-black text-muted uppercase tracking-[0.2em] backdrop-blur-sm">
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: dateLocale })}
                        </span>
                      </div>
                    )}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                      <div 
                        onMouseEnter={() => setHoveredMessageId(msg.id)}
                        onMouseLeave={() => setHoveredMessageId(null)}
                        className="group relative max-w-[80%] md:max-w-[65%]"
                      >
                        
                        {/* Reaction Picker on Hover */}
                        <AnimatePresence>
                          {hoveredMessageId === msg.id && (
                            <motion.div initial={{ opacity: 0, y: 5, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 5, scale: 0.9 }}
                              className={`absolute -top-12 z-50 p-1.5 glass-card rounded-2xl flex gap-1 shadow-2xl border border-white/10 ${isOwn ? "right-0" : "left-0"}`}
                            >
                              {REACTIONS.map(emoji => (
                                <button key={emoji} onClick={() => handleReaction(msg.id, emoji === msg.reaction ? null : emoji)} className="p-1.5 hover:bg-white/10 rounded-xl transition-all hover:scale-125">{emoji}</button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div 
                          className={`p-1.5 rounded-[1.8rem] shadow-xl transition-all cursor-pointer relative group/msg ${
                            isOwn 
                              ? "bg-[var(--brand-a)]/20 border border-[var(--brand-a)]/30 text-white rounded-br-none hover:bg-[var(--brand-a)]/30" 
                              : "bg-white/5 border border-white/10 text-white rounded-bl-none hover:bg-white/10 backdrop-blur-md"
                          }`}
                        >
                          {msg.image_url ? (
                            <div className="rounded-[1.4rem] overflow-hidden max-w-sm relative group/img" onClick={() => setPreviewImage(msg.image_url)}>
                              <img src={msg.image_url} alt="chat" className="w-full h-auto object-cover max-h-[400px] transition-transform group-hover/img:scale-105" />
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center"><FiZoomIn size={32} className="text-white" /></div>
                            </div>
                          ) : (
                            <p className="p-3 text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          )}
                          
                          {msg.reaction && (
                            <div className={`absolute -bottom-3 ${isOwn ? "left-2" : "right-2"} bg-[#1a1a1a] border border-white/10 rounded-full px-2 py-0.5 text-[12px] shadow-lg z-20`}>
                              {msg.reaction}
                            </div>
                          )}
                        </div>
                        
                        <div className={`flex items-center gap-2 mt-2 text-[10px] font-black text-muted uppercase tracking-widest ${isOwn ? "justify-end" : "justify-start"}`}>
                          {msg.is_edited && <span className="text-[var(--brand-a)] opacity-60 italic">{t.chat.edited}</span>}
                          <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isOwn && (msg.is_read ? <FiCheckCircle className="text-emerald-500" /> : <FiCheck className="opacity-50" />)}
                        </div>

                        {isOwn && (
                          <div className={`absolute top-0 -left-12 opacity-0 group-hover:opacity-100 transition-all flex flex-col gap-1 z-30`}>
                            {!msg.image_url && <button onClick={(e) => { e.stopPropagation(); startEditing(msg); }} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-[var(--brand-a)]"><FiEdit3 size={14} /></button>}
                            <button onClick={(e) => { e.stopPropagation(); setMessageToDelete(msg.id); }} className="p-2 hover:bg-red-500/10 rounded-lg text-red-500/40 hover:text-red-500"><FiTrash2 size={14} /></button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white/[0.03] border-t border-white/5 z-20 backdrop-blur-xl">
              <form onSubmit={handleSendMessage} className="relative flex items-center gap-3 max-w-4xl mx-auto w-full">
                <input ref={imageInputRef} type="file" className="hidden" accept="image/*" onChange={onSelectImage} />
                <button 
                  type="button" onClick={() => imageInputRef.current?.click()} disabled={sending}
                  className="p-4 hover:bg-white/5 rounded-[1.5rem] text-muted hover:text-white transition-all disabled:opacity-50"
                >
                  {sending && !newMessage ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <FiImage size={20} />}
                </button>
                
                <div className="flex-1 relative">
                  <AnimatePresence>
                    {editingMessage && (
                      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 15 }}
                        className="absolute -top-[70px] inset-x-0 p-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-between shadow-2xl border border-white/20 z-30"
                      >
                        <div className="flex items-center gap-3 text-white overflow-hidden">
                          <FiEdit3 className="shrink-0" size={18} /><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-widest opacity-70 leading-none mb-1">{t.chat.editing}</p><p className="text-xs truncate opacity-90">{editingMessage.content}</p></div>
                        </div>
                        <button type="button" onClick={() => { setEditingMessage(null); setNewMessage(""); }} className="p-1.5 hover:bg-white/20 rounded-lg text-white transition-colors"><FiX size={18} /></button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <input
                    ref={inputRef} type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder={t.chat.typeMessage}
                    className="w-full bg-white/10 border border-white/10 py-4.5 px-7 text-sm focus:outline-none focus:border-[var(--brand-a)]/40 transition-all pr-16 rounded-[1.8rem]"
                  />
                  <button type="submit" disabled={sending || !newMessage.trim()}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-3.5 rounded-2xl shadow-2xl transition-all ${newMessage.trim() ? "bg-[var(--brand-a)] text-white hover:scale-105 shadow-[var(--brand-a)]/30" : "bg-white/5 text-muted"}`}
                  >
                    <FiSend size={20} />
                  </button>
                </div>
              </form>
            </div>

            {/* Image Send Confirmation Modal */}
            <AnimatePresence>
              {imageConfirmPreview && (
                <div className="absolute inset-0 z-[150] flex items-center justify-center p-6 backdrop-blur-md bg-black/80">
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    className="w-full max-w-md glass-card p-6 rounded-[2.5rem] shadow-2xl border border-white/10 text-center"
                  >
                    <h3 className="text-xl font-black mb-4">{isAr ? "تأكيد إرسال الصورة" : "Confirm Send Image"}</h3>
                    <div className="rounded-2xl overflow-hidden mb-6 border border-white/10 aspect-video bg-black/20">
                      <img src={imageConfirmPreview} alt="confirm" className="w-full h-full object-contain" />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => { setImageToConfirm(null); setImageConfirmPreview(null); }} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-2xl font-bold transition-all">
                        {isAr ? "إلغاء" : "Cancel"}
                      </button>
                      <button onClick={handleSendImage} className="flex-1 py-3 bg-[var(--brand-a)] text-white rounded-2xl font-black shadow-lg shadow-[var(--brand-a)]/30 hover:scale-[1.02] transition-all">
                        {isAr ? "إرسال الآن" : "Send Now"}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Image Preview Modal */}
            <AnimatePresence>
              {previewImage && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl"
                  onClick={() => setPreviewImage(null)}
                >
                  <button className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white z-[210] transition-all"><FiX size={28} /></button>
                  <motion.img initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                    src={previewImage} alt="preview" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Settings Modal */}
            <AnimatePresence>
              {showSettings && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/60">
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    className="w-full max-md:h-fit max-w-md glass-card p-8 rounded-[3rem] shadow-2xl border border-white/10 relative"
                  >
                    <button onClick={() => setShowSettings(false)} className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-full text-muted"><FiX size={20} /></button>
                    <h3 className="text-2xl font-black mb-8 tracking-tight">{isAr ? "إعدادات الدردشة" : "Chat Settings"}</h3>
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">{t.chat.rename}</label>
                        <div className="flex gap-3"><input type="text" placeholder={t.chat.newName} value={tempNickname} onChange={(e) => setTempNickname(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:border-[var(--brand-a)] transition-all" />{tempNickname && <button onClick={() => setTempNickname("")} className="p-3 bg-red-500/10 rounded-2xl text-red-500"><FiX size={20} /></button>}</div>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">{isAr ? "خلفية المحادثة" : "Chat Background"}</label>
                        <div className="grid grid-cols-2 gap-4">
                          <label className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-3xl cursor-pointer transition-all group ${tempBgUrl ? "border-emerald-500/50 bg-emerald-500/5" : "border-white/10 hover:bg-white/5 hover:border-[var(--brand-a)]/30"}`}>
                            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={uploading} /><FiUploadCloud size={24} className={`mb-2 ${uploading ? "animate-bounce text-[var(--brand-a)]" : tempBgUrl ? "text-emerald-500" : "text-muted group-hover:text-[var(--brand-a)]"}`} /><span className="text-[10px] font-bold text-muted uppercase tracking-wider">{uploading ? (isAr ? "جاري الرفع..." : "Uploading...") : tempBgUrl ? (isAr ? "تم الاختيار" : "Selected") : (isAr ? "رفع صورة" : "Upload Image")}</span>
                          </label>
                          <button onClick={() => setTempBgUrl(null)} className="flex flex-col items-center justify-center p-6 border border-white/5 bg-white/5 rounded-3xl hover:bg-red-500/10 transition-all group"><FiTrash2 size={24} className="mb-2 text-muted group-hover:text-red-500" /><span className="text-[10px] font-bold text-muted uppercase tracking-wider group-hover:text-red-500">{isAr ? "حذف الخلفية" : "Remove"}</span></button>
                        </div>
                      </div>
                    </div>
                    <button onClick={saveSettings} disabled={loading} className="w-full mt-10 py-4 bg-[var(--brand-a)] text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-[var(--brand-a)]/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">{loading ? (isAr ? "جاري الحفظ..." : "Saving...") : (isAr ? "حفظ التغييرات" : "Save Changes")}</button>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Delete Confirmation */}
            <AnimatePresence>
              {messageToDelete && (
                <div className="absolute inset-0 z-[110] flex items-center justify-center p-6 backdrop-blur-sm bg-black/40">
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                    className="w-full max-w-sm glass-card p-8 rounded-[2.5rem] shadow-2xl border border-white/10 text-center"
                  >
                    <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20"><FiAlertCircle size={32} /></div>
                    <h3 className="text-xl font-black mb-2">{isAr ? "حذف الرسالة؟" : "Delete Message?"}</h3>
                    <p className="text-sm text-muted mb-8">{isAr ? "هل أنت متأكد؟ لا يمكن التراجع." : "Are you sure? This cannot be undone."}</p>
                    <div className="flex gap-3"><button onClick={() => setMessageToDelete(null)} className="flex-1 py-3 bg-white/5 rounded-2xl font-bold">{isAr ? "تراجع" : "Cancel"}</button><button onClick={confirmDelete} className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-black">{isAr ? "حذف" : "Delete"}</button></div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-8">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-40 h-40 rounded-[4rem] bg-gradient-to-br from-[var(--brand-a)]/5 to-purple-500/5 flex items-center justify-center text-[var(--brand-a)] shadow-2xl border border-[var(--brand-a)]/10"><FiMessageSquare size={60} className="opacity-40" /></motion.div>
            <div className="space-y-3"><h3 className="text-3xl font-black text-white tracking-tight">{t.chat.title}</h3><p className="text-muted max-w-sm mx-auto leading-relaxed font-medium">{t.chat.selectUser}</p></div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 20px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); }
      `}</style>
    </div>
  );
}
