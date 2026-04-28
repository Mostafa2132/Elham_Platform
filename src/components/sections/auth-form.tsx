"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import { useState } from "react";
import { FiMail, FiLock, FiUser, FiArrowRight, FiEye, FiEyeOff } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import { getSupabase } from "@/lib/supabase";
import Image from "next/image";

interface AuthFormProps {
  mode: "login" | "register";
  locale: "en" | "ar";
}

export function AuthForm({ mode, locale }: AuthFormProps) {
  const router = useRouter();
  const supabase = getSupabase();
  const [showPassword, setShowPassword] = useState(false);

  const schema = Yup.object({
    email: Yup.string().email("Invalid email").required("Email is required"),
    password: Yup.string().min(6, "Min 6 characters").required("Password is required"),
    fullName:
      mode === "register"
        ? Yup.string().min(2, "Min 2 characters").required("Full name is required")
        : Yup.string().optional(),
  });

  const handleForgotPassword = async () => {
    if (!formik.values.email) {
      return toast.error(locale === "ar" ? "يرجى إدخال بريدك الإلكتروني أولاً" : "Please enter your email first");
    }
    
    const { error } = await supabase.auth.resetPasswordForEmail(formik.values.email, {
      redirectTo: `${window.location.origin}/${locale}/reset-password`,
    });

    if (error) return toast.error(error.message);
    toast.info(locale === "ar" 
      ? "تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني" 
      : "Reset link sent to your email!");
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/${locale}`,
      },
    });
    if (error) toast.error(error.message);
  };

  const formik = useFormik({
    initialValues: { email: "", password: "", fullName: "" },
    validationSchema: schema,
    onSubmit: async (values) => {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (error) return toast.error(error.message);
        toast.success(locale === "ar" ? "مرحباً بك مجدداً! 👋" : "Welcome back! 👋");
        return router.push(`/${locale}`);
      }

      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: { data: { full_name: values.fullName } },
      });

      if (error) return toast.error(error.message);

      if (data.user) {
        await supabase.from("profiles").upsert(
          {
            id: data.user.id,
            email: values.email,
            full_name: values.fullName,
            role: "user",
          },
          { onConflict: "id" }
        );
      }

      toast.success(locale === "ar" ? "تم إنشاء الحساب! أهلاً بك في إلهام ✨" : "Account created! Welcome to Elham ✨");
      router.push(`/${locale}`);
    },
  });

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <motion.div
        className="glass w-full max-w-md rounded-3xl p-8 space-y-6"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="relative h-16 w-16 mx-auto drop-shadow-xl">
            <Image
              src="/logo.png"
              alt="Elham Logo"
              fill
              className="object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold">
            {mode === "login" ? (locale === "ar" ? "أهلاً بعودتك" : "Welcome back") : (locale === "ar" ? "انضم لإلهام" : "Join Elham")}
          </h1>
          <p className="text-muted text-sm">
            {mode === "login"
              ? (locale === "ar" ? "سجّل دخولك للمتابعة" : "Sign in to your account to continue")
              : (locale === "ar" ? "أنشئ حسابك وابدأ المشاركة" : "Create your account and start sharing")}
          </p>
        </div>

        <form onSubmit={formik.handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="input-label">{locale === "ar" ? "الاسم الكامل" : "Full Name"}</label>
              <div className="relative">
                <FiUser size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  name="fullName"
                  className="input-field !pl-11"
                  placeholder={locale === "ar" ? "اسمك الكامل" : "Your full name"}
                  value={formik.values.fullName}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
              </div>
              {formik.errors.fullName && formik.touched.fullName && (
                <p className="input-error">{formik.errors.fullName}</p>
              )}
            </div>
          )}

          <div>
            <label className="input-label">{locale === "ar" ? "البريد الإلكتروني" : "Email"}</label>
            <div className="relative">
              <FiMail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                name="email"
                type="email"
                className="input-field !pl-11"
                placeholder="your@email.com"
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
            </div>
            {formik.errors.email && formik.touched.email && (
              <p className="input-error">{formik.errors.email}</p>
            )}
          </div>

          <div>
            <label className="input-label">{locale === "ar" ? "كلمة المرور" : "Password"}</label>
            <div className="relative">
              <FiLock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                className="input-field !pl-11 !pr-11"
                placeholder="••••••••"
                value={formik.values.password}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              <button
                type="button"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
              </button>
            </div>
            {mode === "login" && (
              <div className="flex justify-end p-1">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-[var(--muted)] hover:text-[var(--brand-a)] transition-colors"
                >
                  {locale === "ar" ? "نسيت كلمة المرور؟" : "Forgot password?"}
                </button>
              </div>
            )}
            {formik.errors.password && formik.touched.password && (
              <p className="input-error">{formik.errors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={formik.isSubmitting}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base mt-2"
          >
            {formik.isSubmitting ? (
              locale === "ar" ? "جاري التحميل..." : "Please wait..."
            ) : (
              <>
                {mode === "login" ? (locale === "ar" ? "تسجيل الدخول" : "Sign In") : (locale === "ar" ? "إنشاء حساب" : "Create Account")}
                <FiArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 pt-2">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] text-muted font-bold uppercase tracking-widest">
            {locale === "ar" ? "أو الدخول عبر" : "Or continue with"}
          </span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Social Login Icons Only */}
        <div className="flex items-center justify-center gap-4">
          <motion.button
            type="button"
            onClick={handleGoogleLogin}
            whileHover={{ scale: 1.1, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="p-3.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all shadow-lg"
            title="Google"
          >
            <FcGoogle size={24} />
          </motion.button>
        </div>

        <p className="text-center text-sm text-muted">
          {mode === "login" ? (
            <>
              {locale === "ar" ? "ليس لديك حساب؟ " : "Don't have an account? "}
              <Link href={`/${locale}/register`} className="text-[var(--brand-a)] hover:underline font-medium">
                {locale === "ar" ? "سجّل الآن" : "Register"}
              </Link>
            </>
          ) : (
            <>
              {locale === "ar" ? "لديك حساب بالفعل؟ " : "Already have an account? "}
              <Link href={`/${locale}/login`} className="text-[var(--brand-a)] hover:underline font-medium">
                {locale === "ar" ? "تسجيل الدخول" : "Login"}
              </Link>
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
}
