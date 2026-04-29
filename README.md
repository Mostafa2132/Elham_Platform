# Elham Platform

منصة اجتماعية ثنائية اللغة (العربية/الإنجليزية) لمشاركة المحتوى الملهم، مبنية بـ `Next.js` و`Supabase`، مع تكامل `Google Analytics` و`Google AdSense` ودعم مدفوعات `Stripe`.

## نظرة سريعة
- **نوع المشروع:** Social/Inspirational Platform.
- **الوظائف الأساسية:** Auth, Profiles, Posts, Likes, Admin, Ads.
- **الخدمات الخارجية:** Supabase, Google Analytics, Google AdSense, Stripe.

## المميزات
- تسجيل ودخول عبر Supabase Auth.
- إنشاء محتوى والتفاعل عليه بالإعجاب.
- إدارة الملف الشخصي.
- نظام صلاحيات `user` و`admin`.
- دعم SEO أساسي.
- دعم الربح بالإعلانات (AdSense).
- مسار مدفوعات Pro عبر Stripe (اختياري حسب نموذجك التجاري).

## التقنيات
- `Next.js` (App Router) + `TypeScript`
- `Tailwind CSS`
- `Supabase` (`Auth`, `Database`, `RLS`, `Storage`)
- `Zustand`, `Formik`, `Yup`, `Framer Motion`
- `Stripe`

## هيكل المشروع
```txt
src/
  app/
    [locale]/
    api/stripe/
  components/
  hooks/
  lib/
  store/
  types/
  utils/
public/
supabase-init.sql
```

## التشغيل محليًا
1. تثبيت dependencies:
```bash
npm install
```
2. إنشاء ملف `.env.local` في جذر المشروع.
3. إضافة كل المتغيرات المطلوبة (القسم التالي).
4. تشغيل المشروع:
```bash
npm run dev
```
5. فتح `http://localhost:3000`.

## متغيرات البيئة (Environment Variables)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google
NEXT_PUBLIC_GOOGLE_ANALYTICS=
NEXT_PUBLIC_GOOGLE_ADSENSE=

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## منين أجيب كل متغير؟
- `NEXT_PUBLIC_SUPABASE_URL`: من Supabase -> Project Settings -> API -> Project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: من Supabase -> API Keys -> `anon`/`publishable`.
- `SUPABASE_SERVICE_ROLE_KEY`: من Supabase -> API Keys -> `service_role` (سري جدًا).
- `NEXT_PUBLIC_GOOGLE_ANALYTICS`: من Google Analytics -> Data Stream -> Measurement ID (`G-...`).
- `NEXT_PUBLIC_GOOGLE_ADSENSE`: من Google AdSense -> Account -> Publisher ID (`ca-pub-...`).
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: من Stripe Dashboard -> Developers -> API keys -> Publishable key.
- `STRIPE_SECRET_KEY`: من Stripe Dashboard -> Developers -> API keys -> Secret key.
- `STRIPE_WEBHOOK_SECRET`: من Stripe Dashboard -> Developers -> Webhooks -> Signing secret (`whsec_...`).
- `NEXT_PUBLIC_APP_URL`: رابط الموقع النهائي (مثال: `https://your-domain.vercel.app`).

## إعداد Supabase
1. أنشئ مشروع Supabase.
2. افتح SQL Editor.
3. نفّذ ملف `supabase-init.sql`.
4. تأكد من RLS والسياسات.
5. (اختياري) أنشئ bucket للصور لو تدفقك يحتاجه.

## Google Analytics
1. ادخل [Google Analytics](https://analytics.google.com/).
2. أنشئ Property للموقع.
3. أنشئ Web Data Stream.
4. خذ Measurement ID وأضفه في:
```bash
NEXT_PUBLIC_GOOGLE_ANALYTICS=G-XXXXXXXXXX
```
5. التكامل في الكود موجود عبر `src/components/layout/google-scripts.tsx`.

## الربح من Google (AdSense)
1. قدّم موقعك في [Google AdSense](https://www.google.com/adsense/start/).
2. بعد القبول، انسخ Publisher ID:
```bash
NEXT_PUBLIC_GOOGLE_ADSENSE=ca-pub-XXXXXXXXXXXX
```
3. تأكد من وجود صفحات:
   - Privacy Policy
   - Terms
   - Contact
4. استخدم دومين واضح ومحتوى أصلي لزيادة فرصة الموافقة.

## النشر على Vercel
1. ارفع المشروع على GitHub.
2. افتح [Vercel](https://vercel.com/) واعمل Import للريبو.
3. Vercel يكتشف Next.js تلقائيًا.
4. أضف Environment Variables نفسها في Vercel (Production + Preview).
5. Deploy.
6. بعد النشر:
   - حدّث `NEXT_PUBLIC_APP_URL` بالرابط النهائي.
   - أضف نفس الدومين في Supabase Auth redirect URLs.
   - اختبر تسجيل الدخول والدفع والتحليلات.

## أوامر مفيدة
```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
```

## ملاحظات أمان مهمة
- لا ترفع `.env.local` إلى Git.
- لا تشارك `STRIPE_SECRET_KEY` أو `SUPABASE_SERVICE_ROLE_KEY` أو `STRIPE_WEBHOOK_SECRET`.
- اعمل rotate للمفاتيح لو حصل تسريب.
- مفاتيح `NEXT_PUBLIC_*` تُعرض للعميل، فخليها للمفاتيح العامة فقط.
