import type { Metadata } from "next";
import { Crown, Film, Gift } from "lucide-react";
import { CorporateEnquiryForm } from "@/components/public/leads/LeadForms";

export const metadata: Metadata = {
  title: "Corporate Bookings",
  description: "Private screenings, bulk vouchers and VIP hospitality for teams.",
};

const SERVICES = [
  { icon: Film, tone: "bg-blue-50 text-blue-600", title: "Private Screen Buyouts", text: "Book an entire IMAX, 4DX or Insignia auditorium for employee family day or client appreciation night." },
  { icon: Gift, tone: "bg-purple-50 text-purple-600", title: "Employee Rewards & Vouchers", text: "Custom branded digital vouchers with bulk tier pricing discounts for festivals, Diwali gifts & milestones." },
  { icon: Crown, tone: "bg-emerald-50 text-emerald-600", title: "VIP Festival Hospitality", text: "Exclusive access to Eden Gardens T20 corporate lounges, gourmet dining, and front-row concert pits." },
];

export default function CorporatePage() {
  return (
    <main className="flex-1 pb-16">
      <section className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 px-4 py-16 text-center text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <span className="rounded-full border border-blue-400/30 bg-blue-500/20 px-3.5 py-1 text-xs font-extrabold tracking-wider text-blue-300 uppercase">
            Enterprise & Business Solutions
          </span>
          <h1 className="text-3xl leading-tight font-black tracking-tight sm:text-5xl">Corporate Entertainment & Bulk Bookings</h1>
          <p className="mx-auto max-w-xl text-xs leading-relaxed text-slate-300 sm:text-sm">
            Reward your teams with private cinema hall screenings, luxury concert box passes, and brandable digital voucher codes.
          </p>
        </div>
      </section>

      <section className="mt-12 w-full px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {SERVICES.map((s) => (
            <div key={s.title} className="space-y-3 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${s.tone}`}>
                <s.icon className="h-6 w-6" />
              </span>
              <h3 className="text-base font-black text-slate-900">{s.title}</h3>
              <p className="text-xs leading-relaxed text-slate-500">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-4xl px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="space-y-6 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-lg sm:p-10">
          <div className="border-b border-slate-100 pb-4 text-center">
            <h3 className="text-xl font-black text-slate-900">Corporate Enquiry Form</h3>
            <p className="mt-1 text-xs text-slate-500">Get customized quotations and volume discounts for your organization.</p>
          </div>
          <CorporateEnquiryForm />
        </div>
      </section>
    </main>
  );
}
