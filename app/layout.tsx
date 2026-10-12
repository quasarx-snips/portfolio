import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CustomCursor } from "@/components/custom-cursor";
import { ScrollProgress } from "@/components/scroll-progress";
import { Grain } from "@/components/aurora";
import { site } from "@/lib/site.config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // PLACEHOLDER — replace with your real domain once it is connected on Vercel.
  metadataBase: new URL("https://your-domain.com"),
  title: {
    default: `${site.name} — Aerospace Security & AI/ML`,
    template: `%s — ${site.name}`,
  },
  description: site.tagline,
  keywords: [
    "Bibhab Saha",
    "aerospace security",
    "avionics security",
    "ARINC 429",
    "computer vision",
    "machine learning",
    "orbital mechanics",
    "VIT Vellore",
    "Next.js",
    "Python",
  ],
  authors: [{ name: site.name }],
  openGraph: {
    title: `${site.name} — Aerospace Security & AI/ML`,
    description: site.tagline,
    url: "https://your-domain.com",
    siteName: site.name,
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `${site.name} — Aerospace Security & AI/ML`,
    description: site.tagline,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-text">
        <ScrollProgress />
        <CustomCursor />
        <Grain />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
