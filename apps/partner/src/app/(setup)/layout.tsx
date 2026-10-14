import type { ReactNode } from "react";
import { Store } from "lucide-react";
import { ToastProvider } from "@showbuzz/console-ui/Toaster";
import { getCurrentVendor } from "@showbuzz/core/auth/partner/current-vendor";
import { SignOutButton } from "@/components/shell/SignOutButton";

/**
 * Onboarding chrome: brand, business name and sign-out only. Until onboarding is complete this is the only part of
 * the portal a vendor can open (console pages redirect here). Pages check the session themselves.
 */
export default async function SetupLayout({ children }: { children: ReactNode }) {
  const current = await getCurrentVendor();
  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 border-b border-admin-border bg-white/95 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
            <span className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-admin-indigo text-white shadow-sm">
                <Store className="h-5 w-5" aria-hidden />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-base font-black tracking-tight text-admin-dark">ShowBuzz</span>
                <span className="text-[10px] font-bold tracking-wider text-admin-coral uppercase">
                  Partner onboarding
                </span>
              </span>
            </span>
            {current ? (
              <div className="flex items-center gap-3">
                <span className="hidden text-right text-xs sm:block">
                  <span className="block font-bold text-admin-dark">{current.vendor.businessName}</span>
                  <span className="block text-[10px] text-admin-subtle">{current.vendorUser.email}</span>
                </span>
                <SignOutButton />
              </div>
            ) : null}
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-4 sm:p-6">{children}</main>
      </div>
    </ToastProvider>
  );
}
