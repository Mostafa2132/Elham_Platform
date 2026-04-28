"use client";

import dynamic from "next/dynamic";
import { ProtectedRoute } from "@/components/layout/protected-route";

// تحميل لوحة تحكم المسؤول بشكل ديناميكي (Lazy Loading) لتحسين الأداء
const AdminDashboard = dynamic(() => import("@/components/sections/admin-dashboard").then(mod => mod.AdminDashboard), {
  loading: () => (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand-a)] border-t-transparent" />
    </div>
  ),
  ssr: false,
});

/**
 * صفحة إدارة المنصة (AdminPage) - محمية للمسؤولين فقط
 */
export default function AdminPage() {
  return (
    <ProtectedRoute adminOnly>
      <AdminDashboard />
    </ProtectedRoute>
  );
}
