import type { Metadata } from "next";
import { GoogleScripts } from "@/components/layout/google-scripts";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "إلهام Elham | منصة المقولات الملهمة الإحترافية",
  description: "انضم إلى إلهام، المنصة الأفضل لمشاركة المقولات والمقالات الملهمة بالعربية والإنجليزية (Bilingual Inspirational Platform).",
  keywords: ["الهام", "إلهام", "مقولات", "اقتباسات", "elham", "quotes", "inspiration", "creativity"],
  openGraph: {
    title: "إلهام Elham | شارك أفكارك واصنع أثراً",
    description: "شارك أفضل مقولاتك وانضم لمجتمع المبدعين على إلهام.",
    url: "https://elham.app", // Replace with actual domain when deploying
    siteName: "Elham",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "إلهام Elham",
    description: "أكبر منصة تفاعلية للمقولات الملهمة.",
  },
  robots: "index, follow",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <GoogleScripts 
          adSenseId={process.env.NEXT_PUBLIC_GOOGLE_ADSENSE}
          analyticsId={process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
