"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import { Camera, CameraOff, CheckCircle2, History, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { cn } from "@showbuzz/utils/cn";
import { formatDateShort, formatTime } from "@showbuzz/utils/dates";
import { Card } from "@showbuzz/console-ui/PageParts";
import { Button, Input } from "@showbuzz/console-ui/form";
import type { CheckInResult } from "@showbuzz/schemas/types/partner-box-office";
import { checkInAction } from "@/app/_actions/box-office";

/**
 * Prototype scan-qr.html "Scan QR Code & Turnstile Check-In". The camera is read with the browser's own
 * BarcodeDetector (Chrome/Edge on Android, Chrome on desktop with the feature; not Safari or Firefox today), so no
 * scanning library is needed; where it is missing, the gate types the booking code or pastes the QR text instead.
 * Every scan goes to the server, which verifies the signature and admits the ticket once.
 */

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

function barcodeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null;
}

const noSubscribe = () => () => {};
/** Camera QR scanning available in this browser (unknown, null, while rendering on the server). */
const scanningSupported = () => barcodeDetector() !== null && !!navigator.mediaDevices?.getUserMedia;

interface ScanEntry {
  id: number;
  at: string;
  result: CheckInResult;
}

const SCAN_INTERVAL_MS = 350;
/** The same QR in view isn't re-sent within this time (the camera sees it many times a second). */
const SAME_CODE_PAUSE_MS = 4000;

const at = (iso: string) => `${formatDateShort(new Date(iso))}, ${formatTime(new Date(iso))}`;

function beep(ok: boolean) {
  try {
    const AudioCtx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.35));
    osc.onended = () => void ctx.close();
  } catch {
    // Sound is a nicety; never break a scan for it.
  }
}

export function TicketScanner({ initialCode = "" }: { initialCode?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });
  const busyRef = useRef(false);
  const supported = useSyncExternalStore(noSubscribe, scanningSupported, () => null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual] = useState(initialCode);
  const [pending, startTransition] = useTransition();
  const [latest, setLatest] = useState<ScanEntry | null>(null);
  const [history, setHistory] = useState<ScanEntry[]>([]);
  const [sound, setSound] = useState(true);
  const soundRef = useRef(true);

  const submit = useCallback((input: string) => {
    const value = input.trim();
    if (!value || busyRef.current) return;
    busyRef.current = true;
    startTransition(async () => {
      const response = await checkInAction({ input: value });
      busyRef.current = false;
      const result: CheckInResult = response.success
        ? response.data
        : { outcome: "rejected", reason: "malformed", message: response.error.message };
      const entry = { id: Date.now(), at: new Date().toISOString(), result };
      setLatest(entry);
      setHistory((h) => [entry, ...h].slice(0, 25));
      if (soundRef.current) beep(result.outcome === "checked_in");
    });
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (err) {
      const name = (err as { name?: string }).name;
      setCameraError(
        name === "NotAllowedError"
          ? "Camera permission was refused. Allow the camera for this site, or type the booking code below."
          : "The camera couldn't be started. Type the booking code below instead.",
      );
      stopCamera();
    }
  }

  // Scan loop while the camera is on.
  useEffect(() => {
    if (!cameraOn) return;
    const Detector = barcodeDetector();
    if (!Detector) return;
    const detector = new Detector({ formats: ["qr_code"] });
    const timer = window.setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || busyRef.current) return;
      try {
        const codes = await detector.detect(video);
        const value = codes[0]?.rawValue;
        if (!value) return;
        const now = Date.now();
        if (value === lastRef.current.value && now - lastRef.current.at < SAME_CODE_PAUSE_MS) return;
        lastRef.current = { value, at: now };
        submit(value);
      } catch {
        // A frame that can't be read; try the next one.
      }
    }, SCAN_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [cameraOn, submit]);

  useEffect(() => stopCamera, [stopCamera]);

  function onManual(event: FormEvent) {
    event.preventDefault();
    submit(manual);
    setManual("");
  }

  const admitted = history.filter((h) => h.result.outcome === "checked_in").length;
  const duplicates = history.filter((h) => h.result.outcome === "already_checked_in").length;
  const rejected = history.filter((h) => h.result.outcome === "rejected").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Admitted (this session)" value={admitted} tone="text-admin-success" />
        <Kpi label="Total scans" value={history.length} />
        <Kpi label="Duplicate scans" value={duplicates} tone="text-amber-600" />
        <Kpi label="Rejected" value={rejected} tone="text-admin-danger" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-admin-dark">Camera scanner</h2>
            <label className="flex items-center gap-2 text-[11px] font-semibold text-admin-muted">
              <input
                type="checkbox"
                checked={sound}
                onChange={(e) => {
                  soundRef.current = e.target.checked;
                  setSound(e.target.checked);
                }}
              />{" "}
              Beep
            </label>
          </div>
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-900">
            <video
              ref={videoRef}
              className={cn("h-full w-full object-cover", !cameraOn && "hidden")}
              muted
              playsInline
            />
            {cameraOn ? (
              <div
                className="pointer-events-none absolute inset-8 rounded-xl border-2 border-emerald-400/80"
                aria-hidden
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-slate-300">
                <Camera className="h-8 w-8" aria-hidden />
                {supported === false
                  ? "This browser can't read QR codes from the camera. Use Chrome on Android, or type the code below."
                  : "Start the camera and hold the ticket QR inside the frame."}
              </div>
            )}
          </div>
          {cameraError ? <p className="text-[11px] font-medium text-admin-danger">{cameraError}</p> : null}
          <div className="flex gap-2">
            {cameraOn ? (
              <Button type="button" variant="secondary" onClick={stopCamera}>
                <CameraOff className="h-4 w-4" aria-hidden /> Stop camera
              </Button>
            ) : (
              <Button type="button" onClick={startCamera} disabled={!supported}>
                <Camera className="h-4 w-4" aria-hidden /> Start camera
              </Button>
            )}
          </div>

          <form onSubmit={onManual} className="space-y-2 border-t border-admin-border pt-4">
            <label htmlFor="manual-code" className="block text-[13px] font-semibold text-admin-text">
              Or enter the booking ID / QR text
            </label>
            <div className="flex gap-2">
              <Input
                id="manual-code"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="SB-123456"
                autoComplete="off"
                className="font-mono uppercase"
              />
              <Button type="submit" disabled={pending || !manual.trim()}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Validate
              </Button>
            </div>
          </form>
        </Card>

        <ResultCard entry={latest} pending={pending} />
      </div>

      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-admin-dark">
          <History className="h-4 w-4" aria-hidden /> Gate entry feed (this session)
        </h2>
        {history.length === 0 ? (
          <p className="text-xs text-admin-muted">No scans yet.</p>
        ) : (
          <ul className="divide-y divide-admin-border text-xs">
            {history.map(({ id, at: time, result }) => (
              <li key={id} className="flex items-center justify-between gap-3 py-2">
                <span className="font-mono font-bold">
                  {result.outcome === "rejected" ? (result.code ?? "Invalid QR") : result.ticket.code}
                </span>
                <span className="flex-1 truncate text-admin-muted">
                  {result.outcome === "rejected"
                    ? result.message
                    : `${result.ticket.title} · ${result.ticket.seatLabels.join(", ")}`}
                </span>
                <OutcomeLabel result={result} />
                <span className="text-[11px] text-admin-subtle">{formatTime(new Date(time))}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function OutcomeLabel({ result }: { result: CheckInResult }) {
  if (result.outcome === "checked_in") return <span className="font-bold text-admin-success">Admitted</span>;
  if (result.outcome === "already_checked_in") return <span className="font-bold text-amber-600">Duplicate</span>;
  return <span className="font-bold text-admin-danger">Rejected</span>;
}

function ResultCard({ entry, pending }: { entry: ScanEntry | null; pending: boolean }) {
  if (pending) {
    return (
      <Card className="flex min-h-64 flex-col items-center justify-center gap-2 p-5 text-xs text-admin-muted">
        <Loader2 className="h-8 w-8 animate-spin text-admin-indigo" aria-hidden /> Verifying ticket…
      </Card>
    );
  }
  if (!entry) {
    return (
      <Card className="flex min-h-64 flex-col items-center justify-center gap-2 p-5 text-center text-xs text-admin-muted">
        <ShieldAlert className="h-8 w-8" aria-hidden />
        <p className="font-bold text-admin-dark">Awaiting scanner input</p>
        <p>Scan a customer&apos;s QR code or type the booking ID to check the ticket.</p>
      </Card>
    );
  }
  const { result } = entry;
  if (result.outcome === "rejected") {
    return (
      <Card className="flex min-h-64 flex-col justify-center gap-3 border-red-300 bg-red-50 p-5">
        <div role="alert" className="flex items-center gap-2 text-admin-danger">
          <XCircle className="h-8 w-8" aria-hidden />
          <p className="text-lg font-black">Don&apos;t admit</p>
        </div>
        <p className="text-sm font-semibold text-red-900">{result.message}</p>
        {result.code ? <p className="font-mono text-xs text-red-800">{result.code}</p> : null}
      </Card>
    );
  }
  const ok = result.outcome === "checked_in";
  const { ticket } = result;
  return (
    <Card
      className={cn(
        "flex min-h-64 flex-col justify-center gap-3 p-5",
        ok ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50",
      )}
    >
      <div role="status" className={cn("flex items-center gap-2", ok ? "text-admin-success" : "text-amber-700")}>
        {ok ? <CheckCircle2 className="h-8 w-8" aria-hidden /> : <ShieldAlert className="h-8 w-8" aria-hidden />}
        <p className="text-lg font-black">{ok ? "Admit: checked in" : "Already checked in"}</p>
      </div>
      {!ok ? (
        <p className="text-sm font-semibold text-amber-900">
          Already checked in at {at(result.checkedInAt)}
          {result.checkedInByName ? ` by ${result.checkedInByName}` : ""}. Re-entry needs a manager.
        </p>
      ) : null}
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="col-span-2">
          <dt className="text-[11px] font-semibold text-admin-subtle uppercase">Show</dt>
          <dd className="font-bold text-admin-dark">{ticket.title}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[11px] font-semibold text-admin-subtle uppercase">Venue</dt>
          <dd className="font-semibold">
            {ticket.venueName}
            {ticket.screenName ? ` · ${ticket.screenName}` : ""}
            {ticket.startsAt ? ` · ${at(ticket.startsAt)}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold text-admin-subtle uppercase">Seats / passes</dt>
          <dd className="font-mono text-base font-black text-admin-dark">{ticket.seatLabels.join(", ")}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold text-admin-subtle uppercase">Booking</dt>
          <dd className="font-mono font-bold">{ticket.code}</dd>
        </div>
      </dl>
    </Card>
  );
}

function Kpi({ label, value, tone = "text-admin-dark" }: { label: string; value: number; tone?: string }) {
  return (
    <Card className="space-y-1 p-4">
      <p className="text-[11px] font-bold tracking-wider text-admin-subtle uppercase">{label}</p>
      <p className={cn("text-2xl font-black", tone)}>{value}</p>
    </Card>
  );
}
