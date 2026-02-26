import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function StatCard({ label, value, subValue, icon: Icon, trend, className }: StatCardProps) {
  return (
    <div className={cn(
      "rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-sm",
      className
    )}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</p>
        {Icon && (
          <div className="rounded-lg bg-zinc-800/80 p-1.5">
            <Icon className="size-3.5 text-zinc-400" />
          </div>
        )}
      </div>
      <p className="mt-2 text-xl font-bold text-zinc-100 tabular-nums">{value}</p>
      {subValue && (
        <p className={cn(
          "mt-1 text-xs font-medium",
          trend === "up" && "text-emerald-400",
          trend === "down" && "text-red-400",
          trend === "neutral" && "text-zinc-400",
          !trend && "text-zinc-500"
        )}>
          {trend === "up" && "↑ "}{trend === "down" && "↓ "}{subValue}
        </p>
      )}
    </div>
  );
}
