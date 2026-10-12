import type { Metadata } from "next";
import { Headset, Mail, MapPin } from "lucide-react";
import { ContactForm } from "@/components/public/leads/LeadForms";

export const metadata: Metadata = {
  title: "Contact & Help Center",
  description: "Get help with tickets, refunds and payments. Available 24x7.",
};

const CHANNELS = [
  {
    icon: Headset,
    tone: "bg-rose-50 text-rose-600",
    title: "24x7 Customer Helpline",
    lines: ["+91 (033) 4000-SHOW / 1800-200-8899"],
    note: "Toll Free Across India",
  },
  {
    icon: Mail,
    tone: "bg-blue-50 text-blue-600",
    title: "Email Support",
    lines: ["support@showbuzz.in", "partnerships@showbuzz.in"],
  },
  {
    icon: MapPin,
    tone: "bg-purple-50 text-purple-600",
    title: "Corporate HQ",
    lines: ["Sector V, Salt Lake, Kolkata 700091, WB"],
  },
];

export default function ContactPage() {
  return (
    <main className="w-full flex-1 px-4 py-10 sm:px-6 lg:px-8 xl:px-12">
      <div className="mx-auto mb-10 max-w-xl text-center">
        <span className="text-xs font-black tracking-widest text-rose-600 uppercase">We&apos;re Here For You</span>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          Get in Touch with ShowBuzz
        </h1>
        <p className="mt-2 text-xs text-slate-500 sm:text-sm">
          Have a question regarding your tickets or need help with a booking? Our care team is available round the
          clock.
        </p>
      </div>
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
        <div className="space-y-4">
          {CHANNELS.map((c) => (
            <div
              key={c.title}
              className="flex items-start gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${c.tone}`}>
                <c.icon className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-sm font-bold text-slate-900">{c.title}</h4>
                {c.lines.map((l) => (
                  <p key={l} className="mt-0.5 text-xs text-slate-500">
                    {l}
                  </p>
                ))}
                {c.note && <span className="text-[10px] font-bold text-emerald-600">{c.note}</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-6 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs sm:p-8 lg:col-span-2">
          <h3 className="border-b border-slate-100 pb-3 text-base font-extrabold text-slate-900">
            Send Us a Direct Message
          </h3>
          <ContactForm />
        </div>
      </div>
    </main>
  );
}
