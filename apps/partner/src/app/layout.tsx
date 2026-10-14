import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

/** Every partner page reads the vendor session, so nothing here is prerendered or cached. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "ShowBuzz Partner", template: "%s | ShowBuzz Partner" },
  description: "Sell tickets on ShowBuzz: venues, shows, bookings and earnings for cinemas and event organisers.",
  applicationName: "ShowBuzz Partner",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const viewport: Viewport = {
  themeColor: "#4F46E5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
