import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { X } from "lucide-react";

export const metadata: Metadata = { title: "Payment Unsuccessful", robots: { index: false } };

const REASONS: Record<string, string> = {
  NOT_CONFIGURED: "Online payments are not live yet",
  NOT_FOUND: "The show is no longer available",
  VALIDATION_FAILED: "Some booking details were invalid",
  INTERNAL: "Payment gateway error",
};

async function Reason({ searchParams }: Pick<PageProps<"/booking/failure">, "searchParams">) {
  const { reason } = await searchParams;
  const code = Array.isArray(reason) ? reason[0] : reason;
  return (
    <div className="my-6 space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left text-xs">
      <div className="flex justify-between gap-4 text-slate-500">
        <span>Error Reason:</span>
        <span className="text-right font-bold text-rose-600">
          {(code && REASONS[code]) ?? "The payment could not be completed"}
        </span>
      </div>
      {code && (
        <div className="flex justify-between text-slate-500">
          <span>Reference:</span>
          <span className="font-mono font-bold text-slate-800">{code.slice(0, 40)}</span>
        </div>
      )}
    </div>
  );
}

export default function BookingFailurePage({ searchParams }: PageProps<"/booking/failure">) {
  return (
    <main className="flex w-full flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8 xl:px-12">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl sm:p-10">
        <span className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 text-rose-600 shadow-lg shadow-rose-500/20">
          <X className="h-9 w-9" />
        </span>
        <span className="text-xs font-black tracking-widest text-rose-600 uppercase">Transaction Failed</span>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Payment Unsuccessful</h1>
        <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-sm">
          We couldn&apos;t process your payment. If any amount was debited from your bank account or UPI wallet, it will
          be automatically refunded within 24-48 business hours.
        </p>
        <Suspense fallback={<div className="my-6 h-16 skeleton" />}>
          <Reason searchParams={searchParams} />
        </Suspense>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/booking/payment"
            className="flex-1 gradient-btn rounded-2xl py-3.5 text-xs font-black text-white shadow-lg shadow-rose-500/20"
          >
            Retry Payment &rarr;
          </Link>
          <Link
            href="/"
            className="flex-1 rounded-2xl bg-slate-100 py-3.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200"
          >
            Back to Homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
