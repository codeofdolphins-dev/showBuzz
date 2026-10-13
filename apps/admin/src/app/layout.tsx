import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

/** Every admin page reads the staff session, so nothing here is prerendered or cached. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "ShowBuzz Admin", template: "%s | ShowBuzz Admin" },
  description: "ShowBuzz operations console.",
  applicationName: "ShowBuzz Admin",
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
