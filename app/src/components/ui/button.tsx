import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";

// Niural button family: primary (#714DFF), secondary (gray fill, purple text),
// outline, destructive (red outline), ghost and link. 8px radius, 36px controls.
export type ButtonVariant = "primary" | "secondary" | "outline" | "destructive" | "ghost" | "link";
type Size = "sm" | "md";

const base = "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-normal transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer";
const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-strong rounded-[8px]",
  secondary: "bg-fill border border-line text-primary-strong hover:bg-segment rounded-[8px]",
  outline: "bg-surface border border-line text-ink hover:bg-fill rounded-[8px]",
  destructive: "bg-surface border border-danger text-danger-text hover:bg-danger-soft rounded-[8px]",
  ghost: "text-ink hover:bg-fill rounded-[8px]",
  link: "text-primary hover:text-primary-strong underline-offset-4 hover:underline",
};
const sizes: Record<Size, string> = { sm: "h-8 px-3 text-[13px]", md: "h-9 px-3.5 text-sm" };

export function buttonClass(variant: ButtonVariant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${variant === "link" ? "text-sm" : sizes[size]} ${extra}`;
}

export function Button({
  variant = "primary",
  size = "md",
  pending,
  pendingLabel,
  children,
  className = "",
  ...rest
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: Size; pending?: boolean; pendingLabel?: string; children: ReactNode }) {
  return (
    <button {...rest} disabled={rest.disabled || pending} aria-busy={pending || undefined} className={buttonClass(variant, size, className)}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

export function ButtonLink({ href, variant = "primary", size = "md", className = "", children, ...rest }: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: Size }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
