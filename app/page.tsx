"use client";

import { useEffect, useState } from "react";

interface Signal {
  bias: string;
  entry?: number;
  stopLoss?: number;
  target?: number;
  confidence: number;
  pcr: { value: number; bias: string; callOI: number; putOI: number };
  maxPain: number;
  summary: string;
}

interface SignalsResponse {
  source?: "angel_one" | "nse" | "demo";
  symbol: string;
  underlyingValue: number;
  signal: Signal;
  maxPain: { strike: number; totalPayout: number }[];
  timestamp: string;
}

export default function Home() {
  const [data, setData] = useState<SignalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSignals = async () => {
    try {
      setError(null);
      const res = await fetch("/api/signals?symbol=NIFTY");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || err.error || `HTTP ${res.status}`);
      }
      const json: SignalsResponse = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Navigation */}
      <nav className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-6">
            <a href="/" className="font-semibold text-emerald-400">
              Dashboard
            </a>
            <a href="/login" className="text-zinc-400 hover:text-zinc-200">
              Angel One Login
            </a>
          </div>
          <LogoutButton />
        </div>
      </nav>

      <main className="p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-emerald-400">
            Intraday Trading Platform
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            NIFTY OI analytics • Polling every 30s
            {data?.source && (
              <span className="ml-2 text-emerald-600/80">
                • {data.source === "angel_one" ? "Angel One" : data.source === "nse" ? "NSE" : "Demo"}
              </span>
            )}
          </p>
        </header>

        {error && !data && (
          <div className="mb-6 rounded-lg bg-red-950/50 border border-red-800 p-4 text-red-300">
            <strong>Data Error:</strong> {error}
            <span className="text-zinc-500 text-sm block mt-1">
              Login at /login during market hours (9:15 AM - 3:30 PM IST) for Angel One data. NSE may be blocked from server.
            </span>
            <button
              onClick={() => { setLoading(true); fetchSignals(); }}
              className="mt-2 text-sm underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Dashboard - always visible, with placeholders when no data */}
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card
              title="Underlying"
              value={data ? data.underlyingValue.toFixed(2) : (loading ? "..." : "—")}
            />
            <Card
              title="PCR"
              value={data ? data.signal.pcr.value.toFixed(2) : (loading ? "..." : "—")}
              sub={data?.signal.pcr.bias}
            />
            <Card
              title="Max Pain"
              value={data ? String(data.signal.maxPain) : (loading ? "..." : "—")}
            />
            <Card
              title="Bias"
              value={data ? data.signal.bias : (loading ? "..." : "—")}
              highlight={data?.signal.bias}
            />
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <h2 className="text-lg font-semibold text-emerald-400 mb-2">
              Signal
            </h2>
            <p className="text-zinc-300">
              {data ? data.signal.summary : (loading ? "Loading..." : "No data — login during market hours or retry.")}
            </p>
            {data && (
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                {data.signal.entry != null && (
                  <span>Entry: <strong>{data.signal.entry}</strong></span>
                )}
                {data.signal.stopLoss != null && (
                  <span>SL: <strong className="text-red-400">{data.signal.stopLoss}</strong></span>
                )}
                {data.signal.target != null && (
                  <span>Target: <strong className="text-emerald-400">{data.signal.target}</strong></span>
                )}
                <span>Confidence: <strong>{data.signal.confidence}%</strong></span>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <h2 className="text-lg font-semibold text-emerald-400 mb-2">
              Max Pain {(data?.source === "angel_one" || data?.source === "demo") && "(approx)"}
            </h2>
            <div className="flex flex-wrap gap-3">
              {data?.maxPain?.length ? (
                data.maxPain.map((mp) => (
                  <span
                    key={mp.strike}
                    className="rounded bg-zinc-800 px-3 py-1 text-sm"
                  >
                    {mp.strike}
                    {mp.totalPayout > 0 && (
                      <> (₹{(mp.totalPayout / 1e6).toFixed(1)}M)</>
                    )}
                  </span>
                ))
              ) : (
                <span className="text-zinc-500 text-sm">—</span>
              )}
            </div>
          </div>

          {data && (
            <p className="text-xs text-zinc-600">
              Last updated: {new Date(data.timestamp).toLocaleString()}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function LogoutButton() {
  const handleLogout = async () => {
    await fetch("/api/angel-one/logout", { method: "POST" });
    window.location.reload();
  };
  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
    >
      Logout
    </button>
  );
}

function Card({
  title,
  value,
  sub,
  highlight,
}: {
  title: string;
  value: string;
  sub?: string;
  highlight?: string;
}) {
  const isBull = highlight === "BULLISH";
  const isBear = highlight === "BEARISH";
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide">{title}</div>
      <div
        className={`text-xl font-bold mt-1 ${
          isBull ? "text-emerald-400" : isBear ? "text-red-400" : ""
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="text-sm text-zinc-500 mt-0.5">{sub}</div>
      )}
    </div>
  );
}
