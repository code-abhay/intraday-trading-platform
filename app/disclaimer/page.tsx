import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export const metadata = { title: "Disclaimer — Intraday Pro" };

export default function DisclaimerPage() {
  return (
    <div className="flex-1 bg-zinc-950 text-zinc-100">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-8">
          <ArrowLeft className="size-3.5" /> Back to Home
        </Link>

        <h1 className="text-3xl font-bold mb-2">Disclaimer</h1>
        <p className="text-sm text-zinc-500 mb-10">Last updated: February 2026</p>

        {/* SEBI / Financial Disclaimer */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 mb-10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-6 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200/90 leading-relaxed">
              <p className="font-semibold text-amber-300 mb-2">Important Notice</p>
              <p>
                Intraday Pro is <strong>NOT</strong> a SEBI-registered investment advisor, research analyst,
                or broker. The Platform does not provide personalized investment advice and is not authorized
                to manage portfolios or funds.
              </p>
            </div>
          </div>
        </div>

        <div className="prose-custom space-y-8 text-sm text-zinc-400 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-3">Not Investment Advice</h2>
            <p>
              All signals, analysis, recommendations, and data displayed on this Platform are for
              <strong className="text-zinc-300"> informational and educational purposes only</strong>.
              Nothing on this Platform should be construed as an offer, recommendation, or solicitation
              to buy or sell any financial instrument.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-3">Trading Risks</h2>
            <p>
              Trading in derivatives (options and futures) involves substantial risk of loss and is not
              suitable for every investor. The high degree of leverage can work against you as well as
              for you. Before deciding to trade, you should carefully consider your investment objectives,
              level of experience, and risk appetite.
            </p>
            <div className="mt-3 rounded-lg bg-zinc-800/50 p-4">
              <p className="text-zinc-300 font-medium mb-2">Key risks include:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Options can expire worthless, resulting in 100% loss of premium paid</li>
                <li>Intraday trading is highly volatile — prices can move rapidly against your position</li>
                <li>Past performance of any signal or strategy does not guarantee future results</li>
                <li>AI models can generate incorrect signals, especially in unusual market conditions</li>
                <li>Technical failures, data delays, or network issues may affect signal timeliness</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-3">Paper Trading vs. Real Trading</h2>
            <p>
              Paper trading results on this Platform use simulated execution and do not account for
              real-world factors such as slippage, liquidity, order fills, and transaction costs.
              Actual trading results may differ significantly from paper trading performance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-3">Data Accuracy</h2>
            <p>
              Market data is sourced from third-party providers and may be delayed, inaccurate, or
              incomplete. The Platform does not guarantee the accuracy of any data, signal, or analysis.
              Always verify information with your broker before making trading decisions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-3">SEBI Compliance</h2>
            <p>
              As per SEBI (Securities and Exchange Board of India) regulations, any individual or entity
              providing investment advice must be registered as a Research Analyst (RA) or Investment
              Advisor (IA). This Platform is <strong className="text-zinc-300">not SEBI-registered</strong>{" "}
              and operates purely as a personal analytical tool. Users are advised to consult SEBI-registered
              professionals for investment decisions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-3">Limitation of Liability</h2>
            <p>
              Under no circumstances shall Abhay Kumar or Intraday Pro be held responsible or liable in
              any way for any claims, damages, losses, expenses, costs, or liabilities (including lost
              profits or lost data) resulting from or relating to your use of the Platform or any signals
              or analysis generated by it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-3">Contact</h2>
            <p>
              For questions about this disclaimer, contact{" "}
              <a href="mailto:abhayk2193@gmail.com" className="text-emerald-400 hover:underline">abhayk2193@gmail.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
