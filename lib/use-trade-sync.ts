"use client";

import { useEffect, useRef, useCallback } from "react";

interface SyncOptions<T> {
  trades: T[];
  setTrades: (trades: T[]) => void;
  saveTrades: (trades: T[]) => void;
}

/**
 * Syncs paper trades between localStorage and the database API.
 * On mount: loads from API (if enabled) and merges with localStorage.
 * On change: pushes updates to the API in the background.
 */
export function useTradeSync<T extends { id: string; createdAt: string }>({
  trades,
  setTrades,
  saveTrades,
}: SyncOptions<T>) {
  const dbEnabled = useRef(false);
  const lastSyncRef = useRef<string>("");

  // Initial load: fetch from DB and merge with localStorage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/trades");
        if (!res.ok) return;
        const data = await res.json();
        if (!data.enabled || cancelled) return;
        dbEnabled.current = true;

        if (data.trades?.length > 0) {
          setTrades((prev: T[]) => {
            const merged = new Map<string, T>();
            for (const t of data.trades) merged.set(t.id, t);
            for (const t of prev) merged.set(t.id, t);
            const result = Array.from(merged.values()).sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            saveTrades(result);
            return result;
          });
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push changes to DB whenever trades update
  const syncToDb = useCallback(async (trades: T[]) => {
    if (!dbEnabled.current || trades.length === 0) return;
    const key = JSON.stringify(trades.map((t) => t.id + (t as Record<string, unknown>).status));
    if (key === lastSyncRef.current) return;
    lastSyncRef.current = key;
    try {
      await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trades }),
      });
    } catch {}
  }, []);

  useEffect(() => {
    syncToDb(trades);
  }, [trades, syncToDb]);

  const resetDb = useCallback(async () => {
    if (!dbEnabled.current) return;
    try {
      await fetch("/api/trades", { method: "DELETE" });
    } catch {}
  }, []);

  return { dbEnabled: dbEnabled.current, resetDb };
}
