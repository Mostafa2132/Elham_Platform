import { notFound } from "next/navigation";
import { isLocale, getDirection } from "@/lib/i18n";
import { Providers } from "@/components/layout/providers";
import { Navbar } from "@/components/layout/navbar";
import { Sidebar } from "@/components/layout/sidebar";
import { AnnouncementBanner } from "@/components/layout/announcement-banner";
import { ThemeProvider } from "@/context/theme-context";
import type { Locale } from "@/types";
import { translations } from "@/data/translations";

/**
 * إعداد بيانات الـ SEO للموقع بالكامل
 * تساعد محركات البحث على فهم محتوى الموقع بلغات مختلفة
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = translations[locale as Locale] || translations.en;
  
  return {
    title: {
      template: `%s | ${t.brand}`,
      default: t.brand,
    },
    description: t.homeSub,
    keywords: ["إلهام", "elham", "social media", "wisdom", "inspiration", "حكمة", "إبداع"],
    authors: [{ name: "Elham Team" }],
    openGraph: {
      title: t.brand,
      description: t.homeSub,
      type: "website",
      locale: locale,
    },
    twitter: {
      card: "summary_large_image",
      title: t.brand,
      description: t.homeSub,
    },
  };
}

/**
 * المكون الأساسي لتغليف كل صفحات الموقع (LocaleLayout)
 * يقوم بإدارة اللغة، الاتجاه (RTL/LTR)، والثيم (Dark/Light)
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  
  // التأكد من أن اللغة المدخلة مدعومة في الموقع
  if (!isLocale(locale)) notFound();

  return (
    <div dir={getDirection(locale as Locale)}>
      <ThemeProvider>
        <Providers>
          {/* شريط الإعلانات العلوي */}
          <AnnouncementBanner />
          
          {/* شريط التنقل العلوي */}
          <Navbar locale={locale as Locale} />
          
          {/* هيكل المحتوى الرئيسي */}
          <div className="mx-auto max-w-6xl px-4 pb-16 pt-4">
            <div className="flex gap-6">
              {/* المنطقة الأساسية للمحتوى */}
              <main className="flex-1 min-w-0 space-y-4">{children}</main>
              
              {/* القائمة الجانبية (تظهر في الشاشات الكبيرة) */}
              <Sidebar locale={locale} />
            </div>
          </div>
        </Providers>
      </ThemeProvider>
    </div>
  );
}
