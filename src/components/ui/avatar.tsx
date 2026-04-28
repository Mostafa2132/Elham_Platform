"use client";

import Image from "next/image";
import { FiUser } from "react-icons/fi";

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}

export function Avatar({ src, name, size = 40, className = "" }: AvatarProps) {
  const initials = name
    ? name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : null;

  if (src) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden rounded-full ${className}`}
        style={{ width: size, height: size }}
      >
        <Image src={src} alt={name ?? "avatar"} fill className="object-cover" sizes={`${size}px`} />
      </div>
    );
  }

  return (
    <div
      className={`shrink-0 rounded-full brand-gradient flex items-center justify-center text-white font-semibold ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials ?? <FiUser size={size * 0.45} />}
    </div>
  );
}
