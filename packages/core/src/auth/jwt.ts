import "server-only";
import { AUTH } from "@showbuzz/schemas/constants";
import { customerAuthEnv } from "@showbuzz/runtime/customer-auth-env";
import { createTokenCodec } from "./token-codec";

/** Customer JWTs (docs/roadmap.md "Tokens"): aud "showbuzz-public", customer keys. No database access. */

export { JWT_ISSUER, type AccessClaims, type RefreshClaims, type SignedToken, type VerifyResult } from "./token-codec";

export const CUSTOMER_AUDIENCE = "showbuzz-public";

export const customerTokens = createTokenCodec({
  audience: CUSTOMER_AUDIENCE,
  accessSecret: customerAuthEnv.JWT_ACCESS_SECRET,
  refreshSecret: customerAuthEnv.JWT_REFRESH_SECRET,
  accessTtlSec: AUTH.accessTokenTtlSec,
  refreshTtlSec: AUTH.refreshTokenTtlSec,
});

export const { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } = customerTokens;
