"use client";

import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "react-toastify";
import { FiImage, FiX, FiCheckCircle, FiZap, FiMic } from "react-icons/fi";
import { getSupabase } from "@/lib/supabase";
import { ensureProfile } from "@/lib/ensure-profile";
import { useAuthStore } from "@/store/auth-store";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { compressImage } from "@/lib/image-compression";
import { useParams } from "next/navigation";
import { translations } from "@/data/translations";
import { type Locale, type Post } from "@/types";
import confetti from "canvas-confetti";
import { POST_THEMES } from "@/lib/constants";

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (post: Post) => void;
  parentId?: string;
}

export function CreatePostModal({ open, onClose, onCreated, parentId }: CreatePostModalProps) {
  const params = useParams();
  const locale = (params?.locale as Locale) || "en";
  const t = translations[locale];

  const supabase = getSupabase();
  const { user, profile } = useAuthStore();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState("default");

  const formik = useFormik({
    initialValues: { content: "", image: null as File | null },
    validationSchema: Yup.object({
      content: Yup.string().min(4, "Post too short").required("Content is required"),
    }),
    onSubmit: async (values, helpers) => {
      if (!user) return toast.error(locale === "ar" ? "يرجى تسجيل الدخول أولاً" : "Please login first");
      const ensured = await ensureProfile(user);
      if (ensured.error) return toast.error(ensured.error.message);

      let image_url: string | null = null;
      if (values.image) {
        setUploading(true);
        toast.info(locale === "ar" ? "جاري رفع الصورة..." : "Uploading image...", { toastId: "upload", autoClose: false });
        try {
          const compressed = await compressImage(values.image, 1200);
          const ext = "webp";
          const fileName = `${user.id}/post-${Date.now()}.${ext}`;
          const { error } = await supabase.storage
            .from("post-images")
            .upload(fileName, compressed, { upsert: true });
          if (error) {
            setUploading(false);
            toast.dismiss("upload");
            return toast.error(error.message);
          }
          const { data } = supabase.storage.from("post-images").getPublicUrl(fileName);
          image_url = data.publicUrl;
          toast.dismiss("upload");
        } catch (err) {
          setUploading(false);
          toast.dismiss("upload");
          return toast.error(locale === "ar" ? "فشلت معالجة الصورة" : "Failed to process image");
        }
        setUploading(false);
      }

      let prefixedContent = selectedTheme !== "default" ? `[T:${selectedTheme}]${values.content}` : values.content;
      if (parentId) prefixedContent = `[P:${parentId}]${prefixedContent}`;

      const { data, error } = await supabase
        .from("posts")
        .insert({ author_id: user.id, content: prefixedContent, image_url })
        .select("id,author_id,content,image_url,created_at,updated_at")
        .single();

      if (error) return toast.error(error.message);

      // Fireworks Effect
      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      toast.success(locale === "ar" ? "تم نشر المنشور بنجاح! 🎉" : "Post published! 🎉");
      const newPost: Post = {
        ...(data as Post),
        profiles: {
          full_name: profile?.full_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
          email: profile?.email ?? "",
          username: profile?.username ?? null,
          is_pro: profile?.is_pro ?? false,
        } as any,
        likes_count: 0,
        liked_by_me: false,
      };
      onCreated(newPost);
      helpers.resetForm();
      setPreviewUrl(null);
      onClose();
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0] ?? null;
    formik.setFieldValue("image", file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreviewUrl(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const removeImage = () => {
    formik.setFieldValue("image", null);
    setPreviewUrl(null);
  };

  const generateAIQuote = () => {
    const pools = {
      en: [
        // Growth & Resilience
        "The only way to do great work is to love what you do — and keep going even when it's hard. ✨",
        "Growth is not a destination; it's a direction you choose every single day. 🌱",
        "Every master was once a disaster. Keep building, keep believing. 💪",
        "Resilience is not about bouncing back — it's about bouncing forward. 🚀",
        "Your potential is unlimited. The only ceiling is the one you build in your mind. 💡",
        "Small consistent steps will always outrun rare heroic leaps. 🐾",
        "Don't count the days — make the days count. ⏳✨",
        "The secret of getting ahead is getting started. No matter how small. 🔥",
        // Wisdom & Mindset
        "Clarity is power. Know what you want, and the universe will conspire to give it to you. 🌌",
        "Your thoughts are the architects of your destiny — build wisely. 🏛️",
        "Wisdom is not knowing everything — it's knowing what truly matters. 🌿",
        "Be the energy you wish to attract. What you radiate, you receive. 🔮",
        "Silence is where the deepest ideas are born. Don't fear the quiet. 🌙",
        "The mind that opens to a new idea never returns to its original size. 🌀",
        // Creativity & Art
        "Inspiration exists, but it has to find you working. Don't wait — create. 🎨",
        "Creativity is intelligence having fun. Let your mind dance freely. 🎭",
        "Every blank page is a universe waiting to be born. 📖",
        "Art is not what you see, but what you make others see. 👁️",
        // Morning & Energy
        "This morning, you have 86,400 seconds — spend them like the treasure they are. ☀️",
        "Wake up with determination. Go to bed with satisfaction. 🌅",
        "Today is not just another day — it's a new chance to rewrite your story. 📝",
        // Success & Legacy
        "Success is not final, failure is not fatal — it's the courage to continue that counts. 🦅",
        "What you do today is the legacy you leave tomorrow. Make it meaningful. 🌍",
        "The world needs your light. Don't dim yourself to fit in. ⚡",
        "Not all those who wander are lost — some are just finding the extraordinary path. 🧭",
      ],
      ar: [
        // نمو وصمود
        "النجاح ليس النهاية، والفشل ليس قاتلاً — إنما الشجاعة لمواصلة الطريق هي ما يهم. 🦅",
        "لا تنتظر الفرصة المثالية، بل اصنع الفرصة من اللحظة الحالية! 🚀",
        "كل خبير كان يوماً مبتدئاً — استمر وستصل. 💪",
        "أعظم مجد لنا ليس في عدم السقوط أبداً، بل في النهوض كلما سقطنا. ✨",
        "الثبات على الصغير يفوق الانقطاع على الكبير — ابنِ عادة، تبنِ مجداً. 🌱",
        "إمكاناتك لا حدود لها — القيد الوحيد هو ما تصدقه عن نفسك. 💡",
        "لا تعد الأيام، بل اجعل الأيام تُعدّ. ⏳",
        "سر التقدم هو البدء — الآن، بأي خطوة، بأي حجم. 🔥",
        // حكمة وتأمل
        "الوضوح قوة — اعرف ما تريد، وسيتآمر الكون لمنحك إياه. 🌌",
        "أفكارك هي معمار مصيرك — ابنِ بحكمة وإتقان. 🏛️",
        "الحكمة ليست أن تعرف كل شيء، بل أن تعرف ما يستحق المعرفة. 🌿",
        "كن الطاقة التي تريد أن تجتذب — ما تشعّ به، يعود إليك. 🔮",
        "في الصمت تُولد أعمق الأفكار — لا تهرب من الهدوء. 🌙",
        "العقل الذي يتفتح على فكرة جديدة لا يعود لحجمه الأصلي أبداً. 🌀",
        // إبداع وفن
        "الإلهام موجود دائماً، لكنه يجب أن يجدك تعمل — لا تنتظر. 🎨",
        "الإبداع هو الذكاء حين يستمتع — دع عقلك يرقص بحرية. 🎭",
        "كل صفحة بيضاء هي كون ينتظر أن يُولد على يديك. 📖",
        // صباح وطاقة
        "هذا الصباح لديك ٨٦،٤٠٠ ثانية — أنفقها كالكنز الذي هي عليه. ☀️",
        "استيقظ بعزيمة، وانم بارتياح. 🌅",
        "اليوم ليس مجرد يوم آخر — إنه فرصة جديدة لإعادة كتابة قصتك. 📝",
        // نجاح وإرث
        "ما تفعله اليوم هو الإرث الذي تتركه غداً — اجعله ذا معنى. 🌍",
        "العالم يحتاج لنورك — لا تخفت لتناسب الآخرين. ⚡",
        "ليس كل من يتجول ضائعاً — بعضهم يجد الطريق الاستثنائي. 🧭",
        "اللحظة الوحيدة التي تملكها هي الآن — استثمرها بكل ما فيك. 💎",
      ],
    };

    const langPool = locale === "ar" ? pools.ar : pools.en;
    // Pick truly random, avoid repeating last one
    const lastQuote = formik.values.content;
    let filtered = langPool.filter(q => q !== lastQuote);
    if (filtered.length === 0) filtered = langPool;
    const random = filtered[Math.floor(Math.random() * filtered.length)];

    formik.setFieldValue("content", random);
    toast.success(
      locale === "ar" ? "تم توليد فكرة ملهِمة جديدة! 🪄" : "New AI inspiration generated! 🪄",
      { icon: <span>🤖</span> }
    );
  };


  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitAudioContext; // fallback
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast.error(locale === "ar" ? "متصفحك لا يدعم التعرف على الصوت" : "Speech recognition not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = locale === "ar" ? "ar-SA" : "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      toast.info(locale === "ar" ? "جاري الاستماع..." : "Listening...", { toastId: "voice", autoClose: false });
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      formik.setFieldValue("content", formik.values.content + " " + transcript);
      setIsListening(false);
      toast.dismiss("voice");
      toast.success(locale === "ar" ? "تم تحويل الصوت إلى نص!" : "Voice converted to text!");
    };

    recognition.onerror = (event: any) => {
      console.error(event.error);
      setIsListening(false);
      toast.dismiss("voice");
      toast.error(locale === "ar" ? "فشل التعرف على الصوت" : "Speech recognition failed");
    };

    recognition.onend = () => {
      setIsListening(false);
      toast.dismiss("voice");
    };

    recognition.start();
  };

  return (
    <Modal open={open} onClose={onClose} title={parentId ? t.flow.continue : t.modal.createPost}>
      {parentId && (
        <div className="mb-4 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold uppercase tracking-widest text-indigo-400">
           {t.flow.replyHint}
        </div>
      )}
      <form onSubmit={formik.handleSubmit} className="space-y-4">
        <div className="flex gap-3">
          <Avatar
            src={profile?.avatar_url}
            name={profile?.full_name ?? profile?.email}
            size={40}
          />
          <div className="flex-1">
            <p className="font-medium text-sm">
              {profile?.full_name || user?.email?.split("@")[0] || "You"}
            </p>
            <p className="text-muted text-xs">Sharing publicly</p>
          </div>
        </div>

        <div className={`rounded-xl transition-all duration-500 border border-[var(--border)] shadow-sm overflow-hidden ${selectedTheme !== "default" ? POST_THEMES.find(t => t.id === selectedTheme)?.class : "bg-transparent"}`}>
          <textarea
            name="content"
            rows={4}
            className="w-full bg-transparent p-4 outline-none text-sm leading-relaxed placeholder:text-muted/60 resize-none font-medium"
            placeholder={t.modal.postContent}
            value={formik.values.content}
            onChange={formik.handleChange}
          />
          {formik.errors.content && formik.touched.content && (
            <p className="px-4 pb-2 text-red-500 text-xs font-semibold">{formik.errors.content}</p>
          )}
        </div>

        {previewUrl && (
          <div className="relative rounded-xl overflow-hidden">
            <img src={previewUrl} alt="preview" className="w-full h-48 object-cover" />
            <button
              type="button"
              onClick={removeImage}
              className="absolute top-2 end-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
            >
              <FiX size={14} />
            </button>
          </div>
        )}

        <div>
          <label className="input-label mb-2">{locale === "ar" ? "اختر تيم ملهِم للمنشور" : "Select an inspiring theme"}</label>
          <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar pt-1">
            {POST_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => setSelectedTheme(theme.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all border-2 ${
                  selectedTheme === theme.id 
                    ? "border-[var(--brand-a)] scale-105 shadow-lg" 
                    : "border-transparent opacity-60 grayscale hover:grayscale-0 hover:opacity-100"
                } ${theme.class}`}
              >
                {theme.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn-ghost flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
              <FiImage size={16} />
              <span>{t.modal.postImg}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </label>

            {/* Voice Input Button */}
            <button
              type="button"
              onClick={handleVoiceInput}
              className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                isListening 
                  ? "bg-red-500 text-white animate-pulse" 
                  : "bg-white/10 text-[var(--foreground)] hover:bg-white/20"
              }`}
            >
              <FiMic size={16} className={isListening ? "animate-bounce" : ""} />
              <span className="hidden sm:inline">{locale === "ar" ? "تحدث" : "Speak"}</span>
            </button>

            {/* Magic Wand AI Button */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar max-w-[220px] sm:max-w-none">
            <button 
              type="button" 
              onClick={generateAIQuote}
              className="flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-2 text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:scale-[1.03] active:scale-[0.97] shadow-md shadow-purple-500/30 transition-all whitespace-nowrap"
            >
              <FiZap size={14} className="fill-white" />
              <span>{locale === "ar" ? "إلهام ذكي" : "AI Suggest"}</span>
            </button>
          </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost text-sm">
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={formik.isSubmitting || uploading}
              className="btn-primary text-sm min-w-[80px]"
            >
              {formik.isSubmitting || uploading ? t.loading : t.common.save}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
