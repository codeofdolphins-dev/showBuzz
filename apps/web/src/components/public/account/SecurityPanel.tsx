"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LaptopMinimal, LoaderCircle, ShieldAlert, Smartphone } from "lucide-react";
import {
  confirmAccountDeletionAction,
  revokeSessionAction,
  signOutOtherDevicesAction,
  startAccountDeletionAction,
} from "@/app/(public)/_actions/account";
import { withAuthRetry } from "@/hooks/use-session-keep-alive";
import { formatDateShort, formatTime } from "@showbuzz/utils/dates";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/stores/ui";
import type { SessionView } from "@showbuzz/schemas/types/account";
import { CodeConfirm, type SentCode } from "./CodeConfirm";

/** Signed-in devices and account deletion (Security tab). */
export function SecurityPanel({ sessions }: { sessions: SessionView[] }) {
  const router = useRouter();
  const clearSession = useAuthStore((s) => s.clearSession);
  const [isPending, startTransition] = useTransition();
  const others = sessions.filter((s) => !s.current).length;

  const leave = (message: string) => {
    clearSession();
    toast(message, "info");
    router.replace("/");
  };

  const revoke = (session: SessionView) =>
    startTransition(async () => {
      const result = await withAuthRetry(() => revokeSessionAction({ sid: session.sid }));
      if (!result.success) {
        toast(result.error.message, "error");
        return;
      }
      if (result.data.signedOutHere) {
        leave("Signed out of this device.");
        return;
      }
      toast(`Signed out of ${session.device}.`, "success");
      router.refresh();
    });

  const signOutOthers = () =>
    startTransition(async () => {
      const result = await withAuthRetry(() => signOutOtherDevicesAction());
      if (!result.success) {
        toast(result.error.message, "error");
        return;
      }
      toast("Signed out of all other devices.", "success");
      router.refresh();
    });

  return (
    <div className="max-w-2xl space-y-6">
      <section className="rounded-3xl border border-slate-200/80 bg-white p-5 text-xs shadow-xs sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h3 className="text-base font-extrabold text-slate-900">Signed-in Devices</h3>
          {others > 0 && (
            <button
              type="button"
              onClick={signOutOthers}
              disabled={isPending}
              className="tap-active rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
            >
              Sign out of all other devices
            </button>
          )}
        </div>
        <ul className="divide-y divide-slate-100">
          {sessions.map((session) => {
            const Icon = /iPhone|Android|iPad/.test(session.device) ? Smartphone : LaptopMinimal;
            const lastUsed = new Date(session.lastUsedAt);
            return (
              <li key={session.sid} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-bold text-slate-800">
                      {session.device}
                      {session.current && (
                        <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                          This device
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Last active {formatDateShort(lastUsed)}, {formatTime(lastUsed)}
                      {session.ipPrefix && <> · Network {session.ipPrefix}</>}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => revoke(session)}
                  disabled={isPending}
                  className="tap-active rounded-lg px-3 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                >
                  {session.current ? "Sign out" : "Revoke"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <DeleteAccount onDeleted={() => leave("Your account has been deleted.")} />
    </div>
  );
}

function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const [sent, setSent] = useState<SentCode | null>(null);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const sendCode = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await withAuthRetry(() => startAccountDeletionAction());
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      setSent({ ...result.data, sentAt: Date.now() });
    });

  const confirm = (code: string) =>
    startTransition(async () => {
      if (!sent) return;
      setError(undefined);
      const result = await withAuthRetry(() => confirmAccountDeletionAction({ challengeId: sent.challengeId, code }));
      if (!result.success) {
        setError(result.error.message);
        if (result.error.code === "OTP_EXPIRED" || result.error.code === "RATE_LIMITED") setSent(null);
        return;
      }
      onDeleted();
    });

  return (
    <section className="rounded-3xl border border-rose-200 bg-rose-50/40 p-5 text-xs shadow-xs sm:p-8">
      <h3 className="flex items-center gap-2 text-base font-extrabold text-rose-700">
        <ShieldAlert className="h-4 w-4" /> Delete Account
      </h3>
      <p className="mt-2 leading-relaxed text-slate-600">
        This removes your name, phone number and email and signs you out everywhere. Booking and payment records are
        kept for GST purposes but are no longer linked to your details. This can&apos;t be undone.
      </p>
      {!sent ? (
        <>
          <button
            type="button"
            onClick={sendCode}
            disabled={isPending}
            className="tap-active mt-4 flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {isPending && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
            Send confirmation code
          </button>
          {error && (
            <p role="alert" className="mt-2 text-[11px] font-medium text-rose-600">
              {error}
            </p>
          )}
        </>
      ) : (
        <CodeConfirm
          key={sent.challengeId}
          sent={sent}
          confirmLabel="Delete my account"
          danger
          pending={isPending}
          error={error}
          onConfirm={confirm}
          onResend={sendCode}
          onCancel={() => {
            setSent(null);
            setError(undefined);
          }}
        />
      )}
    </section>
  );
}
