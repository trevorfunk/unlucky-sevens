import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function Button({ className, variant = "primary", type = "button", ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none";

  const variants = {
    primary: "bg-emerald-400 hover:bg-emerald-300 text-zinc-950 shadow-xl shadow-black/20",
    secondary: "bg-white/10 hover:bg-white/15 border border-white/10 text-white",
    ghost: "bg-transparent hover:bg-white/10 text-white",
    danger: "bg-rose-400 hover:bg-rose-300 text-zinc-950 shadow-xl shadow-black/20",
  };

  return <button type={type} className={cn(base, variants[variant], className)} {...props} />;
}

export function Panel({ className, ...props }) {
  return (
    <div
      className={cn(
        "rounded-3xl bg-white/6 border border-white/10 shadow-[0_18px_60px_rgba(0,0,0,0.35)]",
        className
      )}
      {...props}
    />
  );
}

export function Badge({ className, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-black/30 border border-white/10 px-3 py-1 text-xs text-white/85",
        className
      )}
      {...props}
    />
  );
}
