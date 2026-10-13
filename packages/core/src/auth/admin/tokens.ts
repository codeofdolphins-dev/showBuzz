import "server-only";
import { ADMIN_AUTH } from "@showbuzz/schemas/constants";
import { adminAuthEnv } from "@showbuzz/runtime/admin-auth-env";
import { createTokenCodec } from "../token-codec";

/** Staff JWTs: aud "showbuzz-admin" and their own keys, so a customer token never verifies here (and vice versa). */
export const ADMIN_AUDIENCE = "showbuzz-admin";

export const adminTokens = createTokenCodec({
  audience: ADMIN_AUDIENCE,
  accessSecret: adminAuthEnv.ADMIN_JWT_ACCESS_SECRET,
  refreshSecret: adminAuthEnv.ADMIN_JWT_REFRESH_SECRET,
  accessTtlSec: ADMIN_AUTH.accessTokenTtlSec,
  refreshTtlSec: ADMIN_AUTH.refreshTokenTtlSec,
});
