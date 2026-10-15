import "server-only";
import { ActivityLog } from "./ActivityLog";
import { Banner } from "./Banner";
import { Booking } from "./Booking";
import { City } from "./City";
import { Coupon } from "./Coupon";
import { Event } from "./Event";
import { FoodItem } from "./FoodItem";
import { GiftCard } from "./GiftCard";
import { GiftCardDesign } from "./GiftCardDesign";
import { Genre } from "./Genre";
import { Language } from "./Language";
import { Lead } from "./Lead";
import { MediaAsset } from "./MediaAsset";
import { Movie } from "./Movie";
import { Notification } from "./Notification";
import { OtpChallenge } from "./OtpChallenge";
import { Payment } from "./Payment";
import { Plan } from "./Plan";
import { RateLimit } from "./RateLimit";
import { Refund } from "./Refund";
import { Review } from "./Review";
import { Role } from "./Role";
import { SeatHold } from "./SeatHold";
import { SeoMeta } from "./SeoMeta";
import { Settings } from "./Settings";
import { Settlement } from "./Settlement";
import { Show } from "./Show";
import { SitePage } from "./SitePage";
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
  Language,
  Genre,
  Banner,
  SitePage,
  SeoMeta,
  Notification,
  MediaAsset,
];
