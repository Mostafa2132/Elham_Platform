"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FiPower, FiMoon, FiSun, FiMenu, FiX, FiSearch } from "react-icons/fi";
import { useState, useEffect } from "react";
import { getSupabase } from "@/lib/supabase";
import { translations } from "@/data/translations";
import { type Locale } from "@/types";
import { useAuthStore } from "@/store/auth-store";
import { useInteractionStore } from "@/store/interaction-store";
import { useTheme } from "@/context/theme-context";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { UnifiedSearch } from "@/components/ui/unified-search";
import Image from "next/image";
import { NotificationPopover } from "@/components/ui/notification-popover";

/**
 * مكون شريط التنقل العلوي (Navbar)
 * يدعم التبديل بين اللغات، تغيير الثيم (Light/Dark)، والتحكم في حساب المستخدم.
 */
export function Navbar({ locale }: { locale: Locale }) {
  const supabase = getSupabase();
  const t = translations[locale];
  const path = usePathname();
  const router = useRouter();
  
  // الوصول لحالة المصادقة والثيم من الـ Store والـ Context
  const { user, profile } = useAuthStore();
  const unreadChatCount = useInteractionStore(state => state.getGlobalUnreadCount());
  const { incrementUnreadForUser } = useInteractionStore();
  const { theme, toggleTheme } = useTheme();
  
  // مراقب عام للرسائل الواردة لتحديث العدادات لحظياً في كل الموقع
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("global-messages")
      .on(
        "postgres_changes",
        { 
          event: "INSERT", 
          schema: "public", 
          table: "messages", 
          filter: `receiver_id=eq.${user.id}` 
        },
        (payload) => {
          const msg = payload.new;
          // زيادة العداد للمرسل
          incrementUnreadForUser(msg.sender_id);
          // يمكن إضافة صوت تنبيه هنا مستقبلاً
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, incrementUnreadForUser]);
  
  // حالات التحكم في قائمة الموبايل ومودال تسجيل الخروج والبحث
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // منطق التبديل بين اللغات (عربي/إنجليزي)
  const other = locale === "ar" ? "en" : "ar";
  const clean = path.replace(/^\/(ar|en)/, "") || "/";

  // وظيفة تسجيل الخروج للمستخدم
  const logout = async () => {
    setShowLogoutModal(false);
    setMenuOpen(false);
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
  };

  return (
    <header className="sticky top-0 z-40 px-2 py-2 sm:px-3 sm:py-2.5">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="glass mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-2 py-2 sm:px-4 sm:py-2.5 max-md:!bg-[var(--bg)]/95 max-md:!backdrop-blur-2xl"
      >
        {/* الشعار ورابط الصفحة الرئيسية */}
        <Link
          href={`/${locale}`}
          className="flex min-w-0 max-w-[44vw] items-center gap-1.5 text-lg font-bold sm:max-w-none sm:gap-2"
        >
          <div className="relative h-7 w-7 shrink-0 sm:h-8 sm:w-8">
            <Image
              src="/logo.png"
              alt="Elham Logo"
              fill
              className="object-contain"
            />
          </div>
          <span className="brand-gradient-text hidden truncate tracking-tight min-[420px]:inline">
            {t.brand}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <NavLink href={`/${locale}`} path={path}>
            {t.nav.home}
          </NavLink>
          <NavLink href={`/${locale}/zen-rooms`} path={path}>
            {t.nav.zen}
          </NavLink>
          {!user && (
            <>
              <NavLink href={`/${locale}/login`} path={path}>
                {t.nav.login}
              </NavLink>
              <Link
                href={`/${locale}/register`}
                className="btn-primary text-sm px-4 py-1.5 ml-1"
              >
                {t.nav.register}
              </Link>
            </>
          )}
          {user && (
            <>
              <NavLink href={`/${locale}/chat`} path={path}>
                <div className="flex items-center gap-2 relative">
                  {t.nav.messages}
                  {unreadChatCount > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-black text-white shadow-[0_0_15px_rgba(244,63,94,0.6)] animate-pulse">
                      {unreadChatCount}
                    </span>
                  )}
                </div>
              </NavLink>
              <NavLink href={`/${locale}/profile`} path={path}>
                {t.nav.profile}
              </NavLink>
              {profile?.role === "admin" && (
                <NavLink href={`/${locale}/admin`} path={path}>
                  {t.nav.admin}
                </NavLink>
              )}
            </>
          )}
        </nav>

        {/* Right side controls */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          {/* Global Search Trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="btn-ghost rounded-full p-1.5 text-muted transition-all hover:bg-indigo-500/10 hover:text-indigo-400 sm:p-2"
            aria-label="Search"
          >
            <FiSearch size={18} />
          </button>

          {/* Notifications */}
          {user && <NotificationPopover locale={locale} />}

          {/* Language switcher */}
          <Link
            href={`/${other}${clean}`}
            className="btn-ghost rounded-lg px-2 py-1.5 text-xs font-medium sm:px-2.5"
          >
            {other.toUpperCase()}
          </Link>

          {/* Theme toggle */}
          <button
            className="btn-ghost rounded-full p-1.5 sm:p-2"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            <motion.div
              key={theme}
              initial={{ rotate: -30, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {theme === "dark" ? <FiSun size={16} /> : <FiMoon size={16} />}
            </motion.div>
          </button>

          {/* Avatar + logout (desktop) */}
          {user && (
            <div className="hidden md:flex items-center gap-1 p-1 pr-3 glass rounded-full border border-white/10 hover:border-white/20 transition-colors group">
              <Link href={`/${locale}/profile`} className="hover:opacity-80 transition-opacity">
                <Avatar
                  src={profile?.avatar_url}
                  name={profile?.full_name ?? profile?.email}
                  size={32}
                />
              </Link>
              <div className="w-[1px] h-4 bg-white/10 mx-1" />
              <button
                className="p-1.5 rounded-full text-muted hover:text-red-500 transition-all duration-300 relative group/btn"
                onClick={() => setShowLogoutModal(true)}
                aria-label="Logout"
              >
                <motion.div
                  whileHover={{ scale: 1.15, rotate: -10 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <FiPower size={16} className="group-hover/btn:drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                </motion.div>
              </button>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button
            className="btn-ghost rounded-full p-1.5 md:hidden sm:p-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <FiX size={18} /> : <FiMenu size={18} />}
          </button>
        </div>
      </motion.div>

      {/* Mobile menu */}
      {menuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="glass mx-3 mt-1 rounded-2xl p-4 space-y-1 md:hidden !bg-[var(--bg)]/95 !backdrop-blur-2xl"
        >
          <MobileNavLink href={`/${locale}`} onClick={() => setMenuOpen(false)}>
            {t.nav.home}
          </MobileNavLink>
          <MobileNavLink href={`/${locale}/zen-rooms`} onClick={() => setMenuOpen(false)}>
             {t.nav.zen}
          </MobileNavLink>
          {user ? (
            <>
              <MobileNavLink href={`/${locale}/chat`} onClick={() => setMenuOpen(false)}>
                <span className="flex items-center gap-2">
                  {t.nav.messages}
                  {unreadChatCount > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-black text-white shadow-[0_0_15px_rgba(244,63,94,0.6)]">
                      {unreadChatCount}
                    </span>
                  )}
                </span>
              </MobileNavLink>
              <MobileNavLink href={`/${locale}/profile`} onClick={() => setMenuOpen(false)}>
                {t.nav.profile}
              </MobileNavLink>
              {profile?.role === "admin" && (
                <MobileNavLink href={`/${locale}/admin`} onClick={() => setMenuOpen(false)}>
                  {t.nav.admin}
                </MobileNavLink>
              )}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setShowLogoutModal(true);
                }}
                className="w-full flex items-center justify-between gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold bg-red-500/5 hover:bg-red-500/10 text-red-400 border border-red-500/10 transition-all duration-300 group"
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    whileHover={{ scale: 1.15 }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  >
                    <FiPower size={16} className="group-hover:drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                  </motion.div>
                  {t.nav.logout}
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              </button>
            </>
          ) : (
            <>
              <MobileNavLink href={`/${locale}/login`} onClick={() => setMenuOpen(false)}>
                {t.nav.login}
              </MobileNavLink>
              <MobileNavLink href={`/${locale}/register`} onClick={() => setMenuOpen(false)}>
                {t.nav.register}
              </MobileNavLink>
            </>
          )}
        </motion.div>
      )}

      <Modal open={showLogoutModal} onClose={() => setShowLogoutModal(false)} title={locale === "ar" ? "تسجيل الخروج" : "Logout"}>
        <div className="space-y-6">
          <p className="text-muted">
            {locale === "ar" ? "هل أنت متأكد أنك تريد تسجيل الخروج من إلهام؟" : "Are you sure you want to log out from Elham?"}
          </p>
          <div className="flex items-center gap-3 justify-end">
            <button onClick={() => setShowLogoutModal(false)} className="btn-ghost">
              {t.common.cancel}
            </button>
            <button onClick={logout} className="btn-primary bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-0">
              {t.nav.logout}
            </button>
          </div>
        </div>
      </Modal>

      <UnifiedSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        locale={locale}
      />
    </header>
  );
}

function NavLink({ href, path, children }: { href: string; path: string; children: React.ReactNode }) {
  const isActive = path === href;
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
        isActive
          ? "brand-gradient-text font-medium"
          : "text-[var(--muted)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center rounded-xl px-3 py-2.5 text-sm hover:bg-[var(--glass)] transition-colors"
    >
      {children}
    </Link>
  );
}
