"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  FlaskConical,
  LayoutDashboard,
  LineChart,
  Link2,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/intraday-sheet", label: "Intraday Sheet", icon: Activity },
  { href: "/nifty-50", label: "Nifty 50", icon: BarChart3 },
  { href: "/strategy-lab", label: "Strategy Lab", icon: FlaskConical },
  { href: "/paper-trade", label: "Paper Trade", icon: LineChart },
  { href: "/login", label: "Angel One", icon: Link2 },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch("/api/angel-one/logout", { method: "POST" }).catch(() => {});
    await fetch("/api/auth", { method: "DELETE" }).catch(() => {});
    window.location.href = "/auth";
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-zinc-800 bg-zinc-900/95 backdrop-blur-sm transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex h-14 items-center border-b border-zinc-800 px-4",
        collapsed ? "justify-center" : "gap-3"
      )}>
        <div className="flex items-center justify-center size-8 rounded-lg bg-emerald-500/15 border border-emerald-500/20 shrink-0">
          <Activity className="size-4 text-emerald-400" />
        </div>
        {!collapsed && (
          <span className="text-base font-bold text-zinc-100 whitespace-nowrap">
            Intraday Pro
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                collapsed && "justify-center px-2",
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-400"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="size-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-zinc-800 p-2 space-y-1">
        <button
          onClick={handleLogout}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition-all hover:bg-zinc-800 hover:text-zinc-200",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut className="size-4 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>

        <Button
          variant="ghost"
          size="icon"
          className={cn("w-full", collapsed ? "justify-center" : "")}
          onClick={onToggle}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}
