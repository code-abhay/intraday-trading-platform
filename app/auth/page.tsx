"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  Shield,
  BarChart3,
  Zap,
  Lock,
  ArrowRight,
  Activity,
} from "lucide-react";

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
      if (!res.ok) throw new Error(data.error || "Login failed");
      const redirect = searchParams.get("redirect") || "/";
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: TrendingUp,
      title: "Real-time Signals",
      desc: "Multi-factor bias from EMA, RSI, MACD, VWAP & OI analytics",
    },
    {
      icon: Shield,
      title: "Smart Risk Management",
      desc: "ATR-based targets, auto trailing SL, and partial exits",
    },
    {
      icon: BarChart3,
      title: "Paper Trading",
      desc: "Simulate trades with real-time premiums and P&L tracking",
    },
    {
      icon: Zap,
      title: "Advanced Filters",
      desc: "Range Filter, RQK kernel regression & Choppiness Index",
    },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Brand Hero */}
      <div className="hidden lg:flex lg:w-[55%] relative auth-gradient grid-pattern">
        <div className="gradient-animate absolute inset-0 opacity-60" />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div>
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20">
                <Activity className="size-5 text-emerald-400" />
              </div>
              <span className="text-xl font-bold text-zinc-100">Intraday Pro</span>
            </div>
          </div>

          <div className="max-w-lg">
            <h1 className="text-4xl font-bold text-zinc-100 leading-tight">
              AI-Powered Options
              <br />
              <span className="text-emerald-400">Signal Engine</span>
            </h1>
            <p className="mt-4 text-lg text-zinc-400 leading-relaxed">
              Professional-grade intraday signals backed by 10+ technical indicators,
              real-time OI analytics, and institutional-level risk management.
            </p>

            <div className="mt-10 grid grid-cols-1 gap-4">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="flex items-start gap-3 rounded-lg border border-zinc-800/50 bg-zinc-900/30 p-3 backdrop-blur-sm"
                >
                  <div className="rounded-lg bg-emerald-500/10 p-2 shrink-0">
                    <f.icon className="size-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{f.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-zinc-600">
            Built for serious traders. Not financial advice.
          </p>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-zinc-950">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center size-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20">
              <Activity className="size-5 text-emerald-400" />
            </div>
            <span className="text-xl font-bold text-zinc-100">Intraday Pro</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-zinc-100">Welcome back</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Enter your password to access the platform
            </p>
          </div>

          <Card className="border-zinc-800/80">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter platform password"
                      className="pl-10 h-11"
                      autoFocus
                      disabled={loading}
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 flex items-center gap-2">
                    <div className="size-1.5 rounded-full bg-red-400 shrink-0" />
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full h-11 text-sm font-semibold"
                  size="lg"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Verifying...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Sign In
                      <ArrowRight className="size-4" />
                    </span>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-zinc-600 mt-6">
            Protected trading platform. Unauthorized access prohibited.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <div className="flex items-center gap-2 text-zinc-500">
            <span className="size-4 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
            Loading...
          </div>
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
