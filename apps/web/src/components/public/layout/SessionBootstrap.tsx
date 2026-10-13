import { getCurrentSession } from "@showbuzz/core/auth/current-customer";
import { SessionInitializer } from "./SessionInitializer";

/** Server half of the session hand-off: reads the cookies for this request. Render inside <Suspense>. */
export async function SessionBootstrap() {
  const session = await getCurrentSession();
  return <SessionInitializer customer={session.customer} mightRefresh={session.mightRefresh} />;
}
