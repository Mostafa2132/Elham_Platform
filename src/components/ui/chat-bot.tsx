"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiMessageSquare, FiX, FiSend, FiMinimize2, FiMaximize2 } from "react-icons/fi";
import { useAuthStore } from "@/store/auth-store";
import { useParams } from "next/navigation";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
}

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuthStore();
  const params = useParams();
  const locale = params?.locale as string || "en";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized, isTyping]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMsg = locale === "ar" 
        ? "أهلاً بك في إلهام! كيف يمكنني مساعدتك اليوم؟ ✨" 
        : "Welcome to Elham! How can I inspire you today? ✨";
      
      setMessages([{
        id: "1",
        text: welcomeMsg,
        sender: "ai",
        timestamp: new Date()
      }]);
    }
  }, [isOpen, locale]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: "user",
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    // Simulate AI logic
    setTimeout(() => {
      const response = getAIResponse(inputValue, locale);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: "ai",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1500);
  };

  const getAIResponse = (input: string, lang: string) => {
    const text = input.toLowerCase();
    const isArabicInput = /[\u0600-\u06FF]/.test(input);
    const effectiveLang = isArabicInput ? "ar" : lang;

    const name = profile?.full_name?.split(" ")[0] || (effectiveLang === "ar" ? "صديقي" : "friend");

    if (effectiveLang === "ar") {
      if (text.includes("مرحبا") || text.includes("سلام") || text.includes("هلا")) 
        return `أهلاً بك يا ${name}! أنا إلهام، رفيقتك الذكية للإلهام والإبداع. كيف يمكنني مساعدتك اليوم؟`;
      if (text.includes("كيف") && text.includes("حالك")) 
        return "أنا بخير وأشعر بطاقة إبداعية مذهلة! ماذا عنك؟ هل أنت مستعد لكتابة شيء رائع؟";
      if (text.includes("من") && text.includes("أنت")) 
        return "أنا المساعد الذكي لمنصة إلهام. ولدت لأكون رفيقتك في رحلتك الإبداعية والعثور على أفكار ملهمة.";
      if (text.includes("شكرا") || text.includes("تسلم")) 
        return "العفو! هذا واجبي. أنا هنا دائماً عندما تحتاج إلى شرارة إلهام.";
      if (text.includes("بوست") || text.includes("منشور") || text.includes("فكرة")) 
        return "يمكنني مساعدتك في صياغة منشورات احترافية. جرب استخدام زر 'إلهام ذكي' في نافذة إنشاء المنشورات!";
      
      return `هذا جميل جداً يا ${name}! استمر في الإبداع، وأخبرني إذا كنت تريد مني صياغة فكرة أو مراجعة منشور.`;
    } else {
      if (text.includes("hello") || text.includes("hi") || text.includes("hey")) 
        return `Hello ${name}! I'm Elham, your creative AI companion. How can I inspire you today?`;
      if (text.includes("how") && text.includes("are you")) 
        return "I'm doing great and buzzing with ideas! How are you feeling today?";
      if (text.includes("who") && text.includes("are you")) 
        return "I am the Elham Smart Assistant, designed to help you find inspiration and create amazing content on this platform.";
      if (text.includes("thank") || text.includes("thanks")) 
        return "You're very welcome! I'm always here when you need a spark of inspiration.";
      if (text.includes("post") || text.includes("idea") || text.includes("write")) 
        return "I can help you craft professional posts. Try the 'AI Suggest' button in the Create Post modal for instant ideas!";

      return `That's fascinating, ${name}! Keep that creative energy flowing. Let me know if you need help polishing a post or finding a new topic.`;
    }
  };

  return (
    <div className="fixed bottom-6 end-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: isMinimized ? "64px" : "480px"
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-80 sm:w-96 glass-effect overflow-hidden flex flex-col shadow-2xl rounded-2xl border border-[var(--border)]"
            style={{ 
              backgroundColor: "var(--glass)",
              backdropFilter: "blur(12px)",
              maxHeight: "80vh"
            }}
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-600/80 to-purple-600/80 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white shadow-lg">
                  <FiMessageSquare size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    {locale === "ar" ? "مساعد إلهام" : "Elham Assistant"}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]"></span>
                    <span className="text-[10px] text-white/90 uppercase tracking-wider font-medium">Online</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white/90 transition-colors"
                >
                  {isMinimized ? <FiMaximize2 size={16} /> : <FiMinimize2 size={16} />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-red-500/50 rounded-lg text-white/90 transition-colors"
                >
                  <FiX size={16} />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                          msg.sender === "user"
                            ? "bg-indigo-600 text-white rounded-br-none shadow-md"
                            : "bg-[var(--bg-soft)] text-[var(--text)] rounded-bl-none border border-[var(--border)] shadow-sm"
                        }`}
                      >
                        {msg.text}
                        <div className={`text-[10px] mt-1 opacity-60 ${msg.sender === "user" ? "text-end" : "text-[var(--muted)] text-start"}`}>
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-[var(--bg-soft)] p-3 rounded-2xl rounded-bl-none border border-[var(--border)]">
                        <div className="flex gap-1">
                          <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-[var(--text)] rounded-full"></motion.span>
                          <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-[var(--text)] rounded-full"></motion.span>
                          <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-[var(--text)] rounded-full"></motion.span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSend} className="p-4 border-t border-[var(--border)] bg-[var(--bg-card)]">
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl py-2.5 ps-4 pe-12 text-sm text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-indigo-500/50 transition-all"
                      placeholder={locale === "ar" ? "اكتب رسالتك هنا..." : "Type your message..."}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="absolute end-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
                    >
                      <FiSend size={16} />
                    </button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          if (isOpen && isMinimized) setIsMinimized(false);
          else setIsOpen(!isOpen);
        }}
        className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-all ${
          isOpen && !isMinimized 
            ? "bg-red-500 rotate-90" 
            : "bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600"
        }`}
      >
        {isOpen && !isMinimized ? <FiX size={24} /> : <FiMessageSquare size={24} />}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full"></span>
        )}
      </motion.button>
    </div>
  );
}
