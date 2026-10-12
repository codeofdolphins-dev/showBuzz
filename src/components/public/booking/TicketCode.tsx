/**
 * Placeholder entry code. The real M-ticket QR (booking + show + seats, HMAC-signed with
 * QR_SIGNING_SECRET) is generated server-side once the `qrcode` package is approved.
 * This draws a deterministic pattern from the booking code so each pass looks distinct.
 */
export function TicketCode({ code }: { code: string }) {
  const size = 21;
  let seed = [...code].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const next = () => {
    seed = (seed * 1_103_515_245 + 12_345) >>> 0;
    return seed / 2 ** 32;
  };
  const inFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
  // Corner squares: solid outer ring, blank ring, solid 3x3 centre.
  const finderOn = (x: number, y: number) => {
    const fx = x >= size - 7 ? x - (size - 7) : x;
    const fy = y >= size - 7 ? y - (size - 7) : y;
    return Math.max(Math.abs(fx - 3), Math.abs(fy - 3)) !== 2;
  };

  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const on = inFinder(x, y) ? finderOn(x, y) : next() > 0.5;
      if (on) cells.push({ x, y });
    }
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full" role="img" aria-label={`Entry code ${code}`} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="white" />
      {cells.map(({ x, y }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#0F172A" />
      ))}
    </svg>
  );
}
