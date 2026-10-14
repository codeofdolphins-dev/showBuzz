import type { Metadata } from "next";
import Link from "next/link";
import { BadgeIndianRupee, Megaphone, QrCode, Store } from "lucide-react";
import { getCurrentVendor } from "@showbuzz/core/auth/partner/current-vendor";
import { listCityOptions } from "@showbuzz/core/services/partner/onboarding.service";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: "Become a partner" };

const BENEFITS = [
  {
    icon: Megaphone,
    title: "Reach ShowBuzz audiences",
    text: "List films, concerts, plays, sports and activities in front of customers in your city.",
  },
  {
    icon: QrCode,
    title: "QR tickets at the gate",
    text: "Every booking gets a signed M-ticket you can scan at entry from the partner portal.",
  },
  {
    icon: BadgeIndianRupee,
    title: "Your prices, your policy",
    text: "Set seat prices, offers and your own cancellation policy; track sales and payouts.",
  },
];

/**
 * Partner signup (no prototype page: admin design, list-your-show.html tone). Creates the vendor and its owner
 * login after the mobile number is verified, then onboarding collects KYC.
 */
export default async function SignupPage() {
  if (await getCurrentVendor()) redirect("/onboarding");
  const cities = await listCityOptions();

  return (
    <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-admin-border bg-white shadow-modal lg:grid-cols-5">
      <aside className="space-y-6 bg-admin-dark p-8 text-white lg:col-span-2">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
            <Store className="h-5 w-5" aria-hidden />
          </span>
          <span className="leading-tight">
            <span className="block text-base font-black">ShowBuzz</span>
            <span className="block text-[10px] font-bold tracking-wider text-admin-coral uppercase">Partner</span>
          </span>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-bold tracking-wider text-indigo-200 uppercase">
            Partner platform for cinemas & organisers
          </p>
          <h1 className="text-2xl leading-tight font-black">List your shows and sell out every seat</h1>
          <p className="text-xs text-indigo-100">
            Create your partner account in minutes. After a quick KYC (GSTIN, PAN, bank account and documents) your
            listings go live straight away.
          </p>
        </div>
        <ul className="space-y-4">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span>
                <span className="block text-xs font-bold">{title}</span>
                <span className="block text-[11px] text-indigo-100">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </aside>
      <section className="space-y-5 p-6 sm:p-8 lg:col-span-3">
        <div>
          <h2 className="text-xl font-black tracking-tight text-admin-dark">Create your partner account</h2>
          <p className="text-xs text-admin-muted">
            Already a partner?{" "}
            <Link href="/login" className="font-bold text-admin-indigo hover:underline">
              Sign in
            </Link>
          </p>
        </div>
        <SignupForm cities={cities} />
      </section>
    </div>
  );
}
