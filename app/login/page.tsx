"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [totp, setTotp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

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

      if (!res.ok) {
        throw new Error(data.details || data.error || "Login failed");
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
        <h1 className="text-xl font-bold text-emerald-400 mb-2">
          Angel One Login
        </h1>
        <p className="text-sm text-zinc-500 mb-6">
          Enter the 6-digit code from your authenticator app. Session valid until midnight IST.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="totp" className="block text-sm text-zinc-400 mb-1">
              TOTP Code
            </label>
            <input
              id="totp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={totp}
              onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-lg tracking-[0.5em] text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
            disabled={loading || totp.length !== 6}
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="mt-3 text-center">
          <a href="/" className="text-sm text-zinc-500 hover:text-zinc-400">
            ← Back to dashboard
          </a>
        </p>
      </div>
    </div>
  );
}
