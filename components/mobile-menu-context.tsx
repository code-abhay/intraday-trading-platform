"use client";

import { createContext, useContext } from "react";

interface MobileMenuContextValue {
  openMobileMenu: () => void;
  closeMobileMenu: () => void;
  toggleMobileMenu: () => void;
}

const MobileMenuContext = createContext<MobileMenuContextValue | null>(null);

interface MobileMenuProviderProps {
  value: MobileMenuContextValue;
  children: React.ReactNode;
}

export function MobileMenuProvider({ value, children }: MobileMenuProviderProps) {
  return <MobileMenuContext.Provider value={value}>{children}</MobileMenuContext.Provider>;
}

export function useMobileMenu(): MobileMenuContextValue | null {
  return useContext(MobileMenuContext);
}
