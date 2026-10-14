import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Booking } from "@showbuzz/db/models/Booking";
import { VendorUser } from "@showbuzz/db/models/VendorUser";
import { Types } from "@showbuzz/db/mongoose";
import { bookingCodeSchema } from "@showbuzz/schemas/booking";
import { checkInSchema } from "@showbuzz/schemas/partner-box-office";
import type { CheckInResult } from "@showbuzz/schemas/types/partner-box-office";
import { type TicketVerification, verifyTicketPayload } from "../../booking/ticket-qr";

/**
 * Gate check-in (partner Scan Tickets). A scanned QR is verified by `verifyTicketPayload` (signature, then the
 * booking as it is now) scoped to this vendor, so another vendor's ticket reads as not found. A booking code typed
 * by hand is the fallback when a QR won't scan: it is looked up among this vendor's bookings only.
 *
 * Check-in is one conditional update (`checkedInAt` not set yet), so a ticket can only be admitted once even when
 * two gates scan it together; the second scan answers "already checked in at …".
 */

const REJECTED_MESSAGES: Record<Exclude<TicketVerification, { valid: true }>["reason"], string> = {
  malformed: "This isn't a ShowBuzz ticket QR or booking code.",
  bad_signature: "Forged or damaged QR: the signature doesn't match. Don't admit.",
  not_found: "No booking of yours has this code.",
  not_confirmed: "This booking isn't valid (cancelled or not paid). Don't admit.",
  mismatch: "This QR doesn't match the booking any more (show or seats changed). Ask for the latest ticket.",
};

const rejected = (reason: keyof typeof REJECTED_MESSAGES, code?: string): CheckInResult => ({
  outcome: "rejected",
  reason,
  message: REJECTED_MESSAGES[reason],
  ...(code ? { code } : {}),
});

/** A typed booking code ("SB-123456", any case, spaces ignored) for one of this vendor's bookings. */
async function verifyTypedCode(input: string, vendorId: string): Promise<TicketVerification> {
  const parsed = bookingCodeSchema.safeParse(input.replace(/\s/g, "").toUpperCase());
  if (!parsed.success) return { valid: false, reason: "malformed" };
  await connect();
  const booking = await Booking.findOne({ code: parsed.data, vendorId: new Types.ObjectId(vendorId) }).lean();
  if (!booking) return { valid: false, reason: "not_found", code: parsed.data };
  if (booking.status !== "confirmed") return { valid: false, reason: "not_confirmed", code: parsed.data };
  return {
    valid: true,
    ticket: {
      code: booking.code,
      title: booking.title,
      venueName: booking.venueName,
      ...(booking.screenName ? { screenName: booking.screenName } : {}),
      ...(booking.startsAt ? { startsAt: booking.startsAt.toISOString() } : {}),
      seatLabels: [...booking.seatLabels],
      ticketCount: booking.ticketCount,
    },
  };
}

export async function checkInTicket(
  vendorId: string,
  vendorUserId: string,
  raw: unknown,
  now: Date,
): Promise<CheckInResult> {
  const { input } = checkInSchema.parse(raw);
  if (!Types.ObjectId.isValid(vendorId) || !Types.ObjectId.isValid(vendorUserId)) return rejected("not_found");
  const verification = input.startsWith("SBT")
    ? await verifyTicketPayload(input, { vendorId })
    : await verifyTypedCode(input, vendorId);
  if (!verification.valid) return rejected(verification.reason, verification.code);

  const { ticket } = verification;
  await connect();
  const vendor = new Types.ObjectId(vendorId);
  const admitted = await Booking.findOneAndUpdate(
    { code: ticket.code, vendorId: vendor, status: "confirmed", checkedInAt: { $exists: false } },
    { $set: { checkedInAt: now, checkedInBy: new Types.ObjectId(vendorUserId) } },
    { new: true, projection: { checkedInAt: 1 } },
  ).lean();
  if (admitted?.checkedInAt) {
    return { outcome: "checked_in", ticket, checkedInAt: admitted.checkedInAt.toISOString() };
  }

  // Not updated: already checked in (or cancelled in the meantime).
  const current = await Booking.findOne(
    { code: ticket.code, vendorId: vendor },
    { status: 1, checkedInAt: 1, checkedInBy: 1 },
  ).lean();
  if (!current || current.status !== "confirmed") return rejected("not_confirmed", ticket.code);
  if (!current.checkedInAt) return rejected("not_confirmed", ticket.code);
  const by = current.checkedInBy ? await VendorUser.findById(current.checkedInBy, { name: 1 }).lean() : null;
  return {
    outcome: "already_checked_in",
    ticket,
    checkedInAt: current.checkedInAt.toISOString(),
    ...(by?.name ? { checkedInByName: by.name } : {}),
  };
}
