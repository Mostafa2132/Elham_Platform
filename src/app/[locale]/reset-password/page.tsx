"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import { FiLock, FiArrowRight } from "react-icons/fi";
import { getSupabase } from "@/lib/supabase";
import Image from "next/image";
import { Locale } from "@/types";

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as Locale) || "en";
  const supabase = getSupabase();
  const [loading, setLoading] = useState(false);

  const formik = useFormik({
    initialValues: { password: "", confirmPassword: "" },
    validationSchema: Yup.object({
      password: Yup.string().min(6, "Min 6 characters").required("Required"),
      confirmPassword: Yup.string()
        .oneOf([Yup.ref("password")], "Passwords must match")
        .required("Required"),
    }),
    onSubmit: async (values) => {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (error) {
        setLoading(false);
        return toast.error(error.message);
      }

      toast.success(locale === "ar" ? "تم تحديث كلمة المرور بنجاح!" : "Password updated successfully!");
      router.push(`/${locale}/login`);
    },
  });

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <motion.div
        className="glass w-full max-w-md rounded-3xl p-8 space-y-6"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-center space-y-3">
          <div className="relative h-16 w-16 mx-auto">
            <Image src="/logo.png" alt="Logo" fill className="object-contain" />
          </div>
          <h1 className="text-2xl font-bold">
            {locale === "ar" ? "تعيين كلمة مرور جديدة" : "Reset Password"}
          </h1>
          <p className="text-muted text-sm">
            {locale === "ar" ? "أدخل كلمة المرور الجديدة الخاصة بك" : "Enter your new password below"}
          </p>
        </div>

        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">New Password</label>
            <div className="relative">
              <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={15} />
              <input
                name="password"
                type="password"
                className="input-field !pl-11"
                placeholder="••••••••"
                value={formik.values.password}
                onChange={formik.handleChange}
              />
            </div>
          </div>

          <div>
            <label className="input-label">Confirm Password</label>
            <div className="relative">
              <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={15} />
              <input
                name="confirmPassword"
                type="password"
                className="input-field !pl-11"
                placeholder="••••••••"
                value={formik.values.confirmPassword}
                onChange={formik.handleChange}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
          >
            {loading ? "Updating..." : locale === "ar" ? "تحديث" : "Update Password"}
            {!loading && <FiArrowRight />}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
