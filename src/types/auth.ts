import type { CustomerSnapshot } from "@/schemas/user";

/** The server's view of the visitor's session, handed to the client on page load. */
export interface CurrentSession {
  customer: { user: CustomerSnapshot; accessExpiresAt: string } | null;
  /**
   * No valid access token, but the browser has the session hint cookie: the access token probably just
   * expired, so the client should try one silent refresh before treating the visitor as signed out.
   */
  mightRefresh: boolean;
}
