"use client";

import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "react-toastify";
import { FiCamera, FiUser } from "react-icons/fi";
import { getSupabase } from "@/lib/supabase";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { type Profile } from "@/types";
import { compressImage } from "@/lib/image-compression";
import { useParams } from "next/navigation";
import { translations } from "@/data/translations";
import { type Locale } from "@/types";

interface EditProfileModalProps {
  open: boolean;
  profile: Profile;
  onClose: () => void;
  onUpdated: (updated: Profile) => void;
}

async function uploadImage(supabase: ReturnType<typeof import("@/lib/supabase").getSupabase>, bucket: string, userId: string, file: File): Promise<string | null> {
  const ext = file.name.split(".").pop();
  const path = `${userId}/${bucket}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) { toast.error(error.message); return null; }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export function EditProfileModal({ open, profile, onClose, onUpdated }: EditProfileModalProps) {
  const params = useParams();
  const locale = (params?.locale as Locale) || "en";
  const t = translations[locale];
  
  const supabase = getSupabase();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url);
  const [coverPreview, setCoverPreview] = useState<string | null>(profile.cover_url);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      full_name: profile.full_name ?? "",
      username: profile.username ?? "",
      bio: profile.bio ?? "",
      location: profile.location ?? "",
      website: profile.website ?? "",
      twitter: profile.twitter ?? "",
      instagram: profile.instagram ?? "",
      github: profile.github ?? "",
    },
    validationSchema: Yup.object({
      full_name: Yup.string().max(60),
      username: Yup.string().min(3).max(30).matches(/^[a-zA-Z0-9_]+$/, "Letters, numbers & underscores only").optional(),
      bio: Yup.string().max(200).optional(),
      location: Yup.string().max(80).optional(),
      website: Yup.string().test("is-url", "Enter a valid URL (https://...)", (value) => !value || /^https?:\/\//i.test(value) || Yup.string().url().isValidSync(value)).optional(),
      twitter: Yup.string().max(50).optional(),
      instagram: Yup.string().max(50).optional(),
      github: Yup.string().max(50).optional(),
    }),
    onSubmit: async (values) => {
      let avatar_url = profile.avatar_url;
      let cover_url = profile.cover_url;

      const uploads: Promise<void>[] = [];

      if (avatarFile) {
        uploads.push(
          compressImage(avatarFile, 400)
            .then(compressed => uploadImage(supabase, "avatars", profile.id, compressed))
            .then(url => { if (url) avatar_url = url; })
        );
      }
      if (coverFile) {
        uploads.push(
          compressImage(coverFile, 1200)
            .then(compressed => uploadImage(supabase, "covers", profile.id, compressed))
            .then(url => { if (url) cover_url = url; })
        );
      }

      if (uploads.length > 0) {
        await Promise.all(uploads);
      }

      const updates = {
        full_name: values.full_name || null,
        username: values.username || null,
        bio: values.bio || null,
        location: values.location || null,
        website: values.website || null,
        twitter: values.twitter || null,
        instagram: values.instagram || null,
        github: values.github || null,
        avatar_url,
        cover_url,
      };

      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", profile.id)
        .select("*")
        .single();

      if (error) return toast.error(error.message);
      toast.success(locale === "ar" ? "تم تحديث الملف الشخصي!" : "Profile updated!");
      onUpdated(data as Profile);
      onClose();
    },
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAvatarFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setCoverFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setCoverPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  return (
    <Modal open={open} onClose={onClose} title={t.modal.editProfile} maxWidth="600px">
      <form onSubmit={formik.handleSubmit} className="space-y-5">
        {/* Cover + Avatar images */}
        <div>
          <label className="input-label mb-2">{t.modal.coverImg}</label>
          <label className="relative block h-28 rounded-xl overflow-hidden cursor-pointer bg-gradient-to-br from-indigo-500/40 to-purple-500/40 border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors group">
            {coverPreview && (
              <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
              <FiCamera size={20} className="text-white" />
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
          </label>
        </div>

        <div className="flex items-center gap-4">
          <label className="relative cursor-pointer group">
            <Avatar src={avatarPreview} name={formik.values.full_name || profile.email} size={64} />
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
              <FiCamera size={16} className="text-white" />
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </label>
          <div className="text-sm text-muted">{t.modal.avatarSub}</div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t.modal.fullName} name="full_name" placeholder={t.modal.fullName} formik={formik} />
          <Field label={t.modal.username} name="username" placeholder={t.modal.username} formik={formik} prefix="@" />
        </div>

        <div>
          <label className="input-label">{t.modal.bio}</label>
          <textarea
            name="bio"
            rows={3}
            className="input-field resize-none"
            placeholder={t.modal.bio}
            value={formik.values.bio}
            onChange={formik.handleChange}
          />
          {formik.errors.bio && <p className="input-error">{formik.errors.bio}</p>}
          <p className="text-muted text-xs mt-1">{formik.values.bio.length}/200</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t.modal.location} name="location" placeholder={t.modal.location} formik={formik} />
          <Field label={t.modal.website} name="website" placeholder="https://..." formik={formik} forceLtr />
        </div>

        <div className="space-y-1">
          <p className="input-label">{t.modal.socialLinks}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Twitter" name="twitter" placeholder="handle" formik={formik} prefix="@" />
            <Field label="Instagram" name="instagram" placeholder="handle" formik={formik} prefix="@" />
            <Field label="GitHub" name="github" placeholder="username" formik={formik} prefix="@" />
          </div>
        </div>

        <div className="flex gap-3 justify-end border-t border-[var(--border)] pt-4">
          <button type="button" onClick={onClose} className="btn-ghost">
            {t.common.cancel}
          </button>
          <button type="submit" disabled={formik.isSubmitting} className="btn-primary">
            {formik.isSubmitting ? t.common.update : t.common.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label,
  name,
  placeholder,
  formik,
  prefix,
  forceLtr,
}: {
  label: string;
  name: string;
  placeholder?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formik: any;
  prefix?: string;
  forceLtr?: boolean;
}) {
  const isLtr = forceLtr || !!prefix;
  return (
    <div>
      <label className="input-label">{label}</label>
      <div className="relative" dir={isLtr ? "ltr" : undefined}>
        {prefix && (
          <span className="absolute start-4 top-1/2 -translate-y-1/2 text-muted text-sm font-bold select-none z-10 pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          name={name}
          className={`input-field ${isLtr ? "text-start" : ""} ${prefix ? "!ps-10" : ""}`}
          placeholder={placeholder}
          value={formik.values[name]}
          onChange={formik.handleChange}
          autoComplete="off"
        />
      </div>
      {formik.errors[name] && formik.touched[name] && (
        <p className="input-error">{formik.errors[name]}</p>
      )}
    </div>
  );
}
