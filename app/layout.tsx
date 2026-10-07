import "./globals.css";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { Home } from "lucide-react";
import SiteNavigation from "@/components/SiteNavigation";

export const metadata = {
  title: "Keja Mtaani — Free Nairobi rentals and viewing requests",
  description: "Find rental homes in Kenya, review move-in costs, and request a free viewing.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Keja Mtaani — Find your next keja",
    description: "Explore rental homes in Kenya and request a free viewing.",
    siteName: "Keja Mtaani",
    locale: "en_KE",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Keja Mtaani — Find your next keja",
    description: "Explore rental homes in Kenya and request a free viewing.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <a href="#main-content" className="sr-only z-50 rounded-lg bg-white p-3 text-emerald-900 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to main content</a>
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-bold text-emerald-700">
              <Home className="h-6 w-6" /> Keja Mtaani
              <span className="hidden text-xs font-normal text-neutral-500 md:inline">Free property discovery</span>
            </Link>
            <SiteNavigation />
          </div>
        </header>
        <div id="main-content" tabIndex={-1}>{children}</div>
        <footer className="mt-16 border-t border-slate-200 bg-white py-8 pb-24 text-center text-sm text-neutral-500 sm:pb-8">
          <p>Free browsing, free viewing requests, and no mandatory platform payments.</p>
          <p className="mt-2 text-xs">Property views and contact actions are saved to your account when you are signed in.</p>
          <p className="mt-2">Customer care: <a href="tel:+254758934463" className="font-medium text-emerald-800 underline">0758 934 463</a> · <a href="https://wa.me/254758934463" target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-800 underline">WhatsApp support</a></p>
          <nav aria-label="Legal" className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
            <Link href="/privacy" className="text-emerald-800 underline">Privacy</Link>
            <Link href="/terms" className="text-emerald-800 underline">Terms</Link>
            <Link href="/retention" className="text-emerald-800 underline">Data retention</Link>
            <Link href="/how-it-works" className="text-emerald-800 underline">How it works</Link>
            <Link href="/account/privacy" className="text-emerald-800 underline">Privacy controls</Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
