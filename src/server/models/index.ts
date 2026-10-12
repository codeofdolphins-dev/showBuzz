import "server-only";
import { OtpChallenge } from "./OtpChallenge";
import { RateLimit } from "./RateLimit";
import { User } from "./User";

/** Every model, for index syncing. Add new models here. */
export const allModels = [User, OtpChallenge, RateLimit];
