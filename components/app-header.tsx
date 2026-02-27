"use client";

import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMobileMenu } from "@/components/mobile-menu-context";

interface AppHeaderProps {
  onMobileMenuOpen?: () => void;
  children?: React.ReactNode;
}

export function AppHeader({ onMobileMenuOpen, children }: AppHeaderProps) {
  const mobileMenu = useMobileMenu();

  const handleMobileMenuOpen = () => {
    if (onMobileMenuOpen) {
      onMobileMenuOpen();
      return;
    }
    mobileMenu?.openMobileMenu();
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={handleMobileMenuOpen}
      >
        <Menu className="size-5" />
      </Button>
      {children}
    </header>
  );
}

interface SegmentSelectorProps {
  segments: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}

export function SegmentSelector({ segments, active, onChange }: SegmentSelectorProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-zinc-800/50 p-1">
      {segments.map((seg) => (
        <button
          key={seg.id}
          onClick={() => onChange(seg.id)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
            active === seg.id
              ? "bg-zinc-900 text-zinc-100 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          {seg.label}
        </button>
      ))}
    </div>
  );
}
