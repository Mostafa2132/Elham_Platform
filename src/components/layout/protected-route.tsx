"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

export function ProtectedRoute({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading } = useAuthStore();

  // Extract locale from pathname (e.g. /en/profile → en)
  const locale = pathname.split("/")[1] || "en";

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/${locale}/login`);
    else if (adminOnly && profile?.role !== "admin") router.replace(`/${locale}`);
  }, [adminOnly, loading, locale, profile?.role, router, user]);

  if (loading) {
    return (
      <div className="glass rounded-2xl p-8 flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-[var(--brand-a)] border-t-transparent animate-spin" />
        <p className="text-muted text-sm">Loading...</p>
      </div>
    );
  }

  if (!user) return null;
  if (adminOnly && profile?.role !== "admin") return null;
  return <>{children}</>;
}
