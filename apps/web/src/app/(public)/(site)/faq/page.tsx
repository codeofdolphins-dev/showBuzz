import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { getSitePage, withSeoOverride } from "@showbuzz/core/services/site-content.service";

/** SEO overrides from the admin console apply over this. */
export function generateMetadata(): Promise<Metadata> {
  return withSeoOverride("/faq", {
    title: "FAQs",
    description: "Answers to common questions about tickets, refunds, coupons and payments.",
  });
}

/** Questions and answers edited in the admin console (Website Pages); the built-in set until published. */
export default async function FaqPage() {
  const { content } = await getSitePage("faq");
  return (
    <main className="w-full flex-1 px-4 py-10 sm:px-6 lg:px-8 xl:px-12">
      <div className="mb-10 text-center">
        {content.eyebrow ? (
          <span className="text-xs font-black tracking-widest text-rose-600 uppercase">{content.eyebrow}</span>
        ) : null}
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">{content.title}</h1>
        {content.intro ? <p className="mt-2 text-xs text-slate-500 sm:text-sm">{content.intro}</p> : null}
      </div>
      <div className="mx-auto max-w-4xl space-y-4">
        {content.items.map((f, i) => (
          <details
            key={`${i}-${f.question}`}
            name="faq"
            className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-sm font-bold text-slate-900 transition-colors hover:text-rose-600 [&::-webkit-details-marker]:hidden">
              <span>{f.question}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <p className="px-5 pb-5 text-xs leading-relaxed whitespace-pre-line text-slate-600">{f.answer}</p>
          </details>
        ))}
      </div>
    </main>
  );
}
