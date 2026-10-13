import Link from "next/link";
import { Headset, RefreshCw, ShieldCheck, TicketCheck } from "lucide-react";
import { CANCELLATION_CUTOFF_MINUTES } from "@showbuzz/schemas/constants";
import { BrandMark, BrandWordmark } from "./BrandLogo";

const HIGHLIGHTS = [
  { icon: Headset, title: "24/7 Customer Care", text: "Always here to help with tickets & refunds.", tone: "bg-rose-50 text-rose-600" },
  { icon: TicketCheck, title: "Instant M-Tickets", text: "Direct entry QR code straight to your phone.", tone: "bg-blue-50 text-blue-600" },
  { icon: ShieldCheck, title: "100% Safe Payments", text: "Encrypted checkout through trusted gateways.", tone: "bg-emerald-50 text-emerald-600" },
  {
    icon: RefreshCw,
    title: "Easy Cancellations",
    text: `Refunds up to ${CANCELLATION_CUTOFF_MINUTES} mins before showtime.`,
    tone: "bg-purple-50 text-purple-600",
  },
];

const LINK_GROUPS = [
  {
    title: "Entertainment",
    links: [
      { href: "/movies", label: "Movies in Theatres" },
      { href: "/cinemas", label: "Cinemas & Showtimes" },
      { href: "/events", label: "Concerts & Gigs" },
      { href: "/plays", label: "Theatre & Plays" },
      { href: "/sports", label: "Sports Matches" },
    ],
  },
  {
    title: "Partners",
    links: [
      { href: "/list-your-show", label: "List Your Show" },
      { href: "/corporate", label: "Corporate Bookings" },
      { href: "/gift-cards", label: "Gift Vouchers" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/contact", label: "Help Center" },
      { href: "/faq", label: "FAQs" },
      { href: "/offers", label: "Promo Offers" },
      { href: "/about", label: "About Us" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Use" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-slate-200/80 bg-white pt-16 pb-12 text-slate-600">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="grid grid-cols-1 gap-6 border-b border-slate-100 pb-12 md:grid-cols-4">
          {HIGHLIGHTS.map((h) => (
            <div key={h.title} className="flex items-start gap-3.5">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${h.tone}`}>
                <h.icon className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-900">{h.title}</h4>
                <p className="mt-0.5 text-[11px] text-slate-500">{h.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-8 border-b border-slate-100 py-10 text-xs md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-3 flex items-center gap-2">
              <BrandMark className="h-7 w-7 rounded-lg" />
              <BrandWordmark className="text-lg" />
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">India&apos;s modern entertainment booking app.</p>
          </div>
          {LINK_GROUPS.map((group) => (
            <div key={group.title}>
              <h5 className="mb-3 text-[10px] font-bold tracking-wider text-slate-900 uppercase">{group.title}</h5>
              <ul className="space-y-2 text-slate-500">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:text-rose-600">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-2 pt-6 text-[11px] text-slate-400 sm:flex-row">
          <p>&copy; 2026 ShowBuzz Entertainment Pvt. Ltd.</p>
          <p>Handcrafted for movie lovers across India.</p>
        </div>
      </div>
    </footer>
  );
}
