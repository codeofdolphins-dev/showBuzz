import "server-only";
import { ActivityLog } from "./ActivityLog";
import { Booking } from "./Booking";
import { City } from "./City";
import { Coupon } from "./Coupon";
import { Event } from "./Event";
import { FoodItem } from "./FoodItem";
import { GiftCard } from "./GiftCard";
import { GiftCardDesign } from "./GiftCardDesign";
import { Lead } from "./Lead";
import { Movie } from "./Movie";
import { OtpChallenge } from "./OtpChallenge";
import { Payment } from "./Payment";
import { Plan } from "./Plan";
import { RateLimit } from "./RateLimit";
import { Refund } from "./Refund";
import { Review } from "./Review";
import { Role } from "./Role";
import { SeatHold } from "./SeatHold";
import { Settings } from "./Settings";
import { Settlement } from "./Settlement";
import { Show } from "./Show";
import { Staff } from "./Staff";
import { StreamTitle } from "./StreamTitle";
import { SubscriptionInvoice } from "./SubscriptionInvoice";
import { User } from "./User";
import { Vendor } from "./Vendor";
import { VendorMovie } from "./VendorMovie";
import { VendorUser } from "./VendorUser";
import { Venue } from "./Venue";
import { WishlistItem } from "./WishlistItem";

/** Every model, for index syncing. Add new models here. */
export const allModels = [
  User,
  OtpChallenge,
  RateLimit,
  Staff,
  Role,
  Vendor,
  VendorUser,
  Plan,
  City,
  Movie,
  Venue,
  Event,
  StreamTitle,
  Coupon,
  FoodItem,
  GiftCardDesign,
  Show,
  Settings,
  SeatHold,
  Booking,
  Payment,
  Refund,
  Review,
  Lead,
  WishlistItem,
  GiftCard,
  ActivityLog,
  VendorMovie,
  Settlement,
  SubscriptionInvoice,
];
