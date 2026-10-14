import "server-only";
import { PARTNER_AUTH } from "@showbuzz/schemas/constants";
import { partnerAuthEnv } from "@showbuzz/runtime/partner-auth-env";
import { createTokenCodec } from "../token-codec";

/** Vendor-user JWTs: aud "showbuzz-partner" and their own keys, so customer and staff tokens never verify here. */
export const PARTNER_AUDIENCE = "showbuzz-partner";

export const partnerTokens = createTokenCodec({
  audience: PARTNER_AUDIENCE,
  accessSecret: partnerAuthEnv.PARTNER_JWT_ACCESS_SECRET,
  refreshSecret: partnerAuthEnv.PARTNER_JWT_REFRESH_SECRET,
  accessTtlSec: PARTNER_AUTH.accessTokenTtlSec,
  refreshTtlSec: PARTNER_AUTH.refreshTokenTtlSec,
});
