import { AuthForm } from "@/components/sections/auth-form";

export default async function LoginPage({ params }: { params: Promise<{ locale: "en" | "ar" }> }) {
  const { locale } = await params;
  return <AuthForm mode="login" locale={locale} />;
}
