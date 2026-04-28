"use client";

import { ProtectedRoute } from "@/components/layout/protected-route";
import { ChatView } from "@/components/chat/chat-view";
import { useParams } from "next/navigation";
import { type Locale } from "@/types";

export default function ChatPage() {
  const params = useParams();
  const locale = (params?.locale as Locale) || "en";

  return (
    <ProtectedRoute>
      <ChatView locale={locale} />
    </ProtectedRoute>
  );
}
