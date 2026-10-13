import Link from "next/link";
import { TicketX } from "lucide-react";
import { EmptyState } from "@/components/public/common/EmptyState";

/** Shown by booking steps while the quote loads, when the cart is empty, or when pricing fails. */
export function QuoteFallback({ state }: { state: { status: "loading" } | { status: "empty" } | { status: "error"; message: string } }) {
  if (state.status === "loading") {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="skeleton h-44" />
          <div className="skeleton h-32" />
        </div>
        <div className="skeleton h-72" />
      </div>
    );
  }
  return (
    <EmptyState
      icon={TicketX}
      title={state.status === "empty" ? "No booking in progress" : "We couldn't price this booking"}
      description={
        state.status === "empty"
          ? "Pick a movie, event or match to start a new booking."
          : state.message
      }
      action={
        <Link
          href="/movies"
          className="gradient-btn tap-active inline-block rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-md"
        >
          Explore Entertainment &rarr;
        </Link>
      }
    />
  );
}
