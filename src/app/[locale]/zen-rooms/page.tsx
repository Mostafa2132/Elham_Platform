"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiVolume2, FiVolumeX, FiPlay, FiPause, FiWind, FiCloudRain, FiSun, FiArrowLeft, FiHeart, FiShare2, FiMusic, FiUsers } from "react-icons/fi";
import { useRouter, useParams } from "next/navigation";
import { toast } from "react-toastify";
import { getSupabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";
import { translations } from "@/data/translations";
import { type Locale } from "@/types";

const AMBIANCES = [
  { id: "zen-forest", name: "Forest Silence", nameAr: "غابة الهدوء", icon: FiWind, color: "bg-emerald-500", glow: "shadow-emerald-500/20", accent: "emerald" },
  { id: "rainy-night", name: "Deep Rain", nameAr: "مطر عميق", icon: FiCloudRain, color: "bg-blue-500", glow: "shadow-blue-500/20", accent: "blue" },
  { id: "cosmic-dawn", name: "Cosmic Dawn", nameAr: "فجر كوني", icon: FiSun, color: "bg-indigo-500", glow: "shadow-indigo-500/20", accent: "indigo" },
];

const VOICE_CLIPS = [
  { id: "1", author: "Malek", title: "The Art of Letting Go", titleAr: "فن التخلي", duration: "1:24", color: "from-amber-400 to-orange-600" },
  { id: "2", author: "Sara", title: "Why Silence Matters", titleAr: "لماذا يهم الصمت", duration: "0:45", color: "from-indigo-400 to-purple-600" },
  { id: "3", author: "Youssef", title: "Morning Gratitude", titleAr: "امتنان الصباح", duration: "2:10", color: "from-emerald-400 to-teal-600" },
];

// ─── Web Audio Ambient Engine ─────────────────────────────────────────────────
function createForestAudio(ctx: AudioContext, gainNode: GainNode) {
  const nodes: AudioNode[] = [];
  // Wind-like pink noise via multiple oscillators
  for (let i = 0; i < 6; i++) {
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    const freq = 80 + Math.random() * 120;
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(freq + Math.random() * 40 - 20, ctx.currentTime + 4 + Math.random() * 4);
    oscGain.gain.setValueAtTime(0.015 + Math.random() * 0.02, ctx.currentTime);
    osc.connect(oscGain);
    oscGain.connect(gainNode);
    osc.start();
    nodes.push(osc, oscGain);
  }
  // Bird chirp LFO
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.3;
  lfoGain.gain.value = 30;
  lfo.connect(lfoGain);
  const birdOsc = ctx.createOscillator();
  const birdGain = ctx.createGain();
  birdOsc.type = "sine";
  birdOsc.frequency.value = 1200;
  lfoGain.connect(birdOsc.frequency);
  birdGain.gain.value = 0.01;
  birdOsc.connect(birdGain);
  birdGain.connect(gainNode);
  lfo.start(); birdOsc.start();
  nodes.push(lfo, lfoGain, birdOsc, birdGain);
  return nodes;
}

function createRainAudio(ctx: AudioContext, gainNode: GainNode) {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 800;
  filter.Q.value = 0.5;
  source.connect(filter);
  filter.connect(gainNode);
  source.start();
  // Thunder-like low rumble
  const rumble = ctx.createOscillator();
  const rumbleGain = ctx.createGain();
  rumble.type = "sine";
  rumble.frequency.value = 40;
  rumbleGain.gain.value = 0.04;
  rumble.connect(rumbleGain);
  rumbleGain.connect(gainNode);
  rumble.start();
  return [source, filter, rumble, rumbleGain];
}

function createCosmicAudio(ctx: AudioContext, gainNode: GainNode) {
  const nodes: AudioNode[] = [];
  const freqs = [110, 165, 220, 330, 440];
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = i % 2 === 0 ? "sine" : "triangle";
    osc.frequency.value = freq;
    oscGain.gain.value = 0.018;
    // Slow frequency drift
    osc.frequency.linearRampToValueAtTime(freq * 1.02, ctx.currentTime + 8);
    osc.frequency.linearRampToValueAtTime(freq, ctx.currentTime + 16);
    osc.connect(oscGain);
    oscGain.connect(gainNode);
    osc.start();
    nodes.push(osc, oscGain);
  });
  return nodes;
}

export default function ZenRoomsPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as Locale) || "en";
  const t = translations[locale];

  const { user } = useAuthStore();
  const targetId = user?.id || "anonymous";

  const [activeAmbiance, setActiveAmbiance] = useState(AMBIANCES[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [activeClip, setActiveClip] = useState<typeof VOICE_CLIPS[0] | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const audioNodesRef = useRef<AudioNode[]>([]);
  const [presentCount, setPresentCount] = useState(1);
  const [isSolo, setIsSolo] = useState(false);
  const supabase = getSupabase();

  // Presence logic
  useEffect(() => {
    if (isSolo) {
      setPresentCount(1);
      return;
    }

    const channel = supabase.channel(`zen-room-${activeAmbiance.id}`, {
      config: { presence: { key: targetId } }
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        setPresentCount(count);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        // Only notify if the joining user is NOT the current user
        const others = newPresences.filter((p: any) => p.key !== targetId);
        if (others.length > 0) {
          toast.info(locale === "ar" ? "انضم مبدع جديد للتأمل" : "A new creator joined the meditation", { icon: <span>🧘</span> });
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString(), key: targetId });
        }
      });

    return () => { channel.unsubscribe(); };
  }, [activeAmbiance.id, supabase, targetId, locale, isSolo]);

  const stopAudio = useCallback(() => {
    audioNodesRef.current.forEach(n => {
      try { (n as OscillatorNode).stop?.(); } catch {}
      try { n.disconnect(); } catch {}
    });
    audioNodesRef.current = [];
  }, []);

  const startAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();

    // Master gain
    const masterGain = ctx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(ctx.destination);
    gainRef.current = masterGain;

    let nodes: AudioNode[] = [];
    if (activeAmbiance.id === "zen-forest") nodes = createForestAudio(ctx, masterGain);
    else if (activeAmbiance.id === "rainy-night") nodes = createRainAudio(ctx, masterGain);
    else nodes = createCosmicAudio(ctx, masterGain);

    audioNodesRef.current = [masterGain, ...nodes];
  }, [activeAmbiance, volume]);

  const togglePlay = () => {
    if (isPlaying) {
      stopAudio();
      setIsPlaying(false);
    } else {
      startAudio();
      setIsPlaying(true);
    }
  };

  // Update volume live
  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.setTargetAtTime(volume, audioCtxRef.current!.currentTime, 0.1);
  }, [volume]);

  // Switch ambiance restarts audio
  useEffect(() => {
    if (isPlaying) {
      stopAudio();
      setTimeout(() => startAudio(), 50);
    }
  }, [activeAmbiance.id]); // eslint-disable-line

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio();
      audioCtxRef.current?.close();
    };
  }, [stopAudio]);

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white overflow-hidden flex flex-col font-sans select-none">
      {/* Background Ambience Simulation */}
      <div className="absolute inset-0 z-0">
        <div className={`absolute inset-0 bg-gradient-to-br transition-all duration-1000 ${
          activeAmbiance.id === "zen-forest" ? "from-emerald-900/20 via-black to-black" :
          activeAmbiance.id === "rainy-night" ? "from-blue-900/20 via-black to-black" :
          "from-indigo-900/20 via-black to-black"
        }`} />
        
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className={`w-[600px] h-[600px] rounded-full blur-[120px] transition-colors duration-1000 ${
              activeAmbiance.id === "zen-forest" ? "bg-emerald-500/20" :
              activeAmbiance.id === "rainy-night" ? "bg-blue-500/20" :
              "bg-indigo-500/20"
            }`}
          />
        </div>

        {/* Particles — use fixed values, no window.innerWidth */}
        <div className="absolute inset-0">
          {Array.from({ length: 16 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0, x: `${(i * 6.25) % 100}vw`, y: `${(i * 7.3) % 100}vh` }}
              animate={{
                opacity: [0, 0.4, 0],
                scale: [0, 1, 0],
                x: [`${(i * 6.25) % 100}vw`, `${((i + 5) * 7.1) % 100}vw`],
                y: [`${(i * 7.3) % 100}vh`, `${((i + 3) * 9.2) % 100}vh`],
              }}
              transition={{ duration: 10 + (i % 5) * 2, repeat: Infinity, delay: i * 0.4 }}
              className="absolute w-1 h-1 bg-white rounded-full blur-sm"
            />
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="relative z-20 p-6 flex items-center justify-between backdrop-blur-md bg-black/20 border-b border-white/5">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-all group"
        >
          <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em]">
            {locale === "ar" ? "العودة للعالم" : "Return to Earth"}
          </span>
        </button>

        <div className="flex items-center gap-6">
          {/* Privacy Toggle */}
          <button
            onClick={() => setIsSolo(!isSolo)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
              isSolo 
                ? "bg-amber-500/10 border-amber-500/20 text-amber-500" 
                : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${isSolo ? "bg-amber-500" : "bg-indigo-400"}`} />
            <span className="text-[9px] font-black uppercase tracking-widest">
              {isSolo ? (locale === "ar" ? "وضع انفرادي" : "Solo Mode") : (locale === "ar" ? "وضع اجتماعي" : "Social Mode")}
            </span>
          </button>

          <div className="h-4 w-[1px] bg-white/10" />

          {!isSolo && (
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ opacity: isPlaying ? [1, 0.4, 1] : 1 }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className={`w-2 h-2 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)] ${isPlaying ? "bg-emerald-500" : "bg-white/20"}`}
              />
              <span className="text-[10px] font-black uppercase tracking-[0.6em] text-white/40">
                {isPlaying ? (locale === "ar" ? "غرفة الزن نشطة" : "Zen Room Active") : (locale === "ar" ? "في الانتظار" : "Standby")}
              </span>
            </div>
          )}

          {!isSolo && (
            <>
              <div className="h-4 w-[1px] bg-white/10" />
              <div className="flex items-center gap-2 text-indigo-400">
                <FiUsers size={12} />
                <span className="text-[10px] font-black uppercase tracking-widest tabular-nums">
                  {presentCount} {locale === "ar" ? "مبدعون هنا" : "Creators Here"}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="w-24" />
      </div>

      {/* Main Experience Area */}
      <div className="relative z-10 flex-1 flex flex-col md:flex-row p-6 md:p-12 gap-12 overflow-hidden">
        {/* Left Side: Voice Pods */}
        <div className="flex-1 flex flex-col justify-center space-y-8 h-full">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-6xl font-serif italic text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">
              {locale === "ar" ? "همسات الحكمة" : "Whispers of Wisdom"}
            </h1>
            <p className="text-white/40 text-xs font-bold uppercase tracking-[0.4em]">
              {locale === "ar" ? "استمع لروح إلهام" : "Listen to the soul of Elham"}
            </p>
          </div>

          <div className="grid gap-4 max-w-lg">
            {VOICE_CLIPS.map(clip => (
              <motion.button
                key={clip.id}
                whileHover={{ x: 8 }}
                onClick={() => {
                  setActiveClip(clip);
                  if (!isPlaying) togglePlay();
                }}
                className={`group p-5 rounded-3xl border transition-all flex items-center justify-between ${
                  activeClip?.id === clip.id
                    ? "bg-white/10 border-white/20 shadow-2xl"
                    : "bg-white/5 border-white/5 hover:border-white/10"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${clip.color} flex items-center justify-center shadow-lg`}>
                    {activeClip?.id === clip.id && isPlaying
                      ? <FiPause className="text-white fill-current" />
                      : <FiPlay className="text-white fill-current ml-0.5" />
                    }
                  </div>
                  <div className="text-start">
                    <p className="font-bold text-sm tracking-tight">
                      {locale === "ar" ? clip.titleAr : clip.title}
                    </p>
                    <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mt-0.5">
                      {locale === "ar" ? "بقلم" : "By"} {clip.author}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] font-black text-white/20 tabular-nums">{clip.duration}</span>
                  {activeClip?.id === clip.id && isPlaying && (
                    <div className="flex gap-0.5 items-end h-4">
                      {[3, 5, 4, 6, 3].map((h, i) => (
                        <motion.div
                          key={i}
                          animate={{ height: [`${h}px`, `${h * 2.5}px`, `${h}px`] }}
                          transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                          className="w-1 bg-emerald-400 rounded-full"
                          style={{ height: `${h}px` }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Right Side: Active Player & Visualizer */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="relative w-full aspect-square max-w-[380px] flex items-center justify-center">
            {/* Orbital Rings */}
            <div className="absolute inset-0 border border-white/5 rounded-full" style={{ animation: "spin 30s linear infinite" }} />
            <div className="absolute inset-8 border border-white/10 rounded-full" style={{ animation: "spin 45s linear infinite reverse" }} />

            {/* Visualizer Circles */}
            <AnimatePresence>
              {isPlaying && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
                      transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }}
                      className={`absolute inset-0 border rounded-full ${
                        activeAmbiance.id === "zen-forest" ? "border-emerald-500/30" :
                        activeAmbiance.id === "rainy-night" ? "border-blue-500/30" :
                        "border-indigo-500/30"
                      }`}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Center Pod */}
            <div className="relative z-10 w-48 h-48 rounded-full bg-black border border-white/10 flex flex-col items-center justify-center shadow-2xl backdrop-blur-3xl overflow-hidden">
              <div className={`absolute inset-0 opacity-20 bg-gradient-to-br ${activeClip?.color || "from-gray-800 to-gray-900"}`} />

              <motion.button
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                onClick={togglePlay}
                className="relative z-10 w-20 h-20 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all border border-white/20"
              >
                {isPlaying
                  ? <FiPause size={32} />
                  : <FiPlay size={32} className="ml-1" />
                }
              </motion.button>

              {isPlaying && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative z-10 mt-2 text-[9px] font-black uppercase tracking-widest text-white/30"
                >
                  {locale === "ar" ? "جاري التشغيل" : "Now Playing"}
                </motion.p>
              )}
            </div>
          </div>

          {/* Ambiance Toggles */}
          <div className="mt-12 flex items-center gap-4 p-4 rounded-3xl bg-white/5 border border-white/5 backdrop-blur-md">
            {AMBIANCES.map(amb => (
              <button
                key={amb.id}
                onClick={() => setActiveAmbiance(amb)}
                className={`p-4 rounded-2xl transition-all flex flex-col items-center gap-2 ${
                  activeAmbiance.id === amb.id
                    ? `${amb.color} text-white shadow-2xl ${amb.glow} scale-110`
                    : "hover:bg-white/5 text-white/40"
                }`}
                title={locale === "ar" ? amb.nameAr : amb.name}
              >
                <amb.icon size={20} />
                <span className="text-[8px] font-black uppercase tracking-widest">
                  {locale === "ar" ? amb.nameAr : amb.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="relative z-20 p-6 flex items-center justify-between border-t border-white/5 bg-black/40 backdrop-blur-3xl px-10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setVolume(v => v === 0 ? 0.5 : 0)}>
              {volume === 0 ? <FiVolumeX className="text-white/40" /> : <FiVolume2 className="text-white/60" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-28 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
            />
          </div>
          <div className="flex items-center gap-2 text-white/30 text-[10px] font-bold uppercase tracking-widest">
            <FiMusic size={12} />
            <span>{locale === "ar" ? "صوت إجرائي" : "Generative Audio"}</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button className="flex items-center gap-2 text-white/40 hover:text-pink-400 transition-colors">
            <FiHeart />
            <span className="text-[10px] font-black uppercase tracking-widest">
              {locale === "ar" ? "ربط الروح" : "Connect Soul"}
            </span>
          </button>
          <button className="flex items-center gap-2 text-white/40 hover:text-indigo-400 transition-colors">
            <FiShare2 />
            <span className="text-[10px] font-black uppercase tracking-widest">
              {locale === "ar" ? "دعوة الآخرين" : "Invoke Others"}
            </span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
