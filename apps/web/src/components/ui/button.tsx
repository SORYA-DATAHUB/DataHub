"use client";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover shadow-card",
  secondary: "bg-surface2 text-fg hover:bg-line",
  outline: "border border-line bg-surface text-fg hover:bg-surface2",
  ghost: "text-muted hover:bg-surface2 hover:text-fg",
  danger: "bg-danger text-white hover:opacity-90"
};
const sizes: Record<Size, string> = { sm: "h-8 px-3 text-xs", md: "h-9 px-4 text-sm", lg: "h-11 px-6 text-base", icon: "h-9 w-9" };

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn("inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50", variants[variant], sizes[size], extra);
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean; href?: string; children?: ReactNode };
export function Button({ variant = "primary", size = "md", loading, href, className, children, disabled, ...rest }: Props) {
  const cls = buttonClass(variant, size, className);
  if (href && !disabled) return <Link href={href} className={cls}>{children}</Link>;
  return (
    <button className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Loader2 className="animate-spin" size={14} aria-hidden />}
      {children}
    </button>
  );
}
