import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";

/**
 * One seat of one show, either held during checkout or sold. The unique `{ showId, seatId }` index is what
 * prevents double-booking: a hold is an insert, and a second insert for the same seat fails, so there is never
 * a check-then-insert. Held seats carry `expiresAt` (TTL); sold seats don't, so the TTL monitor never removes
 * them. The TTL monitor runs about once a minute, so reads treat `expiresAt <= now` as already free.
 */
export interface SeatHoldAttrs {
  showId: Types.ObjectId;
  /** "C7" */
  seatId: string;
  status: "held" | "sold";
  /** SHA-256 of the browser's hold cookie (see core/booking/hold-cookie.ts). */
  holderKey: string;
  /** Set when an order is placed with these seats; kept when they are sold. */
  bookingId?: Types.ObjectId;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const seatHoldSchema = new Schema<SeatHoldAttrs>(
  {
    showId: { type: Schema.Types.ObjectId, ref: "Show", required: true },
    seatId: { type: String, required: true, match: /^[A-Z]\d{1,2}$/ },
    status: { type: String, enum: ["held", "sold"], required: true, default: "held" },
    holderKey: { type: String, required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
    expiresAt: Date,
  },
  { timestamps: true, versionKey: false },
);

seatHoldSchema.index({ showId: 1, seatId: 1 }, { unique: true });
seatHoldSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
seatHoldSchema.index({ holderKey: 1, status: 1 });
seatHoldSchema.index({ bookingId: 1 });

export const SeatHold: Model<SeatHoldAttrs> =
  (models.SeatHold as Model<SeatHoldAttrs> | undefined) ??
  model<SeatHoldAttrs>("SeatHold", seatHoldSchema, "seatHolds");
