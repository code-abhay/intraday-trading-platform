import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Privacy Policy — Intraday Pro" };

export default function PrivacyPage() {
  return (
    <div className="flex-1 bg-zinc-950 text-zinc-100">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-8">
          <ArrowLeft className="size-3.5" /> Back to Home
        </Link>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-zinc-500 mb-10">Last updated: February 2026</p>

        <div className="prose-custom space-y-8 text-sm text-zinc-400 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-3">1. Information We Collect</h2>
            <p>Intraday Pro collects minimal data necessary for the Platform to function:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-zinc-300">Authentication data</strong>: Site password (hashed) stored as an HTTP cookie for session management</li>
              <li><strong className="text-zinc-300">Angel One credentials</strong>: TOTP codes are used transiently for API authentication and are not stored</li>
              <li><strong className="text-zinc-300">Paper trade data</strong>: Stored locally in your browser&rsquo;s localStorage and not transmitted to any server</li>
              <li><strong className="text-zinc-300">Usage data</strong>: Standard web server logs (IP address, browser type, pages visited) via Vercel&rsquo;s hosting infrastructure</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To authenticate your access to the Platform</li>
              <li>To fetch real-time market data from Angel One on your behalf</li>
              <li>To generate trading signals and analytics</li>
              <li>To improve the Platform&rsquo;s performance and reliability</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-3">3. Data Storage & Security</h2>
            <p>
              The Platform is hosted on Vercel. Authentication tokens are stored as secure HTTP cookies.
              Paper trading data remains in your browser&rsquo;s local storage and is never sent to our servers.
              Angel One API sessions expire at midnight IST daily.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-3">4. Third-Party Services</h2>
            <p>The Platform integrates with:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-zinc-300">Angel One (SmartAPI)</strong>: For real-time market data and option chain information</li>
              <li><strong className="text-zinc-300">Vercel</strong>: For hosting and deployment infrastructure</li>
            </ul>
            <p className="mt-2">
              These services have their own privacy policies. We encourage you to review them.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-3">5. Cookies</h2>
            <p>
              We use a single authentication cookie (<code className="text-emerald-400/80 text-xs bg-zinc-800 px-1.5 py-0.5 rounded">site_auth</code>)
              to manage your login session. No tracking cookies or third-party analytics cookies are used.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-3">6. Your Rights</h2>
            <p>You can:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Clear your browser cookies to log out and remove session data</li>
              <li>Clear localStorage to remove all paper trading data</li>
              <li>Request deletion of any server-side data by contacting us</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-3">7. Contact</h2>
            <p>
              For privacy-related questions, contact{" "}
              <a href="mailto:abhayk2193@gmail.com" className="text-emerald-400 hover:underline">abhayk2193@gmail.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
