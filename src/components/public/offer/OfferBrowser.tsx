"use client";

import { useState } from "react";
import { Clock, Copy, Crown, CreditCard, Popcorn, Smartphone, Tags, type LucideIcon } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/dates";
import type { Coupon, OfferIcon } from "@/schemas/offer";
import { toast } from "@/stores/ui";

const ICONS: Record<OfferIcon, LucideIcon> = {
  tags: Tags,
  "credit-card": CreditCard,
  smartphone: Smartphone,
  popcorn: Popcorn,
  crown: Crown,
};

const TABS = [
  { value: "All", label: "All Offers" },
  { value: "First Time Users", label: "First Time Users" },
  { value: "Credit Cards", label: "Bank Cards" },
  { value: "UPI", label: "UPI & Wallets" },
  { value: "Food Combos", label: "F&B Perks" },
];

export function OfferBrowser({ offers }: { offers: Coupon[] }) {
  const [tab, setTab] = useState("All");
  const [termsFor, setTermsFor] = useState<Coupon | null>(null);
  const visible = tab === "All" ? offers : offers.filter((o) => o.category === tab);

  const copy = async (code: string) => {
    await navigator.clipboard?.writeText(code);
    toast(`Coupon code "${code}" copied to clipboard!`, "success");
  };

  return (
    <>
      <div className="no-scrollbar mb-8 flex items-center gap-2 overflow-x-auto pb-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap",
              tab === t.value ? "bg-rose-500 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((o) => {
          const Icon = ICONS[o.icon];
          return (
            <article
              key={o.id}
              className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs transition-all hover:border-rose-300"
            >
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr text-white shadow-sm", o.gradient)}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-slate-600 uppercase">
                    {o.category}
                  </span>
                </div>
                <h3 className="text-base leading-snug font-black text-slate-900">{o.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{o.description}</p>
                <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                  <Clock className="h-3 w-3" /> Valid till {formatDateShort(new Date(o.validUntil))}
                </p>
              </div>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <div className="flex flex-1 items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-1.5">
                  <span className="font-mono text-xs font-black tracking-wider text-slate-800">{o.code}</span>
                  <button type="button" onClick={() => copy(o.code)} aria-label={`Copy ${o.code}`} className="text-rose-600 hover:text-rose-700">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setTermsFor(o)}
                  className="text-xs font-bold text-slate-500 underline hover:text-slate-800"
                >
                  T&amp;C
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <Modal open={!!termsFor} onClose={() => setTermsFor(null)} title={termsFor ? `${termsFor.title} - Terms` : ""} sheetOnMobile={false}>
        <ul className="list-disc space-y-2 pl-5 text-xs text-slate-600">
          {termsFor?.terms.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setTermsFor(null)}
          className="mt-5 w-full rounded-2xl bg-slate-100 py-3 text-xs font-bold text-slate-800 hover:bg-slate-200"
        >
          Got it, thanks!
        </button>
      </Modal>
    </>
  );
}
