import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Terms of Service — Intraday Pro" };

export default function TermsPage() {
  return (
    <div className="flex-1 bg-zinc-950 text-zinc-100">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-8">
          <ArrowLeft className="size-3.5" /> Back to Home
        </Link>

        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-zinc-500 mb-10">Last updated: February 2026</p>

        <div className="prose-custom space-y-8 text-sm text-zinc-400 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Intraday Pro (&ldquo;the Platform&rdquo;), operated by Abhay Kumar,
              you agree to be bound by these Terms of Service. If you do not agree, you must not use the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-3">2. Description of Service</h2>
            <p>
              Intraday Pro is a market analysis and paper trading platform that provides AI-generated signals,
              option chain analytics, and virtual trading capabilities for educational and informational purposes.
              The Platform does not execute real trades or manage real money.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-3">3. No Financial Advice</h2>
            <p>
              The signals, analysis, and recommendations provided by the Platform are for informational and
              educational purposes only. They do not constitute financial advice, investment advice, trading advice,
              or any other sort of advice. You should not treat any of the Platform&rsquo;s content as such.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-3">4. User Responsibilities</h2>
            <p>You agree to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Use the Platform only for lawful purposes</li>
              <li>Not attempt to reverse engineer, decompile, or disassemble the Platform</li>
              <li>Not share your access credentials with unauthorized third parties</li>
              <li>Take full responsibility for any trading decisions you make based on the Platform&rsquo;s output</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-3">5. Data & Third-Party Services</h2>
            <p>
              Market data is sourced from third-party providers including Angel One and NSE. The Platform does
              not guarantee the accuracy, completeness, or timeliness of this data. Data availability depends on
              third-party service uptime and market hours (9:15 AM – 3:30 PM IST on trading days).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-3">6. Limitation of Liability</h2>
            <p>
              The Platform is provided &ldquo;as is&rdquo; without warranties of any kind. In no event shall
              Abhay Kumar be liable for any direct, indirect, incidental, special, or consequential damages
              arising from your use of the Platform, including but not limited to financial losses incurred
              from trading decisions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-3">7. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Continued use of the Platform after
              changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-3">8. Contact</h2>
            <p>
              For questions about these Terms, contact us at{" "}
              <a href="mailto:abhayk2193@gmail.com" className="text-emerald-400 hover:underline">abhayk2193@gmail.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
