"use client";

import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, type PanInfo } from "framer-motion";
import { FiGitBranch, FiMaximize2, FiMinimize2, FiInfo, FiZap, FiChevronDown, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { type Post, type Locale } from "@/types";
import { Avatar } from "@/components/ui/avatar";

interface TreeNode {
  post: Post;
  children: TreeNode[];
  level: number;
  x: number;
  y: number;
}

interface WisdomTreeProps {
  posts: Post[];
  locale: Locale;
}

export function WisdomTree({ posts, locale }: WisdomTreeProps) {
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Rotation values
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  
  // Smooth springs for rotation
  const springX = useSpring(rotateX, { stiffness: 100, damping: 30 });
  const springY = useSpring(rotateY, { stiffness: 100, damping: 30 });

  // Build the tree hierarchy from flat posts
  const treeData = useMemo(() => {
    const postMap = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    // Initialize nodes
    posts.forEach(p => {
      postMap.set(p.id, { post: p, children: [], level: 0, x: 0, y: 0 });
    });

    // Build connections
    posts.forEach(p => {
      const node = postMap.get(p.id)!;
      const parentMatch = p.content.match(/\[P:([\w-]+)\]/);
      
      if (parentMatch && postMap.has(parentMatch[1])) {
        const parent = postMap.get(parentMatch[1])!;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Calculate layout (Positions)
    const calculatePositions = (nodes: TreeNode[], level = 0, startX = 0): number => {
      let currentX = startX;
      nodes.forEach((node) => {
        node.level = level;
        node.y = level * 180; // Vertical spacing
        
        if (node.children.length > 0) {
          const width = calculatePositions(node.children, level + 1, currentX);
          node.x = currentX + width / 2;
          currentX += width + 100; // Horizontal spacing
        } else {
          node.x = currentX;
          currentX += 150;
        }
      });
      return currentX - startX;
    };

    calculatePositions(roots);
    return { roots, allNodes: Array.from(postMap.values()) };
  }, [posts]);

  // Handle drag to rotate
  const handleDrag = (_: unknown, info: PanInfo) => {
    rotateY.set(rotateY.get() + info.delta.x * 0.5);
    rotateX.set(rotateX.get() - info.delta.y * 0.5);
  };

  // Handle reset
  const resetTree = () => {
    rotateX.set(0);
    rotateY.set(0);
    setZoom(1);
  };

  // Directional movement
  const move = (dir: "up" | "down" | "left" | "right") => {
    const step = 20;
    if (dir === "up") rotateX.set(rotateX.get() + step);
    if (dir === "down") rotateX.set(rotateX.get() - step);
    if (dir === "left") rotateY.set(rotateY.get() - step);
    if (dir === "right") rotateY.set(rotateY.get() + step);
  };

  return (
    <div className="relative w-full h-[650px] bg-[#050505] rounded-3xl overflow-hidden cursor-grab active:cursor-grabbing perspective-1000 border border-white/5 shadow-2xl group/tree">
      {/* Cosmic Environment */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-black to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.05),transparent_70%)]" />
      </div>

      {/* Primary Controls (Top Right) */}
      <div className="absolute top-6 right-6 z-30 flex flex-col gap-2">
        <button 
          onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.min(prev + 0.2, 2)); }}
          className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 transition-all backdrop-blur-md"
          title="Zoom In"
        >
          <FiMaximize2 size={16} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.max(prev - 0.2, 0.5)); }}
          className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 transition-all backdrop-blur-md"
          title="Zoom Out"
        >
          <FiMinimize2 size={16} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); resetTree(); }}
          className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400 transition-all backdrop-blur-md"
          title="Reset View"
        >
          <FiZap size={16} />
        </button>
      </div>

      {/* Precision D-Pad (Bottom Right) */}
      <div className="absolute bottom-6 right-6 z-30 flex flex-col items-center gap-1 opacity-0 group-hover/tree:opacity-100 transition-opacity">
         <button onClick={() => move("up")} className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/40"><FiChevronDown className="rotate-180" /></button>
         <div className="flex gap-1">
            <button onClick={() => move("left")} className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/40"><FiChevronLeft /></button>
            <button onClick={() => move("right")} className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/40"><FiChevronRight /></button>
         </div>
         <button onClick={() => move("down")} className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/40"><FiChevronDown /></button>
      </div>

      <div className="absolute top-6 left-8 z-30 flex items-center gap-3">
         <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
         <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/40">
            {locale === "ar" ? "شجرة المعرفة الحية" : "Living Wisdom Tree"}
         </span>
      </div>

      {/* Legend / Guide */}
      <div className="absolute bottom-6 left-8 z-30 flex flex-col gap-2">
         <div className="flex items-center gap-3 text-white/20">
            <FiGitBranch size={14} />
            <span className="text-[9px] font-bold uppercase tracking-[0.3em]">
               {locale === "ar" ? "اسحب للتدوير الحر" : "Drag for Free Rotation"}
            </span>
         </div>
         <div className="flex items-center gap-3 text-white/20">
            <FiZap size={14} className="text-indigo-500/40" />
            <span className="text-[9px] font-bold uppercase tracking-[0.3em]">
               {locale === "ar" ? "اضغط على الأيقونة للتحريك الدقيق" : "Use D-Pad for Precision"}
            </span>
         </div>
      </div>

      {/* 3D Scene */}
      <motion.div
        drag
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0}
        onDrag={handleDrag}
        className="w-full h-full flex items-center justify-center pointer-events-auto"
        style={{ transformStyle: "preserve-3d" }}
      >
        <motion.div
          animate={{
            rotateY: [rotateY.get(), rotateY.get() + 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{
            rotateX: springX,
            rotateY: springY,
            scale: zoom,
            transformStyle: "preserve-3d",
          }}
          className="relative w-full h-full flex items-center justify-center"
        >
          {/* Glowing Branches */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-0">
            <defs>
              <linearGradient id="branchGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(99,102,241,0.1)" />
                <stop offset="50%" stopColor="rgba(99,102,241,0.5)" />
                <stop offset="100%" stopColor="rgba(168,85,247,0.1)" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {treeData.allNodes.map(node => 
              node.children.map(child => (
                <motion.path
                  key={`${node.post.id}-${child.post.id}`}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.4 }}
                  transition={{ duration: 2, delay: node.level * 0.5 }}
                  d={`M ${node.x} ${node.y} C ${node.x} ${node.y + 120}, ${child.x} ${child.y - 120}, ${child.x} ${child.y}`}
                  stroke="url(#branchGrad)"
                  strokeWidth="3"
                  fill="none"
                  filter="url(#glow)"
                  style={{ 
                    transform: `translate(calc(50% - ${node.x}px), calc(50% - ${node.y}px))`,
                  }}
                />
              ))
            )}
          </svg>

          {/* Holographic Leaves */}
          {treeData.allNodes.map((node) => (
            <motion.div
              key={node.post.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: node.level * 0.2 }}
              whileHover={{ scale: 1.2, z: 100 }}
              className="absolute z-10"
              style={{
                left: `calc(50% + ${node.x - 350}px)`,
                top: `calc(50% + ${node.y - 200}px)`,
                transformStyle: "preserve-3d",
              }}
            >
              <div className="group relative">
                <div className="absolute -inset-4 bg-indigo-500/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
                
                {/* Node Orb */}
                <div className="relative h-28 w-28 flex flex-col items-center justify-center p-4 rounded-full border border-white/20 bg-white/5 backdrop-blur-2xl shadow-[0_0_30px_rgba(99,102,241,0.1)] hover:shadow-[0_0_50px_rgba(99,102,241,0.3)] transition-all overflow-hidden group/orb">
                   <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-white/5 to-purple-500/10 opacity-40" />
                   
                   <div className="relative z-10 scale-90 group-hover/orb:scale-100 transition-transform">
                      <Avatar src={node.post.profiles?.avatar_url} size={32} />
                   </div>

                   <p className="relative z-10 text-[7px] line-clamp-2 text-white/60 text-center mt-2 px-1 font-serif italic">
                      {node.post.content.replace(/\[[TP]:[\w-]+\]/g, "").trim()}
                   </p>

                   {/* Orbital Ring */}
                   <div className="absolute inset-0 border border-white/5 rounded-full scale-110 group-hover:scale-125 transition-transform duration-1000 animate-spin-slow" />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Star Particles */}
      <div className="absolute inset-0 pointer-events-none">
         {[...Array(20)].map((_, i) => (
            <motion.div
               key={i}
               animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.1, 0.4, 0.1],
               }}
               transition={{
                  duration: 2 + (i % 5),
                  repeat: Infinity,
                  ease: "easeInOut"
               }}
               className="absolute h-[1px] w-[1px] bg-white rounded-full shadow-[0_0_5px_white]"
               style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
               }}
            />
         ))}
      </div>

      <style jsx global>{`
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

<style jsx>{`
  .perspective-1000 {
    perspective: 1000px;
  }
`}</style>
