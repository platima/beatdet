import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BeatDet: Audio Beat Detection",
  description:
    "Upload audio files and detect beats, BPM, and rhythm with interactive waveform visualisation.",
  openGraph: {
    title: "BeatDet: Audio Beat Detection",
    description:
      "Upload audio files and detect beats, BPM, and rhythm with interactive waveform visualisation. No login required; all processing happens in your browser.",
    siteName: "BeatDet",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "BeatDet: Audio Beat Detection",
    description:
      "Browser-based beat detection: BPM, waveform, onset charts, and audio export. No data leaves your browser.",
  },
};

// Inline theme script applied in <head> before the browser paints the first
// frame. Using a plain render-blocking <script> here — not next/script — is
// intentional: next/script beforeInteractive does not reliably inject before
// the first paint in static-export mode or the Next.js dev server.
//
// Logic: read localStorage, check prefers-color-scheme if no explicit
// preference, then set data-theme on <html> so CSS variables resolve to the
// correct theme without a flash.
const THEME_SCRIPT = `(function(){try{var r=localStorage.getItem('beatdet-settings');var t='light';if(r){var s=JSON.parse(r);var p=s&&s.state&&s.state.settings&&s.state.settings.display&&s.state.settings.display.theme;if(p==='dark'){t='dark';}else if(p==='light'){t='light';}else if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){t='dark';}}else if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){t='dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-AU" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <NavBar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
