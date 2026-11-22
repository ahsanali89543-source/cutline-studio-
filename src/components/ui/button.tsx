import { cn } from "@/lib/cn";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

export const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      tone: {
        primary:
          "bg-brand text-white shadow-[0_8px_30px_-8px_rgba(139,92,246,0.7)] hover:brightness-110 hover:shadow-[0_10px_36px_-6px_rgba(59,130,246,0.75)]",
        hot: "bg-brand-hot text-white shadow-[0_8px_30px_-8px_rgba(236,72,153,0.7)] hover:brightness-110",
        quiet: "bg-surface-2 text-fg hover:bg-surface-3",
        ghost: "bg-transparent text-fg hover:bg-white/5",
        line: "border border-line bg-white/[0.02] text-fg hover:border-accent/60 hover:bg-white/[0.05]",
        white: "bg-white text-[#0b0b14] hover:bg-white/90",
      },
      size: {
        xs: "h-8 px-2.5 text-xs",
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: { tone: "quiet", size: "sm" },
  },
);

export function Button({
  className,
  tone,
  size,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>) {
  return <button type={type} className={cn(buttonStyles({ tone, size }), className)} {...props} />;
}
