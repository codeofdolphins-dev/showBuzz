import { Gift } from "lucide-react";
import { cn } from "@showbuzz/utils/cn";
import { formatDateLong } from "@showbuzz/utils/dates";
import { formatINR } from "@showbuzz/utils/money";
import type { GiftCardSummary } from "@showbuzz/schemas/types/gift-card";

const STATUS_STYLE: Record<GiftCardSummary["status"], string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  redeemed: "bg-slate-100 text-slate-500 border-slate-200",
  expired: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-rose-50 text-rose-600 border-rose-200",
};

/**
 * A purchased gift card for its buyer: code, balance, status and expiry. No email/SMS provider exists yet,
 * so the buyer passes the code on themselves (stand-in, see CLAUDE.md §12).
 */
export function IssuedGiftCard({ card, compact = false }: { card: GiftCardSummary; compact?: boolean }) {
  return (
    <div className={cn("w-full space-y-3", !compact && "text-left")}>
      <div className={cn("rounded-2xl bg-gradient-to-tr p-4 text-white shadow-md", card.gradient ?? "from-rose-500 to-purple-600")}>
        <div className="flex items-center justify-between text-[10px] font-bold tracking-widest uppercase opacity-90">
          <span className="flex items-center gap-1.5">
            <Gift className="h-3.5 w-3.5" /> ShowBuzz E-Gift Card
          </span>
          <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-black", STATUS_STYLE[card.status])}>
            {card.status}
          </span>
        </div>
        <p className="mt-3 font-mono text-base font-black tracking-wider select-all sm:text-lg">{card.code}</p>
        <div className="mt-2 flex items-end justify-between text-xs">
          <span>
            Balance <strong className="text-base">{formatINR(card.balancePaise, { exact: true })}</strong>
            <span className="opacity-80"> / {formatINR(card.amountPaise)}</span>
          </span>
          <span className="text-[10px] opacity-90">Valid till {formatDateLong(new Date(card.expiresAt))}</span>
        </div>
      </div>
      {!compact && (
        <p className="text-[11px] leading-relaxed text-slate-500">
          For <strong className="text-slate-700">{card.recipientName}</strong> ({card.recipientContact}). Delivery by
          email or SMS isn&apos;t live yet, so please share this code with them. Anyone with the code can spend the
          balance.
        </p>
      )}
    </div>
  );
}
