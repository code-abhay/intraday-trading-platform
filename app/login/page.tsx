"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Clock,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

export default function LoginPage() {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  const totp = digits.join("");

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...digits];
    if (value.length > 1) {
      const chars = value.split("").slice(0, 6 - index);
      chars.forEach((ch, i) => {
        if (index + i < 6) next[index + i] = ch;
      });
      setDigits(next);
      const focusIdx = Math.min(index + chars.length, 5);
      inputRefs.current[focusIdx]?.focus();
    } else {
      next[index] = value;
      setDigits(next);
      if (value && index < 5) inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/angel-one/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.details || data.error || "Login failed");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex">
      {/* Left Panel — Brand Hero */}
      <div className="hidden lg:flex lg:w-[55%] relative auth-gradient grid-pattern">
        <div className="gradient-animate absolute inset-0 opacity-60" />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20">
              <Activity className="size-5 text-emerald-400" />
            </div>
            <span className="text-xl font-bold text-zinc-100">Intraday Pro</span>
          </div>

          <div className="max-w-lg">
            <h1 className="text-4xl font-bold text-zinc-100 leading-tight">
              Connect Your
              <br />
              <span className="text-emerald-400">Angel One Account</span>
            </h1>
            <p className="mt-4 text-lg text-zinc-400 leading-relaxed">
              Link your broker for live market data, real-time option chain,
              and accurate signal generation.
            </p>

            <div className="mt-10 space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-zinc-800/50 bg-zinc-900/30 p-3 backdrop-blur-sm">
                <div className="rounded-lg bg-emerald-500/10 p-2 shrink-0">
                  <ShieldCheck className="size-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">Secure Authentication</p>
                  <p className="text-xs text-zinc-500 mt-0.5">TOTP-based login via your authenticator app</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-zinc-800/50 bg-zinc-900/30 p-3 backdrop-blur-sm">
                <div className="rounded-lg bg-emerald-500/10 p-2 shrink-0">
                  <Clock className="size-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">Daily Session</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Session auto-expires at midnight IST for security</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-zinc-600">
            Your credentials are never stored. Session data is encrypted.
          </p>
        </div>
      </div>

      {/* Right Panel — TOTP Form */}
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
            <h2 className="text-2xl font-bold text-zinc-100">Angel One Login</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          <Card className="border-zinc-800/80">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <KeyRound className="size-3.5" />
                    TOTP Code
                  </Label>
                  <div className="flex gap-2 justify-between">
                    {digits.map((d, i) => (
                      <input
                        key={i}
                        ref={(el) => { inputRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={d}
                        onChange={(e) => handleDigitChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        autoFocus={i === 0}
                        disabled={loading}
                        className="w-11 h-12 text-center text-lg font-bold rounded-lg border border-zinc-700 bg-zinc-800/50 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 disabled:opacity-50 transition-all"
                      />
                    ))}
                  </div>
                  <Badge variant="secondary" className="gap-1.5">
                    <Clock className="size-3" />
                    Session valid until midnight IST
                  </Badge>
                </div>

                {error && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 flex items-center gap-2">
                    <div className="size-1.5 rounded-full bg-red-400 shrink-0" />
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || totp.length !== 6}
                  className="w-full h-11 text-sm font-semibold"
                  size="lg"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Connecting...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Connect Account
                      <ArrowRight className="size-4" />
                    </span>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="size-3.5" />
                Back to Dashboard
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="/api/angel-one/verify-env" target="_blank" rel="noopener noreferrer">
                Verify Config
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
