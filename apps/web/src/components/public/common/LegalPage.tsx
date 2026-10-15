import type { LegalContent } from "@showbuzz/schemas/site-content";

interface LegalPageProps {
  content: LegalContent;
  updated: string;
}

/** Privacy / Terms layout: numbered sections of paragraphs and an optional bullet list (content edited in admin). */
export function LegalPage({ content, updated }: LegalPageProps) {
  return (
    <main className="w-full flex-1 px-4 py-10 sm:px-6 lg:px-8 xl:px-12">
      <article className="space-y-6 rounded-3xl border border-slate-200/80 bg-white p-8 text-xs leading-relaxed text-slate-600 shadow-xs sm:p-12">
        <h1 className="border-b border-slate-100 pb-4 text-2xl font-black text-slate-900 sm:text-3xl">
          {content.title}
        </h1>
        <p className="text-slate-400">Last updated: {updated}</p>
        {content.sections.map((s, i) => (
          <section key={`${i}-${s.heading}`} className="space-y-2">
            <h2 className="text-sm font-bold text-slate-900">
              {i + 1}. {s.heading}
            </h2>
            {s.paragraphs.map((p, j) => (
              <p key={j}>{p}</p>
            ))}
            {s.bullets.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5">
                {s.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </article>
    </main>
  );
}
