import Link from "next/link";
import {
  TrendingUp,
  Shield,
  BarChart3,
  Zap,
  Activity,
  ArrowRight,
  Target,
  LineChart,
  CheckCircle2,
} from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "AI-Powered Signals",
    description:
      "Real-time BUY/SELL signals with confidence scoring, powered by OI analysis, PCR, multi-timeframe technicals, and machine-learning filters.",
  },
  {
    icon: Shield,
    title: "Smart Risk Management",
    description:
      "Dynamic stop-loss, trailing targets (T1/T2/T3), partial exit plans, and volatility-adjusted position sizing — all automated.",
  },
  {
    icon: LineChart,
    title: "Paper Trading",
    description:
      "Practice strategies risk-free with virtual capital. Auto SL/target execution, full trade history, and performance analytics.",
  },
  {
    icon: BarChart3,
    title: "Live Option Chain",
    description:
      "Real-time OI data, IV, delta, and heatmap visualization. Identify strikes with max buildup and smart money activity.",
  },
];

const STATS = [
  { label: "Segments Covered", value: "5+" },
  { label: "Indicators Tracked", value: "15+" },
  { label: "Signal Refresh", value: "30s" },
  { label: "Risk Parameters", value: "8+" },
];

const PLAN_FEATURES = [
  "Real-time signals for NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY, SENSEX",
  "AI-powered strike selection and premium targets",
  "Auto stop-loss and trailing target management",
  "Full option chain with OI heatmap and greeks",
  "Paper trading with analytics dashboard",
  "Advanced filters: Range Filter, RQK Kernel, Choppiness Index",
  "Support/Resistance levels with CPR and Camarilla pivots",
  "Sentiment scoring with multi-component breakdown",
];

export default function LandingPage() {
  return (
    <div className="flex-1 bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-9 rounded-lg bg-emerald-500/15 border border-emerald-500/20">
              <Activity className="size-5 text-emerald-400" />
            </div>
            <span className="text-lg font-bold tracking-tight">Intraday Pro</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/auth"
              className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors px-4 py-2"
            >
              Log In
            </Link>
            <Link
              href="/auth"
              className="text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-1/3 left-1/4 h-[600px] w-[600px] rounded-full bg-emerald-600/10 blur-[120px]" />
          <div className="absolute -bottom-1/4 right-1/4 h-[500px] w-[500px] rounded-full bg-cyan-500/8 blur-[100px]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-16 lg:pt-28 lg:pb-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 text-sm text-emerald-400 mb-6">
            <Zap className="size-3.5" />
            AI-Powered Options Trading Platform
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight max-w-4xl mx-auto">
            Trade Options with{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Confidence & Discipline
            </span>
          </h1>

          <p className="mt-6 text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Get real-time intraday signals for NIFTY &amp; BANKNIFTY options.
            AI-driven OI analysis, smart strike selection, automated risk
            management, and paper trading — everything you need to trade smarter.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold px-8 py-3.5 rounded-lg transition-all shadow-lg shadow-emerald-900/20 text-base"
            >
              Start Trading
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="#features"
              className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-200 font-medium px-6 py-3.5 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-all"
            >
              See Features
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl mx-auto">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="text-2xl lg:text-3xl font-bold text-zinc-100">{s.value}</p>
                <p className="text-sm text-zinc-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-zinc-800/60 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto px-6 py-20 lg:py-28">
          <div className="text-center mb-14">
            <h2 className="text-3xl lg:text-4xl font-bold">
              Everything You Need to{" "}
              <span className="text-emerald-400">Trade Intraday</span>
            </h2>
            <p className="mt-4 text-zinc-400 max-w-xl mx-auto">
              A complete platform combining signals, risk management, option chain
              analytics, and practice trading in one place.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-center size-11 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-4">
                  <f.icon className="size-5 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-100 mb-2">{f.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-zinc-800/60">
        <div className="max-w-6xl mx-auto px-6 py-20 lg:py-28">
          <div className="text-center mb-14">
            <h2 className="text-3xl lg:text-4xl font-bold">
              How It <span className="text-emerald-400">Works</span>
            </h2>
          </div>

          <div className="grid gap-8 sm:grid-cols-3 max-w-4xl mx-auto">
            {[
              {
                step: "01",
                title: "Login & Select Segment",
                description:
                  "Connect your Angel One account for live data. Choose NIFTY, BANKNIFTY, or other segments.",
                icon: Activity,
              },
              {
                step: "02",
                title: "Get AI Signals",
                description:
                  "The platform analyzes OI, PCR, technicals, and sentiment every 30 seconds to generate actionable signals.",
                icon: Target,
              },
              {
                step: "03",
                title: "Trade with Confidence",
                description:
                  "Execute paper trades with auto SL/targets, or use the signals to inform your real trading decisions.",
                icon: TrendingUp,
              },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="inline-flex items-center justify-center size-14 rounded-full border border-emerald-500/20 bg-emerald-500/5 mb-4">
                  <s.icon className="size-6 text-emerald-400" />
                </div>
                <p className="text-xs font-bold text-emerald-400 tracking-widest mb-2">STEP {s.step}</p>
                <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-zinc-800/60 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto px-6 py-20 lg:py-28">
          <div className="text-center mb-14">
            <h2 className="text-3xl lg:text-4xl font-bold">
              Simple <span className="text-emerald-400">Pricing</span>
            </h2>
            <p className="mt-4 text-zinc-400">Full access to all features. No hidden charges.</p>
          </div>

          <div className="max-w-md mx-auto rounded-xl border border-emerald-500/20 bg-zinc-900/80 p-8 text-center">
            <p className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-2">Pro Access</p>
            <div className="flex items-baseline justify-center gap-1 mb-6">
              <span className="text-5xl font-bold">Free</span>
              <span className="text-zinc-500 text-sm">during beta</span>
            </div>
            <ul className="space-y-3 text-left mb-8">
              {PLAN_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                  <CheckCircle2 className="size-4 text-emerald-400 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/auth"
              className="block w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold px-6 py-3 rounded-lg transition-all text-center"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-800/60">
        <div className="max-w-6xl mx-auto px-6 py-20 lg:py-24 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Ready to Trade Smarter?
          </h2>
          <p className="text-zinc-400 max-w-lg mx-auto mb-8">
            Join the platform that combines AI signals, risk management, and
            analytics to help you make better intraday trading decisions.
          </p>
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold px-8 py-3.5 rounded-lg transition-all shadow-lg shadow-emerald-900/20 text-base"
          >
            Start Trading Now
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
