"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

/**
 * Click and drag-select on a seat grid, without a drag-and-drop library. Seats carry `data-seat`, `data-r` (display
 * row index) and `data-n` (seat number); the grid listens to pointer events and reads the seat under the pointer with
 * elementFromPoint, so the same code works for mouse, pen and touch. Dragging selects the rectangle between the first
 * and the current seat; Shift / Ctrl / ⌘ adds to the selection instead of replacing it.
 */

interface Point {
  r: number;
  n: number;
}

interface Drag {
  anchor: Point;
  base: Set<string>;
}

function seatAt(x: number, y: number): (Point & { id: string }) | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-seat]");
  if (!el?.dataset.seat) return null;
  return { id: el.dataset.seat, r: Number(el.dataset.r), n: Number(el.dataset.n) };
}

/** `rows[r]` = the seat numbers that exist in display row r, with their ids. */
export function useSeatSelection(rows: { letter: string; count: number }[]) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const drag = useRef<Drag | null>(null);
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const rectangle = useCallback((a: Point, b: Point, base: Set<string>) => {
    const next = new Set(base);
    const [r0, r1] = [Math.min(a.r, b.r), Math.max(a.r, b.r)];
    const [n0, n1] = [Math.min(a.n, b.n), Math.max(a.n, b.n)];
    for (let r = r0; r <= r1; r += 1) {
      const row = rowsRef.current[r];
      if (!row) continue;
      for (let n = n0; n <= Math.min(n1, row.count); n += 1) next.add(`${row.letter}${n}`);
    }
    return next;
  }, []);

  useEffect(() => {
    const end = () => {
      drag.current = null;
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      const seat = seatAt(event.clientX, event.clientY);
      if (!seat) return;
      event.preventDefault();
      // Touch pointers are captured by the element they started on; release so elementFromPoint follows the finger.
      (event.target as Element).releasePointerCapture?.(event.pointerId);
      const additive = event.shiftKey || event.ctrlKey || event.metaKey;
      if (additive && selected.has(seat.id)) {
        const next = new Set(selected);
        next.delete(seat.id);
        setSelected(next);
        return;
      }
      if (!additive && selected.size === 1 && selected.has(seat.id)) {
        setSelected(new Set());
        return;
      }
      const base = additive ? selected : new Set<string>();
      drag.current = { anchor: seat, base };
      setSelected(rectangle(seat, seat, base));
    },
    [rectangle, selected],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const current = drag.current;
      if (!current) return;
      const seat = seatAt(event.clientX, event.clientY);
      if (seat) setSelected(rectangle(current.anchor, seat, current.base));
    },
    [rectangle],
  );

  const clear = useCallback(() => setSelected(new Set()), []);

  return { selected, setSelected, clear, gridHandlers: { onPointerDown, onPointerMove } };
}
