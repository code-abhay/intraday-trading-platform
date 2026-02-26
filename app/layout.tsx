import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Intraday Trading Platform",
  description: "OI analytics, PCR, and signal generation for NIFTY",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} antialiased min-h-screen flex flex-col bg-zinc-950`}
      >
        <main className="flex-1 flex flex-col">{children}</main>

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
      </body>
    </html>
  );
}
