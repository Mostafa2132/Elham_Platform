"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { FiExternalLink } from "react-icons/fi";
import { type Ad } from "@/types";

export function AdCard({ ad }: { ad: Ad }) {
  return (
    <motion.div
      className="glass overflow-hidden rounded-2xl"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={ad.link} target="_blank" rel="noopener noreferrer" className="block">
        <div className="relative h-40 w-full overflow-hidden">
          <Image
            src={ad.image_url}
            alt={ad.title ?? "Advertisement"}
            fill
            className="object-cover transition-transform duration-300 hover:scale-105"
            sizes="(max-width: 768px) 100vw, 400px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
        <div className="p-3 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className="ad-label">Sponsored</span>
            {ad.title && (
              <p className="mt-1 text-sm font-medium leading-snug truncate">{ad.title}</p>
            )}
          </div>
          <div className="btn-ghost flex items-center gap-1 text-xs shrink-0">
            Visit <FiExternalLink size={12} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function AdBanner({ ad }: { ad: Ad }) {
  return (
    <div className="relative my-4 overflow-hidden rounded-2xl border border-[var(--border)]">
      <span className="ad-label absolute left-2 top-2 z-10">Sponsored</span>
      <Link href={ad.link} target="_blank" rel="noopener noreferrer" className="block">
        <div className="relative h-32 w-full overflow-hidden">
          <Image
            src={ad.image_url}
            alt={ad.title ?? "Ad"}
            fill
            className="object-cover opacity-70 hover:opacity-90 transition-opacity"
            sizes="(max-width: 768px) 100vw, 720px"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent flex items-center px-5">
            {ad.title && <p className="text-white text-lg font-semibold max-w-xs">{ad.title}</p>}
          </div>
        </div>
      </Link>
    </div>
  );
}
