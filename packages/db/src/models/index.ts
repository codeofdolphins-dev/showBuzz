import "server-only";
import { City } from "./City";
import { Coupon } from "./Coupon";
import { Event } from "./Event";
import { FoodItem } from "./FoodItem";
import { GiftCardDesign } from "./GiftCardDesign";
import { Movie } from "./Movie";
import { OtpChallenge } from "./OtpChallenge";
import { RateLimit } from "./RateLimit";
import { Role } from "./Role";
import { Settings } from "./Settings";
import { Show } from "./Show";
import { Staff } from "./Staff";
import { StreamTitle } from "./StreamTitle";
import { User } from "./User";
import { Venue } from "./Venue";

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
];
