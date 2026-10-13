import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { CANCELLATION_CUTOFF_MINUTES } from "@showbuzz/schemas/constants";

export const metadata: Metadata = {
  title: "FAQs",
  description: "Answers to common questions about tickets, refunds, coupons and payments.",
};

const FAQS = [
  {
    q: "How do I access and use my digital M-Ticket at the cinema or event?",
    a: 'Once your booking is confirmed, a digital M-ticket with a unique entry code is generated. Open it anytime from "My Bookings", or via the link sent to your email. Show the code at the cinema or gate entry scanner; no paper printout needed.',
  },
  {
    q: "What is the ticket cancellation policy and when do I get a refund?",
    a: `Most cinemas and select events support cancellation up to ${CANCELLATION_CUTOFF_MINUTES} minutes before the scheduled showtime. Go to "My Bookings", choose the booking and select "Cancel & Refund". The amount paid, less a ₹50 cancellation fee, is refunded to your original payment method within 24-48 business hours.`,
  },
  {
    q: "How do discount coupon codes like SHOW50 work?",
    a: 'On the checkout page, enter your promo code and tap "Apply". If the minimum purchase conditions are met, the discount is deducted from the payable total. First-time users can use SHOW50 for 50% off (up to ₹150) on bookings of ₹300 or more.',
  },
  {
    q: "Can I pre-order Food & Beverages and have them delivered to my seat?",
    a: "Yes. When booking cinema tickets you can add popcorn, nachos, combos, burgers and drinks. In luxury auditoriums like INOX Insignia, snacks are served right at your recliner.",
  },
  {
    q: "What payment methods are supported?",
    a: "UPI (Google Pay, PhonePe, Paytm, BHIM), major credit and debit cards (Visa, Mastercard, RuPay, Amex), net banking, mobile wallets and ShowBuzz e-gift cards. Card details are entered on our payment partner's secure page and are never stored by ShowBuzz.",
  },
];

export default function FaqPage() {
  return (
    <main className="w-full flex-1 px-4 py-10 sm:px-6 lg:px-8 xl:px-12">
      <div className="mb-10 text-center">
        <span className="text-xs font-black tracking-widest text-rose-600 uppercase">Help Center</span>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          Frequently Asked Questions
        </h1>
        <p className="mt-2 text-xs text-slate-500 sm:text-sm">
          Find instant answers to common questions about your entertainment tickets.
        </p>
      </div>
      <div className="mx-auto max-w-4xl space-y-4">
        {FAQS.map((f) => (
          <details
            key={f.q}
            name="faq"
            className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-sm font-bold text-slate-900 transition-colors hover:text-rose-600 [&::-webkit-details-marker]:hidden">
              <span>{f.q}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <p className="px-5 pb-5 text-xs leading-relaxed text-slate-600">{f.a}</p>
          </details>
        ))}
      </div>
    </main>
  );
}
