"use client";

import "react-toastify/dist/ReactToastify.css";
import dynamic from "next/dynamic";
import { ToastContainer } from "react-toastify";
import { useAuthSession } from "@/hooks/use-auth-session";

// تحميل بوت الدردشة بشكل ديناميكي لتحسين الأداء
const ChatBot = dynamic(() => import("@/components/ui/chat-bot").then(mod => mod.ChatBot), {
  ssr: false,
});

export function Providers({ children }: { children: React.ReactNode }) {
  useAuthSession();

  return (
    <>
      {children}
      <ToastContainer position="bottom-right" />
      {/* بوت الدردشة يتم تحميله في جهة العميل فقط */}
      <ChatBot />
    </>
  );
}
