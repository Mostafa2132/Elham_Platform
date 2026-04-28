"use client";

import Script from "next/script";

interface GoogleScriptsProps {
  // Replace these with your actual IDs when you register
  adSenseId?: string;
  analyticsId?: string;
}

export function GoogleScripts({ 
  adSenseId = "ca-pub-0000000000000000", // Placeholder
  analyticsId = "G-0000000000"           // Placeholder 
}: GoogleScriptsProps) {
  return (
    <>
      {/* 1. Google AdSense */}
      <Script
        id="google-adsense"
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adSenseId}`}
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />

      {/* 2. Google Analytics */}
      <Script
        id="google-analytics"
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${analyticsId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${analyticsId}');
        `}
      </Script>
    </>
  );
}
