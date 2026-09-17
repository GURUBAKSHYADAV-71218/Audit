"use client";

import { motion } from "framer-motion";
import { scoreColor } from "@/lib/format";

export function ScoreRing({ score, size = 128 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const colorClass = scoreColor(score);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={9} className="stroke-border-subtle" fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={9}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          className={colorClass}
          stroke="currentColor"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.15 }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-3xl font-bold ${colorClass}`}>{score}</span>
        <span className="text-[10px] uppercase tracking-wide text-foreground/40">/ 100</span>
      </div>
    </div>
  );
}
