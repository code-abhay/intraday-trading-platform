"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
    title: "Real-Time Signals",
    desc: "AI-generated BUY/SELL signals with confidence scoring",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: "Smart Risk Management",
    desc: "Auto SL, trailing targets, and position sizing",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    title: "Paper Trading",
    desc: "Practice strategies risk-free with virtual capital",
  },
];

function AuthForm() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      const redirect = searchParams.get("redirect") || "/";
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left — Welcome / Hero Panel */}
        <div className="relative lg:w-[55%] flex flex-col justify-center px-8 py-12 lg:px-16 overflow-hidden">
          {/* Animated gradient mesh background */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-1/3 -left-1/4 h-[600px] w-[600px] rounded-full bg-emerald-600/15 blur-[120px] animate-pulse" />
            <div className="absolute -bottom-1/4 -right-1/4 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[100px] animate-pulse [animation-delay:2s]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-emerald-500/5 blur-[80px]" />
          </div>

          {/* Logo + Brand */}
          <div className="flex items-center gap-3 mb-10">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-zinc-100 tracking-tight">Intraday Pro</span>
          </div>

          {/* Welcome headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-100 leading-tight mb-4">
            Trade Smarter,{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Not Harder.
            </span>
          </h1>
          <p className="text-base lg:text-lg text-zinc-400 max-w-md mb-10 leading-relaxed">
            AI-powered options signals for NIFTY &amp; BANKNIFTY. Get real-time
            OI analysis, smart strike selection, and disciplined risk management
            — all in one platform.
          </p>

          {/* Feature bullets */}
          <div className="space-y-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-4">
                <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  {f.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-200">{f.title}</p>
                  <p className="text-sm text-zinc-500">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Quote */}
          <div className="mt-12 border-l-2 border-emerald-500/30 pl-4">
            <p className="text-sm italic text-zinc-500">
              &ldquo;The goal of a successful trader is to make the best trades.
              Money is secondary.&rdquo;
            </p>
            <p className="text-xs text-zinc-600 mt-1">— Alexander Elder</p>
          </div>
        </div>

        {/* Right — Login Form Panel */}
        <div className="lg:w-[45%] flex items-center justify-center px-6 py-12 lg:px-16 lg:border-l border-zinc-800/60">
          <div className="w-full max-w-sm">
            <div className="text-center mb-8 lg:text-left">
              <h2 className="text-2xl font-bold text-zinc-100">Welcome back</h2>
              <p className="text-sm text-zinc-500 mt-1">
                Sign in to access your trading dashboard
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-zinc-400 mb-1.5">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter platform password"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                    autoFocus
                    disabled={loading}
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-950/50 border border-red-800 p-3 text-sm text-red-300">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 font-semibold text-white hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-900/20"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Verifying...
                    </span>
                  ) : (
                    "Sign In"
                  )}
                </button>
              </form>
            </div>

            <p className="text-center text-xs text-zinc-600 mt-5">
              Protected trading platform. Unauthorized access prohibited.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 bg-zinc-950 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
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
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <div className="text-zinc-500">Loading...</div>
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
