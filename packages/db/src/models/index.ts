import "server-only";
import { OtpChallenge } from "./OtpChallenge";
import { RateLimit } from "./RateLimit";
import { Role } from "./Role";
import { Staff } from "./Staff";
import { User } from "./User";

/** Every model, for index syncing. Add new models here. */
export const allModels = [User, OtpChallenge, RateLimit, Staff, Role];
