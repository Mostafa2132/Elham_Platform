import { notFound } from "next/navigation";
import { FeedList } from "@/components/sections/feed-list";
import { isLocale } from "@/lib/i18n";
import { translations } from "@/data/translations";
import type { Locale } from "@/types";

/**
 * وظيفة لتوليد بيانات الـ SEO الخاصة بالصفحة الرئيسية
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = translations[locale as Locale] || translations.en;
  
  return {
    title: t.brand,
    description: t.homeSub,
  };
}

/**
 * الصفحة الرئيسية للموقع (HomePage)
 * تعرض قسم الترحيب (Hero Section) وقائمة المنشورات (Feed)
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = translations[locale as Locale];

  return (
    <div className="space-y-5">
      {/* قسم الترحيب والتعريف بالمنصة */}
      <section className="glass relative overflow-hidden rounded-3xl p-7 md:p-9">
        {/* تأثيرات بصرية خلفية (Blurred Circles) */}
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-indigo-500/25 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-12 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl pointer-events-none" />
        
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted border border-[var(--border)] rounded-full px-3 py-1 mb-4">
            ✨ Elham Platform
          </span>
          <h1 className="max-w-2xl text-3xl font-bold leading-tight md:text-4xl lg:text-5xl">
            {t.homeTitle}
          </h1>
          <p className="text-muted mt-3 max-w-xl text-sm md:text-base leading-relaxed">
            {t.homeSub}
          </p>
        </div>
      </section>

      {/* عرض قائمة المنشورات التفاعلية */}
      <FeedList />
    </div>
  );
}
