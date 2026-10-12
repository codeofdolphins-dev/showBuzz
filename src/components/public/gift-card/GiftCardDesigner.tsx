"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ticket } from "lucide-react";
import { Field, inputClass } from "@/components/public/form/Field";
import { GIFT_CARD_PRESETS_PAISE } from "@/config/constants";
import { cn } from "@/lib/cn";
import { formatINR, rupeesToPaise } from "@/lib/money";
import { giftCardOrderSchema, type GiftCardDesign, type GiftCardOrderInput } from "@/schemas/gift-card";
import { useBookingCart } from "@/stores/booking-cart";

export function GiftCardDesigner({ designs }: { designs: GiftCardDesign[] }) {
  const router = useRouter();
  const startTickets = useBookingCart((s) => s.startTickets);
  const [customAmount, setCustomAmount] = useState("");

  const form = useForm<GiftCardOrderInput>({
    resolver: zodResolver(giftCardOrderSchema),
    defaultValues: {
      amountPaise: GIFT_CARD_PRESETS_PAISE[0],
      designId: designs[0]?.id ?? "",
      recipientName: "",
      recipientContact: "",
      message: "Have an awesome blockbuster movie weekend!",
    },
  });
  const { amountPaise, designId, recipientName, message } = useWatch({ control: form.control });
  const design = designs.find((d) => d.id === designId) ?? designs[0];
  const errors = form.formState.errors;

  const submit = form.handleSubmit((giftCard) => {
    startTickets({ kind: "gift-card", giftCard });
    router.push("/booking/checkout");
  });

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
      <div className="space-y-6 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs sm:p-8">
        <h3 className="text-base font-extrabold text-slate-900">Card Preview</h3>
        <div
          className={cn(
            "relative flex aspect-[16/10] flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-tr p-6 text-white shadow-2xl transition-all duration-300",
            design?.gradient,
          )}
        >
          <div className="relative z-10 flex items-center justify-between">
            <span className="flex items-center gap-2 text-lg font-black">
              <Ticket className="h-5 w-5" /> Show<span className="text-rose-200">Buzz</span>
            </span>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase">E-Voucher</span>
          </div>
          <div className="relative z-10">
            <p className="text-[11px] font-bold tracking-widest text-white/80 uppercase">Gift Amount</p>
            <p className="mt-0.5 text-3xl font-black">{formatINR(amountPaise && Number.isFinite(amountPaise) ? amountPaise : 0)}</p>
            <p className="mt-2 line-clamp-1 text-xs text-white/90 italic">&ldquo;{message?.trim() || "Enjoy your gift!"}&rdquo;</p>
          </div>
          <div className="relative z-10 flex items-center justify-between border-t border-white/20 pt-2 text-[10px] text-white/70">
            <span>
              TO: <strong className="text-white">{recipientName?.trim() || "Friend"}</strong>
            </span>
            <span>VALID FOR 1 YEAR</span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 pt-2" role="radiogroup" aria-label="Card design">
          {designs.map((d) => (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={d.id === designId}
              aria-label={d.name}
              onClick={() => form.setValue("designId", d.id)}
              className={cn(
                "aspect-[16/10] overflow-hidden rounded-xl border-2",
                d.id === designId ? "border-rose-500 shadow-sm" : "border-transparent",
              )}
            >
              <span className={cn("block h-full w-full bg-gradient-to-tr", d.gradient)} />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs sm:p-8">
        <h3 className="text-base font-extrabold text-slate-900">Personalize Your Gift</h3>
        <div>
          <span className="mb-2 block text-xs font-bold text-slate-700">Select Voucher Amount</span>
          <div className="mb-3 grid grid-cols-4 gap-2">
            {GIFT_CARD_PRESETS_PAISE.map((paise) => (
              <button
                key={paise}
                type="button"
                onClick={() => {
                  setCustomAmount("");
                  form.setValue("amountPaise", paise, { shouldValidate: true });
                }}
                className={cn(
                  "rounded-xl py-2 text-xs font-bold",
                  !customAmount && amountPaise === paise ? "bg-rose-500 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                )}
              >
                {formatINR(paise)}
              </button>
            ))}
          </div>
          <input
            type="number"
            inputMode="numeric"
            min={250}
            max={10000}
            value={customAmount}
            onChange={(e) => {
              setCustomAmount(e.target.value);
              const rupees = Number(e.target.value);
              if (e.target.value && Number.isFinite(rupees)) form.setValue("amountPaise", rupeesToPaise(Math.floor(rupees)), { shouldValidate: true });
            }}
            placeholder="Or enter custom amount (₹250 - ₹10,000)"
            aria-label="Custom amount in rupees"
            className={cn(inputClass, "text-xs font-semibold")}
          />
          {errors.amountPaise && <p className="mt-1 text-[11px] font-medium text-rose-600">{errors.amountPaise.message}</p>}
        </div>

        <div className="space-y-4 text-xs">
          <Field id="gc-name" label="Recipient Name" error={errors.recipientName?.message}>
            <input id="gc-name" placeholder="e.g. Priya Roy" {...form.register("recipientName")} className={inputClass} />
          </Field>
          <Field id="gc-contact" label="Recipient Email / WhatsApp" error={errors.recipientContact?.message}>
            <input id="gc-contact" placeholder="priya@example.com or mobile number" {...form.register("recipientContact")} className={inputClass} />
          </Field>
          <Field id="gc-message" label="Gift Message (Optional)" error={errors.message?.message}>
            <textarea id="gc-message" maxLength={200} {...form.register("message")} className={cn(inputClass, "h-20 resize-none")} />
          </Field>
        </div>

        <button
          type="submit"
          className="gradient-btn w-full rounded-2xl py-3.5 text-xs font-black text-white shadow-lg shadow-rose-500/20"
        >
          Pay & Send E-Gift Card &rarr;
        </button>
      </div>
    </form>
  );
}
