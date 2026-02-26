import { cn } from "@/lib/utils";

type BiasType = "BULLISH" | "BEARISH" | "NEUTRAL" | string;

interface StatusBadgeProps {
  bias: BiasType;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function StatusBadge({ bias, size = "md", className }: StatusBadgeProps) {
  const normalized = bias.toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-3 py-1 text-sm",
        size === "lg" && "px-4 py-1.5 text-base",
        normalized === "BULLISH" && "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
        normalized === "BEARISH" && "bg-red-500/15 text-red-400 border border-red-500/20",
        normalized === "NEUTRAL" && "bg-amber-500/15 text-amber-400 border border-amber-500/20",
        !["BULLISH", "BEARISH", "NEUTRAL"].includes(normalized) && "bg-zinc-800 text-zinc-400 border border-zinc-700",
        className
      )}
    >
      <span className={cn(
        "size-1.5 rounded-full",
        normalized === "BULLISH" && "bg-emerald-400",
        normalized === "BEARISH" && "bg-red-400",
        normalized === "NEUTRAL" && "bg-amber-400",
      )} />
      {normalized}
    </span>
  );
}
