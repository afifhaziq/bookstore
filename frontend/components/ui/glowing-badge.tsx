"use client";

import { type HTMLAttributes } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export type GlowingBadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral"
  | "deposit"
  | "paid"
  | "bought";

const variantStyles: Record<
  GlowingBadgeVariant,
  { badge: string; glow: string; dot: string }
> = {
  default: { badge: "bg-foreground text-background", glow: "bg-foreground/30", dot: "bg-background" },
  neutral: { badge: "bg-muted text-muted-foreground", glow: "bg-foreground/30", dot: "bg-foreground" },
  success: { badge: "bg-emerald-500 text-emerald-100", glow: "bg-emerald-500", dot: "bg-emerald-200" },
  warning: { badge: "bg-amber-500 text-amber-100", glow: "bg-amber-500", dot: "bg-amber-200" },
  error: { badge: "bg-red-500 text-red-100", glow: "bg-red-500", dot: "bg-red-200" },
  info: { badge: "bg-blue-500 text-blue-100", glow: "bg-blue-500", dot: "bg-blue-200" },
  deposit: { badge: "bg-yellow-500 text-yellow-100", glow: "bg-yellow-500", dot: "bg-yellow-200" },
  paid: { badge: "bg-blue-500 text-blue-100", glow: "bg-blue-500", dot: "bg-blue-200" },
  bought: { badge: "bg-purple-500 text-purple-100", glow: "bg-purple-500", dot: "bg-purple-200" },
};

interface GlowingBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: GlowingBadgeVariant;
}

export function GlowingBadge({
  variant = "default",
  className,
  children,
  ...props
}: GlowingBadgeProps) {
  const styles = variantStyles[variant];
  return (
    <span
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles.badge,
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "absolute inset-0 -z-10 rounded-full opacity-40 blur-sm",
          styles.glow
        )}
      />
      <motion.span
        className={cn("size-1.5 shrink-0 rounded-full", styles.dot)}
        animate={{ scale: [1, 1.5, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      {children}
    </span>
  );
}
