import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { ThemeInitialiser } from "@/components/ThemeInitialiser";

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
      "Upload audio files and detect beats, BPM, and rhythm with interactive waveform visualisation. No login required — all processing happens in your browser.",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-AU" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        {/* ThemeInitialiser applies the data-theme attribute before first render */}
        <ThemeInitialiser />
        <NavBar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
