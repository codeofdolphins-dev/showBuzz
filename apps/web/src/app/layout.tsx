import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ShowBuzz - Movie Tickets, Concerts, Plays, Sports & Activities",
    template: "%s | ShowBuzz",
  },
  description:
    "ShowBuzz is India's entertainment booking platform. Book movie tickets, IMAX shows, concerts, live theatre and T20 cricket matches.",
  applicationName: "ShowBuzz",
  openGraph: {
    title: "ShowBuzz - Entertainment Ticket Booking",
    description: "Book movies, events, sports and experiences all in one place.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF385C",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${jakarta.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
