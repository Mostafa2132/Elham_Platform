"use client";

import { motion } from "framer-motion";
import { FiX, FiCoffee, FiHeart, FiStar, FiZap } from "react-icons/fi";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { type Profile, type Locale } from "@/types";
import { translations } from "@/data/translations";

export function SupportModal({
  open,
  onClose,
  profile,
  locale
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  locale: Locale;
}) {
  const t = translations[locale];

  return (
    <Modal open={open} onClose={onClose} title={t.support.title}>
      <div className="space-y-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Avatar src={profile.avatar_url} name={profile.full_name} size={72} />
            <div className="absolute -bottom-1 -right-1 bg-amber-500 rounded-full p-1 border-2 border-[var(--bg)] shadow-lg">
              <FiStar size={12} className="text-white fill-white" />
            </div>
          </div>
          <div>
            <h3 className="font-bold text-lg">{profile.full_name}</h3>
            <p className="text-xs text-muted">@{profile.username || "creator"}</p>
          </div>
        </div>

        <p className="text-sm text-muted leading-relaxed italic">
          &quot;{t.support.thankYou}&quot;
        </p>

        <div className="grid grid-cols-1 gap-3">
          <button className="flex items-center justify-between p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all group">
            <div className="flex items-center gap-3">
              <FiCoffee size={20} className="text-amber-500" />
              <div className="text-left">
                <p className="font-bold text-sm">{t.support.buyCoffee}</p>
                <p className="text-[10px] text-muted">{t.support.coffeePrice}</p>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-500 group-hover:translate-x-1 transition-transform">→</span>
          </button>

          <button className="flex items-center justify-between p-4 rounded-2xl bg-pink-500/10 border border-pink-500/20 hover:bg-pink-500/20 transition-all group">
            <div className="flex items-center gap-3">
              <FiHeart size={20} className="text-pink-500" />
              <div className="text-left">
                <p className="font-bold text-sm">{t.support.monthlyPatron}</p>
                <p className="text-[10px] text-muted">{t.support.patronDesc}</p>
              </div>
            </div>
            <span className="text-xs font-bold text-pink-500 group-hover:translate-x-1 transition-transform">→</span>
          </button>
        </div>

        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center justify-center gap-2 text-[10px] uppercase font-black tracking-widest text-white/20">
            <FiZap /> {t.support.secureTransfer}
          </div>
        </div>
      </div>
    </Modal>
  );
}
