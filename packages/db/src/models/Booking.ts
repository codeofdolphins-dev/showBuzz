import "server-only";
import { type Model, Schema, type Types, model, models } from "mongoose";
import type { BookingPaymentMethod, ContactDetails } from "@showbuzz/schemas/booking";
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
 *
 * Counter sales (partner box office, `channel: "counter"`) have no customer account (`userId` absent), are paid in
 * cash or UPI at the counter (recorded, no gateway) and are confirmed at once. `checkedInAt` is set once, at the gate.
 */
export interface BookingAttrs {
  /** "SB-123456", shown to customers. */
  code: string;
  /** The customer account. Absent only on counter sales (walk-in customers have no account). */
  userId?: Types.ObjectId;
  /** Where it was sold (missing = online). */
  channel?: BookingChannel;
  /** Online orders: the device class of the browser that placed it (audience analytics; missing on older orders). */
  device?: "mobile" | "tablet" | "desktop";
  /** Counter sales: the vendor login that sold it. */
  soldByVendorUserId?: Types.ObjectId;
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
  /** The coupon's `usedCount` was increased when this booking was confirmed (given back if it is cancelled). */
  couponUseCounted?: boolean;
  /** Gift card paying `amounts.giftCardPaise` of this order (balance deducted when the payment is confirmed). */
  giftCardId?: Types.ObjectId;
  paymentMethod: BookingPaymentMethod;
  /** Counter sales may have no phone/email (walk-in), so every field is optional there. */
  contact: Partial<ContactDetails>;
  /** Pay before this or the order lapses (the seat holds expire at the same moment). */
  holdExpiresAt: Date;
  cancellable: boolean;
  confirmedAt?: Date;
  cancelledAt?: Date;
  /** Who cancelled (missing on older bookings = the customer). */
  cancelledBy?: "customer" | "vendor" | "staff";
  /** Vendor cancellations: the reason given (required after the cutoff); staff cancellations always have one. */
  cancelReason?: string;
  /** Staff cancellations (admin bookings oversight): who cancelled. */
  cancelledByStaffId?: Types.ObjectId;
  refundPaise?: number;
  failureReason?: string;
  /** Gate check-in (partner Scan Tickets): set once, by one atomic update. */
  checkedInAt?: Date;
  /** The vendor login that checked the ticket in. */
  checkedInBy?: Types.ObjectId;
  /** The vendor payout that included this booking (set once, in the payout transaction). */
  settlementId?: Types.ObjectId;
  /**
   * The later payout that took the vendor share back, because the booking was cancelled after a payout had
   * already included it.
   */
  clawbackSettlementId?: Types.ObjectId;
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
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: function (this: BookingAttrs) {
        return this.channel !== "counter";
      },
    },
    channel: { type: String, enum: ["online", "counter"] },
    device: { type: String, enum: ["mobile", "tablet", "desktop"] },
    soldByVendorUserId: { type: Schema.Types.ObjectId, ref: "VendorUser" },
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
    couponUseCounted: Boolean,
    giftCardId: { type: Schema.Types.ObjectId, ref: "GiftCard" },
    paymentMethod: {
      type: String,
      enum: ["upi", "card", "netbanking", "wallet", "counter_cash", "counter_upi"],
      required: true,
    },
    contact: { name: String, phone: String, email: String },
    holdExpiresAt: { type: Date, required: true },
    cancellable: { type: Boolean, default: false },
    confirmedAt: Date,
    cancelledAt: Date,
    cancelledBy: { type: String, enum: ["customer", "vendor", "staff"] },
    cancelReason: String,
    cancelledByStaffId: { type: Schema.Types.ObjectId, ref: "Staff" },
    refundPaise: Number,
    failureReason: String,
    checkedInAt: Date,
    checkedInBy: { type: Schema.Types.ObjectId, ref: "VendorUser" },
    settlementId: { type: Schema.Types.ObjectId, ref: "Settlement" },
    clawbackSettlementId: { type: Schema.Types.ObjectId, ref: "Settlement" },
  },
  { timestamps: true, versionKey: false },
);

bookingSchema.index({ code: 1 }, { unique: true });
bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ vendorId: 1, createdAt: -1 });
// Partner bookings list by show date and the earnings report by confirmation time.
bookingSchema.index({ vendorId: 1, startsAt: -1 });
bookingSchema.index({ vendorId: 1, confirmedAt: 1 });
// Payouts: a vendor's confirmed bookings not yet in a payout, by show date; and cancelled ones to claw back.
bookingSchema.index({ vendorId: 1, status: 1, settlementId: 1, startsAt: 1 });
// Finds orders whose payment window lapsed so their tier passes can be given back.
bookingSchema.index({ status: 1, holdExpiresAt: 1 });
// Admin bookings oversight (all vendors, newest first).
bookingSchema.index({ createdAt: -1 });
// Dashboards and reports across vendors: bookings sold in a period, newest first.
bookingSchema.index({ status: 1, confirmedAt: -1 });

export type BookingChannel = "online" | "counter";

type LeanBooking = BookingAttrs & { _id: { toString(): string } };

/** Server-side record (still holds `userId`; services strip it before anything reaches the browser). */
export function toBookingRecord(doc: LeanBooking): BookingRecord {
  return {
    code: doc.code,
    userId: doc.userId?.toString() ?? "",
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
    contact: { name: doc.contact.name ?? "", phone: doc.contact.phone ?? "", email: doc.contact.email ?? "" },
    bookedAt: (doc.confirmedAt ?? doc.createdAt).toISOString(),
    cancellable: doc.cancellable,
    ...(doc.cancelledAt ? { cancelledAt: doc.cancelledAt.toISOString() } : {}),
    ...(doc.refundPaise !== undefined && doc.refundPaise !== null ? { refundPaise: doc.refundPaise } : {}),
    ...(doc.failureReason ? { failureReason: doc.failureReason } : {}),
  };
}

export const Booking: Model<BookingAttrs> =
  (models.Booking as Model<BookingAttrs> | undefined) ?? model<BookingAttrs>("Booking", bookingSchema, "bookings");
