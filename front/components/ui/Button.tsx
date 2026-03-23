import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  children: ReactNode;
};

const variantMap: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-sky-600 to-sky-700 text-white hover:from-sky-500 hover:to-sky-600 disabled:from-sky-300 disabled:to-sky-300 dark:from-sky-500 dark:to-sky-600 dark:hover:from-sky-400 dark:hover:to-sky-500",
  secondary:
    "bg-gradient-to-b from-slate-900 to-slate-800 text-white hover:from-slate-800 hover:to-slate-700 dark:from-slate-100 dark:to-slate-200 dark:text-slate-900 dark:hover:from-white dark:hover:to-slate-200",
  ghost:
    "border border-slate-300 bg-white/70 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:bg-slate-800",
};

const sizeMap: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-sm",
};

export default function Button({
  variant = "primary",
  size = "md",
  block = false,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`rounded-xl font-semibold tracking-[0.01em] shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-slate-900 ${sizeMap[size]} ${variantMap[variant]} ${block ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
