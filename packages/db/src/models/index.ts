import "server-only";
import { Booking } from "./Booking";
import { City } from "./City";
import { Coupon } from "./Coupon";
import { Event } from "./Event";
import { FoodItem } from "./FoodItem";
import { GiftCardDesign } from "./GiftCardDesign";
import { Lead } from "./Lead";
import { Movie } from "./Movie";
import { OtpChallenge } from "./OtpChallenge";
import { Payment } from "./Payment";
import { RateLimit } from "./RateLimit";
import { Refund } from "./Refund";
import { Review } from "./Review";
import { Role } from "./Role";
import { SeatHold } from "./SeatHold";
import { Settings } from "./Settings";
import { Show } from "./Show";
import { Staff } from "./Staff";
import { StreamTitle } from "./StreamTitle";
import { User } from "./User";
import { Venue } from "./Venue";
import { WishlistItem } from "./WishlistItem";

/** Every model, for index syncing. Add new models here. */
export const allModels = [
  User,
  OtpChallenge,
  RateLimit,
  Staff,
  Role,
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
];
