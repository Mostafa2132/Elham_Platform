"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "react-toastify";
import { getSupabase } from "@/lib/supabase";
import { ensureProfile } from "@/lib/ensure-profile";
import { useAuthStore } from "@/store/auth-store";

export function CreatePostForm({ locale }: { locale: "en" | "ar" }) {
  const router = useRouter();
  const supabase = getSupabase();
  const { user } = useAuthStore();
  const [uploading, setUploading] = useState(false);

  const formik = useFormik({
    initialValues: { content: "", image: null as File | null },
    validationSchema: Yup.object({ content: Yup.string().min(4).required() }),
    onSubmit: async (values) => {
      if (!user) return toast.error(locale === "ar" ? "يرجى تسجيل الدخول أولاً" : "Please login first");
      const ensured = await ensureProfile(user);
      if (ensured.error) return toast.error(ensured.error.message);

      let image_url: string | null = null;
      if (values.image) {
        setUploading(true);
        const fileName = `${user.id}/${Date.now()}-${values.image.name}`;
        const { error } = await supabase.storage.from("post-images").upload(fileName, values.image);
        if (error) {
          setUploading(false);
          return toast.error(error.message);
        }
        const { data } = supabase.storage.from("post-images").getPublicUrl(fileName);
        image_url = data.publicUrl;
        setUploading(false);
      }

      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        content: values.content,
        image_url
      });

      if (error) return toast.error(error.message);
      toast.success(locale === "ar" ? "تم نشر المنشور" : "Post published");
      router.push(`/${locale}`);
    }
  });

  return (
    <form onSubmit={formik.handleSubmit} className="glass mx-auto max-w-2xl space-y-4 rounded-2xl p-6">
      <h1 className="text-2xl font-semibold">Create post</h1>
      <textarea name="content" rows={6} className="w-full rounded-xl bg-black/20 p-3" placeholder="Share an inspiring idea..." value={formik.values.content} onChange={formik.handleChange} />
      <input type="file" accept="image/*" onChange={(e) => formik.setFieldValue("image", e.currentTarget.files?.[0] ?? null)} />
      <button disabled={formik.isSubmitting || uploading} className="rounded-xl bg-indigo-500 px-4 py-2 text-white">
        {formik.isSubmitting || uploading ? "Publishing..." : "Publish"}
      </button>
    </form>
  );
}
