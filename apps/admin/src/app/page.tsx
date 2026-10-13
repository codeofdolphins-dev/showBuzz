import { redirect } from "next/navigation";

/** The console starts at the dashboard (proxy.ts has already sent signed-out visitors to /login). */
export default function Home() {
  redirect("/dashboard");
}
