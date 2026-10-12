"use client";

import { Trophy } from "lucide-react";

/** Eden Gardens style stand diagram from the prototype. Clicking a block scrolls to its tier. */

interface Sector {
  label: string;
  start: number;
  end: number;
  rIn: number;
  rOut: number;
  fill: string;
  textFill: string;
  tier: 0 | 1 | 2;
  fontSize?: number;
}

const OUTER = { rIn: 225, rOut: 295 };
const INNER = { rIn: 145, rOut: 218 };

const SECTORS: Sector[] = [
  { label: "BLOCK G1", start: 290, end: 326, ...OUTER, fill: "#7A288A", textFill: "#FFFFFF", tier: 0 },
  { label: "BLOCK F1", start: 330, end: 366, ...OUTER, fill: "#7A288A", textFill: "#FFFFFF", tier: 0 },
  { label: "BLOCK E", start: 370, end: 400, ...OUTER, fill: "#C8C8C8", textFill: "#333333", tier: 2 },
  { label: "BLOCK D1", start: 404, end: 460, ...OUTER, fill: "#7A288A", textFill: "#FFFFFF", tier: 0 },
  { label: "BLOCK C1", start: 464, end: 504, ...OUTER, fill: "#7A288A", textFill: "#FFFFFF", tier: 0 },
  { label: "BLOCK B1", start: 508, end: 544, ...OUTER, fill: "#C8C8C8", textFill: "#333333", tier: 2 },
  { label: "CLUB HOUSE UPPER TIER", start: 548, end: 588, ...OUTER, fill: "#D6D6D6", textFill: "#333333", tier: 1, fontSize: 10 },
  { label: "BLOCK L1", start: 592, end: 628, ...OUTER, fill: "#C8C8C8", textFill: "#333333", tier: 2 },
  { label: "BLOCK K1", start: 632, end: 676, ...OUTER, fill: "#7A288A", textFill: "#FFFFFF", tier: 0 },
  { label: "BLOCK H1", start: 680, end: 706, ...OUTER, fill: "#C8C8C8", textFill: "#333333", tier: 2 },
  { label: "BLOCK G", start: 290, end: 326, ...INNER, fill: "#DEDEDE", textFill: "#333333", tier: 2 },
  { label: "BLOCK F", start: 330, end: 366, ...INNER, fill: "#DEDEDE", textFill: "#333333", tier: 2 },
  { label: "BLOCK D", start: 370, end: 410, ...INNER, fill: "#DEDEDE", textFill: "#333333", tier: 2 },
  { label: "BLOCK C", start: 414, end: 464, ...INNER, fill: "#E61C73", textFill: "#FFFFFF", tier: 1 },
  { label: "BLOCK B", start: 468, end: 510, ...INNER, fill: "#DEDEDE", textFill: "#333333", tier: 2 },
  { label: "CLUB HOUSE LOWER TIER", start: 514, end: 588, ...INNER, fill: "#E3E3E3", textFill: "#333333", tier: 1, fontSize: 10 },
  { label: "BLOCK L", start: 592, end: 628, ...INNER, fill: "#00BFFF", textFill: "#FFFFFF", tier: 0 },
  { label: "BLOCK K", start: 632, end: 676, ...INNER, fill: "#E61C73", textFill: "#FFFFFF", tier: 1 },
  { label: "BLOCK H", start: 680, end: 706, ...INNER, fill: "#008B8B", textFill: "#FFFFFF", tier: 0 },
];

const CX = 350;
const CY = 350;

function polar(r: number, angle: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: CX + r * Math.sin(rad), y: CY - r * Math.cos(rad) };
}

function sectorPath({ rIn, rOut, start, end }: Sector) {
  const sweep = (end - start + 360) % 360;
  const large = sweep <= 180 ? 0 : 1;
  const p1 = polar(rOut, start);
  const p2 = polar(rOut, end);
  const p3 = polar(rIn, end);
  const p4 = polar(rIn, start);
  const f = (n: number) => n.toFixed(1);
  return `M ${f(p1.x)} ${f(p1.y)} A ${rOut} ${rOut} 0 ${large} 1 ${f(p2.x)} ${f(p2.y)} L ${f(p3.x)} ${f(p3.y)} A ${rIn} ${rIn} 0 ${large} 0 ${f(p4.x)} ${f(p4.y)} Z`;
}

function sectorCentre({ rIn, rOut, start, end }: Sector) {
  const sweep = (end - start + 360) % 360;
  return polar((rIn + rOut) / 2, start + sweep / 2);
}

export function StadiumMap({ onSelectTier }: { onSelectTier: (tierIndex: number) => void }) {
  return (
    <div className="mb-6 flex w-full max-w-3xl flex-col items-center rounded-3xl border border-slate-200/90 bg-white p-4 shadow-md select-none sm:p-8">
      <div className="mb-4 flex w-full flex-col items-center justify-between gap-2 border-b border-slate-100 pb-4 text-center sm:flex-row sm:text-left">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600">
            <Trophy className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-black text-slate-900 sm:text-base">Official Stadium Seating Map</h3>
            <p className="text-xs text-slate-500">Tap any block to jump to its stand & seats</p>
          </div>
        </div>
      </div>

      <svg viewBox="0 0 700 700" className="my-2 aspect-square w-full max-w-xl drop-shadow-md" role="img" aria-label="Stadium map">
        <circle cx={CX} cy={CY} r={138} fill="#15803D" stroke="#FFFFFF" strokeWidth={4} />
        <rect x={341} y={300} width={18} height={100} fill="#FFFFFF" rx={2} />
        <line x1={341} y1={315} x2={359} y2={315} stroke="#15803D" strokeWidth={2} />
        <line x1={341} y1={385} x2={359} y2={385} stroke="#15803D" strokeWidth={2} />
        {SECTORS.map((s) => {
          const c = sectorCentre(s);
          return (
            <g key={s.label}>
              <path
                d={sectorPath(s)}
                fill={s.fill}
                stroke="#FFFFFF"
                strokeWidth={2.5}
                className="cursor-pointer transition-all hover:opacity-85 hover:brightness-110"
                onClick={() => onSelectTier(s.tier)}
              >
                <title>{s.label}</title>
              </path>
              <text
                x={c.x.toFixed(1)}
                y={c.y.toFixed(1)}
                fill={s.textFill}
                fontSize={s.fontSize ?? (s.rIn > 200 ? 12 : 11)}
                fontWeight={800}
                textAnchor="middle"
                dominantBaseline="middle"
                className="pointer-events-none"
              >
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 grid w-full grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs font-bold sm:grid-cols-4">
        <span className="flex items-center gap-2 text-slate-700">
          <span className="h-4 w-4 rounded-md bg-[#7A288A]" /> Purple Outer Blocks
        </span>
        <span className="flex items-center gap-2 text-slate-700">
          <span className="flex gap-1">
            <span className="h-4 w-2.5 rounded-sm bg-[#008B8B]" />
            <span className="h-4 w-2.5 rounded-sm bg-[#00BFFF]" />
          </span>
          Teal & Cyan Premium
        </span>
        <span className="flex items-center gap-2 text-slate-700">
          <span className="h-4 w-4 rounded-md bg-[#E61C73]" /> Hot Pink Pavilion
        </span>
        <span className="flex items-center gap-2 text-slate-500">
          <span className="h-4 w-4 rounded-md bg-[#CCCCCC]" /> Gray Stand Blocks
        </span>
      </div>
    </div>
  );
}
