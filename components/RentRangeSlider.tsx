"use client";

import { useState } from "react";
import { ksh } from "@/lib/data";

const MAX_RENT = 100000;
const STEP = 500;

function readRent(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(MAX_RENT, parsed)) : fallback;
}

export default function RentRangeSlider({ minRent, maxRent }: { minRent?: string; maxRent?: string }) {
  const [range, setRange] = useState(() => {
    const max = Math.max(STEP, readRent(maxRent, MAX_RENT));
    return { min: Math.min(readRent(minRent, 0), max - STEP), max };
  });

  return (
    <fieldset className="min-w-0 rounded-xl border border-slate-200 px-3 py-2 sm:col-span-2 lg:col-span-2">
      <legend className="px-1 text-xs font-semibold text-slate-600">Monthly rent range</legend>
      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700">
        <span>Min <b className="text-slate-950">{ksh(range.min)}</b></span>
        <span>Max <b className="text-slate-950">{ksh(range.max)}{range.max === MAX_RENT ? "+" : ""}</b></span>
      </div>
      <div className="mt-2 grid gap-1">
        <label className="flex items-center gap-2 text-[11px] text-slate-500" htmlFor="minimum-rent">
          Min
        <input
          id="minimum-rent"
          type="range"
          min={0}
          max={MAX_RENT - STEP}
          step={STEP}
          value={range.min}
          aria-valuetext={ksh(range.min)}
          onChange={(event) => setRange((current) => ({ ...current, min: Math.min(Number(event.target.value), current.max - STEP) }))}
          className="w-full accent-emerald-700"
        />
        </label>
        <label className="flex items-center gap-2 text-[11px] text-slate-500" htmlFor="maximum-rent">
          Max
        <input
          id="maximum-rent"
          type="range"
          min={STEP}
          max={MAX_RENT}
          step={STEP}
          value={range.max}
          aria-valuetext={ksh(range.max)}
          onChange={(event) => setRange((current) => ({ ...current, max: Math.max(Number(event.target.value), current.min + STEP) }))}
          className="w-full accent-emerald-700"
        />
        </label>
      </div>
      {range.min > 0 && <input type="hidden" name="minRent" value={range.min} />}
      {range.max < MAX_RENT && <input type="hidden" name="maxRent" value={range.max} />}
    </fieldset>
  );
}
