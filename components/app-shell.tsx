"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const AUTH_PATHS = ["/auth", "/login"];

function Footer() {
  return (
    <footer className="border-t border-zinc-800/60 bg-zinc-950 px-6 py-5">
      <div className="max-w-7xl mx-auto flex flex-col items-center gap-3 text-xs text-zinc-500 text-center">
        <p>&copy; {new Date().getFullYear()} Abhay Kumar. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <a href="mailto:abhayk2193@gmail.com" className="hover:text-zinc-300 transition-colors">
            abhayk2193@gmail.com
          </a>
          <span className="text-zinc-700">|</span>
          <a href="tel:+919028216523" className="hover:text-zinc-300 transition-colors">
            +91 90282 16523
          </a>
          <span className="text-zinc-700">|</span>
          <a
            href="https://www.linkedin.com/in/abhayk21/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-zinc-300 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (isAuthPage) {
    return (
      <div className="min-h-screen flex flex-col bg-zinc-950">
        <main className="flex-1 flex flex-col">{children}</main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      <div className="flex-1 flex">
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
            "flex-1 flex flex-col transition-all duration-300",
            collapsed ? "lg:ml-16" : "lg:ml-60"
          )}
        >
          <div className="flex-1">{children}</div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
