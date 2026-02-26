import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Intraday Pro — AI-Powered Options Signals",
  description: "Professional intraday trading platform with real-time signals, OI analytics, and smart risk management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
