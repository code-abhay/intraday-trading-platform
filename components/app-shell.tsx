"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const AUTH_PATHS = ["/auth", "/login"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-60">
          <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div
        className={cn(
          "transition-all duration-300",
          collapsed ? "lg:ml-16" : "lg:ml-60"
        )}
      >
        {children}
      </div>
    </div>
  );
}
