import { AuthForm } from "@/components/sections/auth-form";

export default async function RegisterPage({ params }: { params: Promise<{ locale: "en" | "ar" }> }) {
  const { locale } = await params;
  return <AuthForm mode="register" locale={locale} />;
}
