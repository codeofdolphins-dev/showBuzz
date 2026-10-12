import type { Metadata } from "next";
import { ArrowDown, ChartPie, Megaphone, QrCode } from "lucide-react";
import { ShowSubmissionForm } from "@/components/public/leads/LeadForms";

export const metadata: Metadata = {
  title: "List Your Show",
  description: "Sell tickets for your concert, play, comedy show or sports event on ShowBuzz.",
};

const STATS = [
  { value: "10M+", label: "Active Monthly Users", color: "text-rose-600" },
  { value: "45,000+", label: "Successful Live Events", color: "text-blue-600" },
  { value: "99.98%", label: "Platform Uptime & Speed", color: "text-purple-600" },
  { value: "Instant", label: "Daily Direct Payouts", color: "text-emerald-600" },
];

const FEATURES = [
  {
    icon: Megaphone,
    tone: "bg-rose-50 text-rose-600",
    title: "Targeted Marketing Boost",
    text: "Reach cinema goers and music fans in your city via push notifications, email blasts and banner spotlighting.",
  },
  {
    icon: QrCode,
    tone: "bg-blue-50 text-blue-600",
    title: "High-Speed QR Gate Access",
    text: "Scan tickets at entry gates in under 0.5 seconds using our free Organiser scanner.",
  },
  {
    icon: ChartPie,
    tone: "bg-purple-50 text-purple-600",
    title: "Real-Time Ticket Analytics",
    text: "Live dashboards tracking sales velocity, attendee demographics, discount codes, and revenue.",
  },
];

export default function ListYourShowPage() {
  return (
    <main className="flex-1 pb-16">
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="relative z-10 mx-auto max-w-5xl space-y-4 text-center">
          <span className="rounded-full border border-rose-500/40 bg-rose-500/20 px-3 py-1 text-xs font-extrabold tracking-wider text-rose-300 uppercase">
            Partner Platform for Organisers & Creators
          </span>
          <h1 className="text-3xl leading-tight font-black tracking-tight sm:text-5xl">
            List Your Show & Sell Out Every Seat
          </h1>
          <p className="mx-auto max-w-2xl text-xs leading-relaxed text-slate-300 sm:text-sm">
            From independent acoustic gigs to 50,000+ stadium EDM festivals. Tap into India&apos;s fastest-growing
            entertainment community with powerful ticketing tools.
          </p>
          <div className="pt-4">
            <a
              href="#register"
              className="inline-flex gradient-btn items-center gap-2 rounded-2xl px-8 py-3.5 text-xs font-black text-white shadow-xl shadow-rose-500/30 transition-transform hover:scale-105"
            >
              Get Started in 5 Minutes <ArrowDown className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </section>

      <section className="relative z-20 -mt-8 w-full px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-3xl border border-slate-200/80 bg-white p-6 text-center shadow-md">
              <span className={`block text-3xl font-black ${s.color}`}>{s.value}</span>
              <span className="mt-1 block text-xs font-semibold text-slate-500">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 w-full px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="mx-auto mb-10 max-w-xl text-center">
          <h2 className="text-2xl font-black text-slate-900">Why Top Organisers Choose ShowBuzz</h2>
          <p className="mt-1 text-xs text-slate-500">Everything you need to plan, market, and manage live shows.</p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="space-y-2 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${f.tone}`}>
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="text-sm font-bold text-slate-900">{f.title}</h3>
              <p className="text-xs leading-relaxed text-slate-500">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="register" className="mx-auto mt-16 max-w-4xl scroll-mt-24 px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="space-y-6 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-lg sm:p-10">
          <div className="border-b border-slate-100 pb-4 text-center">
            <h3 className="text-xl font-black text-slate-900">Organiser Registration Form</h3>
            <p className="mt-1 text-xs text-slate-500">
              Submit your show details and our onboarding specialist will get in touch within 2 hours.
            </p>
          </div>
          <ShowSubmissionForm />
        </div>
      </section>
    </main>
  );
}
