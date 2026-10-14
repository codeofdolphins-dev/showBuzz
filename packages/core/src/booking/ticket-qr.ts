import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { toString as qrToString } from "qrcode";
import { connect } from "@showbuzz/db/connect";
import { Booking } from "@showbuzz/db/models/Booking";
import { ticketEnv } from "@showbuzz/runtime/ticket-env";
import { bookingCodeSchema } from "@showbuzz/schemas/booking";

/**
 * M-ticket QR codes. The payload is `SBT1.<claims>.<signature>`: base64url JSON claims (booking code, show,
 * seats or passes, issue time) and a base64url HMAC-SHA256 over "SBT1.<claims>" with QR_SIGNING_SECRET.
 * The signature proves the ticket was issued by ShowBuzz; the gate still checks the booking itself, so a
 * cancelled booking's QR never verifies as valid.
 */

const VERSION = "SBT1";
const MAX_PAYLOAD_LENGTH = 1024;

interface TicketClaims {
  /** Booking code, "SB-123456". */
  c: string;
  /** Show id (seated and pass bookings). */
  s?: string;
  /** Seats ("C7") or passes ("2 × VIP Pass"). */
  t: string[];
  /** Issued at (confirmation time), Unix seconds. */
  i: number;
}

/** The booking fields a ticket is made from (BookingView has them all). */
export interface TicketSource {
  code: string;
  showId?: string;
  seatLabels: string[];
  /** ISO time the booking was confirmed. */
  bookedAt: string;
}

function sign(data: string): string {
  return createHmac("sha256", ticketEnv.QR_SIGNING_SECRET).update(data).digest("base64url");
}

/** Deterministic for a booking (issue time = confirmation time), so the QR is the same on every page load. */
export function signTicketPayload(ticket: TicketSource): string {
  const claims: TicketClaims = {
    c: ticket.code,
    ...(ticket.showId ? { s: ticket.showId } : {}),
    t: ticket.seatLabels,
    i: Math.floor(new Date(ticket.bookedAt).getTime() / 1000),
  };
  const body = `${VERSION}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}`;
  return `${body}.${sign(body)}`;
}

/** The ticket's QR as an SVG string (rendered on the server; contains no script). */
export async function renderTicketQrSvg(ticket: TicketSource): Promise<string> {
  return qrToString(signTicketPayload(ticket), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#0F172AFF", light: "#FFFFFFFF" },
  });
}

export type TicketVerification =
  | {
      valid: true;
      ticket: {
        code: string;
        title: string;
        venueName: string;
        screenName?: string;
        startsAt?: string;
        seatLabels: string[];
        ticketCount: number;
      };
    }
  | { valid: false; reason: "malformed" | "bad_signature" | "not_found" | "not_confirmed" | "mismatch"; code?: string };

function parseClaims(encoded: string): TicketClaims | undefined {
  try {
    const value: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (typeof value !== "object" || value === null) return undefined;
    const claims = value as Partial<TicketClaims>;
    if (!bookingCodeSchema.safeParse(claims.c).success) return undefined;
    if (!Array.isArray(claims.t) || !claims.t.every((x) => typeof x === "string")) return undefined;
    if (typeof claims.i !== "number" || (claims.s !== undefined && typeof claims.s !== "string")) return undefined;
    return claims as TicketClaims;
  } catch {
    return undefined;
  }
}

/**
 * Checks a scanned payload: signature first (constant-time), then the booking as it is now. Valid only for a
 * confirmed booking whose show and seats still match the ticket. For the gate scanners (partner Scan Tickets, the
 * admin scan-qr screen). With `vendorId`, another vendor's ticket answers `not_found`, exactly like a missing one.
 */
export async function verifyTicketPayload(
  payload: string,
  options: { vendorId?: string } = {},
): Promise<TicketVerification> {
  if (payload.length > MAX_PAYLOAD_LENGTH) return { valid: false, reason: "malformed" };
  const parts = payload.trim().split(".");
  if (parts.length !== 3 || parts[0] !== VERSION || !parts[1] || !parts[2])
    return { valid: false, reason: "malformed" };

  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { valid: false, reason: "bad_signature" };
  }

  const claims = parseClaims(parts[1]);
  if (!claims) return { valid: false, reason: "malformed" };

  await connect();
  const booking = await Booking.findOne({ code: claims.c }).lean();
  if (!booking || (options.vendorId && booking.vendorId?.toString() !== options.vendorId)) {
    return { valid: false, reason: "not_found", code: claims.c };
  }
  if (booking.status !== "confirmed") return { valid: false, reason: "not_confirmed", code: claims.c };
  const sameShow = (booking.showId?.toString() ?? undefined) === claims.s;
  const sameSeats =
    booking.seatLabels.length === claims.t.length && booking.seatLabels.every((s, i) => s === claims.t[i]);
  if (!sameShow || !sameSeats) return { valid: false, reason: "mismatch", code: claims.c };

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
