export const POST_THEMES = [
  { id: "default", name: "Classic Glass", name_ar: "كلاسيكي شفاف", class: "glass" },
  { id: "midnight", name: "Midnight Nebula", name_ar: "سديم المنتصف", class: "bg-gradient-to-br from-indigo-900/40 via-purple-900/40 to-slate-900/40 border-indigo-500/30" },
  { id: "aurora", name: "Frosted Aurora", name_ar: "أورورا متجمدة", class: "bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-indigo-500/20 border-emerald-500/30" },
  { id: "dawn", name: "Golden Dawn", name_ar: "فجر ذهبي", class: "bg-gradient-to-br from-amber-500/20 via-orange-600/20 to-rose-600/20 border-amber-500/30" },
  { id: "sunset", name: "Crimson Sunset", name_ar: "غروب قرمزي", class: "bg-gradient-to-br from-rose-500/20 via-pink-600/20 to-purple-600/20 border-rose-500/30" },
  { id: "ocean", name: "Deep Ocean", name_ar: "محيط عميق", class: "bg-gradient-to-br from-blue-600/20 via-cyan-600/20 to-teal-600/20 border-blue-500/30" },
  { id: "forest", name: "Emerald Forest", name_ar: "غابة زمردية", class: "bg-gradient-to-br from-green-600/20 via-emerald-600/20 to-lime-600/20 border-green-500/30" },
  { id: "royal", name: "Royal Amethyst", name_ar: "أرجوان ملكي", class: "bg-gradient-to-br from-violet-600/20 via-purple-600/20 to-indigo-600/20 border-violet-500/30" },
];

export const BADGE_LEVELS = [
  { posts: 0, label_en: "Inspired Learner", label_ar: "متعلم ملهم", color: "text-slate-400", bg: "bg-slate-400/10", icon: "✨" },
  { posts: 3, label_en: "Rising Inspirer", label_ar: "مُلهِم صاعد", color: "text-emerald-400", bg: "bg-emerald-400/10", icon: "🌱" },
  { posts: 10, label_en: "Wisdom Seeker", label_ar: "باحث عن الحكمة", color: "text-cyan-400", bg: "bg-cyan-400/10", icon: "💎" },
  { posts: 25, label_en: "Community Sage", label_ar: "حكيم المجتمع", color: "text-purple-400", bg: "bg-purple-400/10", icon: "🧙" },
  { posts: 50, label_en: "Creative Lighthouse", label_ar: "منارة الإبداع", color: "text-amber-400", bg: "bg-amber-400/10", icon: "🕯️" },
  { posts: 100, label_en: "Master of Elham", label_ar: "سيد الإلهام", color: "text-rose-400", bg: "bg-rose-400/10", icon: "👑" },
];

export function getBadge(postsCount: number, locale: "en" | "ar") {
  const level = [...BADGE_LEVELS].reverse().find(l => postsCount >= l.posts) || BADGE_LEVELS[0];
  return {
    label: locale === "ar" ? level.label_ar : level.label_en,
    color: level.color,
    bg: level.bg,
    icon: level.icon
  };
}
