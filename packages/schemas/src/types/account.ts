import type { CustomerSnapshot } from "../user";

/** One signed-in device, as shown on the profile's Security tab. Never includes token hashes. */
export interface SessionView {
  sid: string;
  /** e.g. "Chrome on Windows". */
  device: string;
  /** Coarse network prefix ("203.0.113.0/24"); no full IP is stored. */
  ipPrefix?: string;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

/** Everything the profile page needs, loaded from the database for the signed-in customer. */
export interface AccountProfile {
  user: CustomerSnapshot;
  phoneVerified: boolean;
  emailVerified: boolean;
  sessions: SessionView[];
}
