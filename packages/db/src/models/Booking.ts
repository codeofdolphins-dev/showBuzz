import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";
import type { ContactDetails, PaymentMethod } from "@showbuzz/schemas/booking";
import type { GiftCardOrderInput } from "@showbuzz/schemas/gift-card";
import type { CancellationPolicy } from "@showbuzz/schemas/vendor";
import type { BookingSettlement } from "@showbuzz/schemas/types/vendor";
import type {
  BookingKind,
  BookingRecord,
  BookingStatus,
  OrderAmounts,
  QuoteFoodLine,
} from "@showbuzz/schemas/types/booking";

/**
 * An order and, once paid, the ticket. Created as `pending_payment` with its seats held (or tier passes reserved)
 * until `holdExpiresAt`; payment confirmation turns it `confirmed` in a transaction. The display fields are a
 * snapshot taken when the order was placed, so later catalogue edits never change an issued ticket.
 *
 * Marketplace: `vendorId` is the seller (the show's vendor). `settlement` freezes the money split and
 * `cancellationPolicy` the vendor's terms at purchase, so later rate or policy changes never touch a sold ticket.
 * Gift card purchases are platform sales: no vendor, settlement or policy.
 */
export interface BookingAttrs {
  /** "SB-123456", shown to customers. */
  code: string;
  userId: Types.ObjectId;
  /** Seller. Missing only on gift card purchases. */
  vendorId?: Types.ObjectId;
  status: BookingStatus;
  kind: BookingKind;
  showId?: Types.ObjectId;
  /** Seated bookings. */
  seatIds: string[];
  /** Pass bookings (tier inventory on the show). */
  eventId?: Types.ObjectId;
  tierId?: string;
  quantity?: number;
  /** Gift card orders (fulfilled in the gift card batch). */
  giftCard?: Omit<GiftCardOrderInput, "message"> & { message?: string };
  title: string;
  poster: string;
  certificate?: string;
  format?: string;
  language?: string;
  venueName: string;
  screenName?: string;
  startsAt?: Date;
  scheduleLabel: string;
  ticketLabel: string;
  seatLabels: string[];
  ticketCount: number;
  food: QuoteFoodLine[];
  amounts: OrderAmounts;
  settlement?: BookingSettlement;
  /** The vendor's policy when the order was placed (venue opt-out already applied to `cancellable`). */
  cancellationPolicy?: CancellationPolicy;
  couponCode?: string;
  /** Gift card paying `amounts.giftCardPaise` of this order (balance deducted when the payment is confirmed). */
  giftCardId?: Types.ObjectId;
  paymentMethod: PaymentMethod;
  contact: ContactDetails;
  /** Pay before this or the order lapses (the seat holds expire at the same moment). */
  holdExpiresAt: Date;
  cancellable: boolean;
  confirmedAt?: Date;
  cancelledAt?: Date;
  refundPaise?: number;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const foodLineSchema = new Schema(
  { foodItemId: String, name: String, quantity: Number, unitPricePaise: Number, totalPaise: Number },
  { _id: false },
);
const amountsSchema = new Schema(
  {
    ticketsPaise: Number,
    foodPaise: Number,
    convenienceFeePaise: Number,
    gstPaise: Number,
    discountPaise: Number,
    totalPaise: Number,
    giftCardPaise: { type: Number, default: 0 },
    payablePaise: Number,
  },
  { _id: false },
);
const settlementSchema = new Schema(
  {
    billingModel: { type: String, enum: ["subscription", "commission"], required: true },
    commissionBps: { type: Number, required: true },
    convenienceFeeBps: { type: Number, required: true },
    gstBps: { type: Number, required: true },
    subtotalPaise: { type: Number, required: true },
    discountPaise: { type: Number, required: true },
    convenienceFeePaise: { type: Number, required: true },
    gstPaise: { type: Number, required: true },
    totalPaise: { type: Number, required: true },
    commissionPaise: { type: Number, required: true },
    vendorSharePaise: { type: Number, required: true },
  },
  { _id: false },
);
const cancellationPolicySchema = new Schema(
  { allowed: Boolean, cutoffMinutes: Number, feePaise: Number },
  { _id: false },
);
const giftCardSchema = new Schema(
  { amountPaise: Number, designId: String, recipientName: String, recipientContact: String, message: String },
  { _id: false },
);

const bookingSchema = new Schema<BookingAttrs>(
  {
    code: { type: String, required: true, match: /^SB-\d{6}$/ },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: function (this: BookingAttrs) {
        return this.kind !== "gift-card";
      },
    },
    status: {
      type: String,
      enum: ["pending_payment", "confirmed", "payment_failed", "expired", "cancelled"],
      required: true,
    },
    kind: { type: String, enum: ["movie", "sport", "event", "play", "activity", "gift-card"], required: true },
    showId: { type: Schema.Types.ObjectId, ref: "Show" },
    seatIds: { type: [String], default: [] },
    eventId: { type: Schema.Types.ObjectId, ref: "Event" },
    tierId: String,
    quantity: Number,
    giftCard: giftCardSchema,
    title: { type: String, required: true },
    poster: { type: String, required: true },
    certificate: String,
    format: String,
    language: String,
    venueName: { type: String, required: true },
    screenName: String,
    startsAt: Date,
    scheduleLabel: { type: String, required: true },
    ticketLabel: { type: String, required: true },
    seatLabels: { type: [String], default: [] },
    ticketCount: { type: Number, required: true, min: 1 },
    food: { type: [foodLineSchema], default: [] },
    amounts: { type: amountsSchema, required: true },
    settlement: settlementSchema,
    cancellationPolicy: cancellationPolicySchema,
    couponCode: String,
    giftCardId: { type: Schema.Types.ObjectId, ref: "GiftCard" },
    paymentMethod: { type: String, enum: ["upi", "card", "netbanking", "wallet"], required: true },
    contact: { name: String, phone: String, email: String },
    holdExpiresAt: { type: Date, required: true },
    cancellable: { type: Boolean, default: false },
    confirmedAt: Date,
    cancelledAt: Date,
    refundPaise: Number,
    failureReason: String,
  },
  { timestamps: true, versionKey: false },
);

bookingSchema.index({ code: 1 }, { unique: true });
bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ vendorId: 1, createdAt: -1 });
// Finds orders whose payment window lapsed so their tier passes can be given back.
bookingSchema.index({ status: 1, holdExpiresAt: 1 });

type LeanBooking = BookingAttrs & { _id: { toString(): string } };

/** Server-side record (still holds `userId`; services strip it before anything reaches the browser). */
export function toBookingRecord(doc: LeanBooking): BookingRecord {
  return {
    code: doc.code,
    userId: doc.userId.toString(),
    status: doc.status,
    kind: doc.kind,
    ...(doc.showId ? { showId: doc.showId.toString() } : {}),
    title: doc.title,
    poster: doc.poster,
    ...(doc.certificate ? { certificate: doc.certificate } : {}),
    ...(doc.format ? { format: doc.format } : {}),
    ...(doc.language ? { language: doc.language } : {}),
    venueName: doc.venueName,
    ...(doc.screenName ? { screenName: doc.screenName } : {}),
    ...(doc.startsAt ? { startsAt: doc.startsAt.toISOString() } : {}),
    scheduleLabel: doc.scheduleLabel,
    ticketLabel: doc.ticketLabel,
    seatLabels: [...doc.seatLabels],
    ticketCount: doc.ticketCount,
    food: doc.food.map((f) => ({
      foodItemId: f.foodItemId,
      name: f.name,
      quantity: f.quantity,
      unitPricePaise: f.unitPricePaise,
      totalPaise: f.totalPaise,
    })),
    amounts: {
      ticketsPaise: doc.amounts.ticketsPaise,
      foodPaise: doc.amounts.foodPaise,
      convenienceFeePaise: doc.amounts.convenienceFeePaise,
      gstPaise: doc.amounts.gstPaise,
      discountPaise: doc.amounts.discountPaise,
      totalPaise: doc.amounts.totalPaise,
      // Bookings made before gift cards existed have neither field: all of it was paid at the gateway.
      giftCardPaise: doc.amounts.giftCardPaise ?? 0,
      payablePaise: doc.amounts.payablePaise ?? doc.amounts.totalPaise - (doc.amounts.giftCardPaise ?? 0),
    },
    ...(doc.couponCode ? { couponCode: doc.couponCode } : {}),
    ...(doc.cancellationPolicy
      ? {
          cancellationPolicy: {
            allowed: doc.cancellationPolicy.allowed,
            cutoffMinutes: doc.cancellationPolicy.cutoffMinutes,
            feePaise: doc.cancellationPolicy.feePaise,
          },
        }
      : {}),
    paymentMethod: doc.paymentMethod,
    contact: { name: doc.contact.name, phone: doc.contact.phone, email: doc.contact.email },
    bookedAt: (doc.confirmedAt ?? doc.createdAt).toISOString(),
    cancellable: doc.cancellable,
    ...(doc.cancelledAt ? { cancelledAt: doc.cancelledAt.toISOString() } : {}),
    ...(doc.refundPaise !== undefined && doc.refundPaise !== null ? { refundPaise: doc.refundPaise } : {}),
    ...(doc.failureReason ? { failureReason: doc.failureReason } : {}),
  };
}

export const Booking: Model<BookingAttrs> =
  (models.Booking as Model<BookingAttrs> | undefined) ?? model<BookingAttrs>("Booking", bookingSchema, "bookings");
