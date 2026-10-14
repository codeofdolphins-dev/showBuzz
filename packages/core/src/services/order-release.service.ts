import "server-only";
import { connect } from "@showbuzz/db/connect";
import { Booking, type BookingAttrs } from "@showbuzz/db/models/Booking";
import { SeatHold } from "@showbuzz/db/models/SeatHold";
import { Show } from "@showbuzz/db/models/Show";
import type { Types } from "@showbuzz/db/mongoose";
import type { BookingStatus } from "@showbuzz/schemas/types/booking";

/**
 * Ending unpaid orders and giving their inventory back. Split from booking.service so the partner portal (which must
 * not import the cached catalogue reads) can release lapsed pass reservations before changing a tier's capacity.
 */

type LeanBooking = BookingAttrs & { _id: Types.ObjectId };

/**
 * Ends an unpaid order (`payment_failed` or `expired`) and gives its inventory back. Conditional on the order
 * still being pending, so only one caller ever releases it. Seat holds are deleted only when asked: a superseded
 * or lapsed order may share seats the browser has since re-held for a newer order.
 */
export async function closeOrder(
  booking: LeanBooking,
  status: Extract<BookingStatus, "payment_failed" | "expired">,
  reason: string,
  { releaseSeats }: { releaseSeats: boolean },
): Promise<void> {
  const mongoose = await connect();
  await mongoose.connection.transaction(async (session) => {
    const closed = await Booking.updateOne(
      { _id: booking._id, status: "pending_payment" },
      { $set: { status, failureReason: reason } },
      { session },
    );
    if (closed.modifiedCount !== 1) return;
    if (releaseSeats) await SeatHold.deleteMany({ bookingId: booking._id, status: "held" }, { session });
    if (booking.showId && booking.tierId && booking.quantity) {
      await Show.updateOne(
        { _id: booking.showId, "inventory.tierId": booking.tierId },
        { $inc: { "inventory.$.remaining": booking.quantity } },
        { session },
      );
    }
  });
}

/** Gives back tier passes held by orders whose payment window lapsed (run before reading or reserving them). */
export async function releaseLapsedOrders(showId: Types.ObjectId | string, now: Date): Promise<void> {
  await connect();
  const lapsed = await Booking.find({ showId, status: "pending_payment", holdExpiresAt: { $lte: now } })
    .limit(50)
    .lean();
  for (const booking of lapsed) {
    await closeOrder(booking, "expired", "The payment window expired.", { releaseSeats: false });
  }
}

