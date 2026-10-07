"use client";

import { MapPin, Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { TYPES, WATER } from "@/lib/data";
import InteractiveMap from "@/components/InteractiveMap";
import type { MapListing, MapPoint } from "@/components/MapClient";
import RentRangeSlider from "@/components/RentRangeSlider";
import SaveSearchButton from "@/components/SaveSearchButton";

type P = {
  q?: string; estate?: string; type?: string; minRent?: string; maxRent?: string; water?: string; gated?: string; sort?: string;
  lat?: string; lng?: string; radius?: string;
};
const control = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

export default function SearchFilterBar({ p, neighborhoods, mapListings = [] }: { p: P; neighborhoods: string[]; mapListings?: MapListing[] }) {
  const [mapOpen, setMapOpen] = useState(Boolean(p.lat && p.lng));
  const [latitude, setLatitude] = useState(p.lat ?? "");
  const [longitude, setLongitude] = useState(p.lng ?? "");
  const [radius, setRadius] = useState(p.radius ?? "5");
  const [locationError, setLocationError] = useState("");
  const numericLatitude = Number(latitude);
  const numericLongitude = Number(longitude);
  const point: MapPoint | null = latitude && longitude
    && Number.isFinite(numericLatitude) && numericLatitude >= -90 && numericLatitude <= 90
    && Number.isFinite(numericLongitude) && numericLongitude >= -180 && numericLongitude <= 180
    ? { lat: numericLatitude, lng: numericLongitude }
    : null;
  const validateLocation = (event: FormEvent<HTMLFormElement>) => {
    if ((latitude || longitude) && !point) {
      event.preventDefault();
      setLocationError("Enter a valid latitude and longitude, or choose a point on the map.");
      return;
    }
    setLocationError("");
  };

  return (
    <form action="/" onSubmit={validateLocation} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-900/5 sm:p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><SlidersHorizontal className="h-4 w-4 text-emerald-700" /> Find a home</div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Keywords
          <div className="relative">
            <MapPin aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input name="q" type="search" maxLength={80} autoComplete="off" defaultValue={p.q ?? ""} placeholder="Estate, landmark or home feature" className={`${control} pl-9`} />
          </div>
        </label>
        <label className="text-xs font-semibold text-slate-600">Neighbourhood
          <select name="estate" defaultValue={p.estate ?? ""} className={control}>
            <option value="">All neighbourhoods</option>
            {neighborhoods.map((location) => <option key={location} value={location}>{location}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">Home type
          <select name="type" defaultValue={p.type ?? ""} className={control}>
            <option value="">Any home type</option>
            {TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">Sort by
          <select name="sort" defaultValue={p.sort ?? "newest"} className={control}>
            <option value="newest">Recently added</option>
            <option value="price-asc">Rent: lowest first</option>
            <option value="price-desc">Rent: highest first</option>
          </select>
        </label>
        <RentRangeSlider minRent={p.minRent} maxRent={p.maxRent} />
        <label className="text-xs font-semibold text-slate-600">Water supply
          <select name="water" defaultValue={p.water ?? ""} className={control}>
            <option value="">Any water supply</option>
            {WATER.map((water) => <option key={water} value={water}>{water}</option>)}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
          <input type="checkbox" name="gated" value="1" defaultChecked={p.gated === "1"} className="h-4 w-4 accent-emerald-700" />
          Gated community
        </label>
        <div className="sm:col-span-2 lg:col-span-4">
          <button type="button" aria-expanded={mapOpen} onClick={() => setMapOpen((open) => !open)} className="flex min-h-11 items-center gap-2 rounded-xl border border-emerald-200 px-4 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">
            <MapPin aria-hidden="true" className="h-4 w-4" />{mapOpen ? "Hide map location" : "Choose location on map"}
          </button>
          {mapOpen && <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <InteractiveMap
                selectedPoint={point}
                radiusKm={point ? Number(radius) : undefined}
                selectable
                listings={mapListings}
                onSelect={(selected) => {
                  setLatitude(selected.lat.toFixed(6));
                  setLongitude(selected.lng.toFixed(6));
                }}
                heightClassName="h-72 sm:h-80"
              />
              <p className="mt-2 text-xs text-slate-500">Tap anywhere on the map to search nearby. Map pins are approximate. Map data © OpenStreetMap contributors.</p>
            </div>
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-600">Search within
                <select value={radius} onChange={(event) => setRadius(event.target.value)} className={control}>
                  <option value="2">2 km</option>
                  <option value="5">5 km</option>
                  <option value="10">10 km</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-slate-600">Latitude
                  <input type="number" min="-90" max="90" step="any" value={latitude} onChange={(event) => { setLatitude(event.target.value); setLocationError(""); }} className={control} placeholder="-1.2864" />
                </label>
                <label className="text-xs font-semibold text-slate-600">Longitude
                  <input type="number" min="-180" max="180" step="any" value={longitude} onChange={(event) => { setLongitude(event.target.value); setLocationError(""); }} className={control} placeholder="36.8172" />
                </label>
              </div>
              {locationError && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs text-rose-800">{locationError}</p>}
              {point
                ? <p className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-950">Searching near {point.lat.toFixed(4)}, {point.lng.toFixed(4)}.</p>
                : <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Pan and zoom the map, then tap a spot to choose your search centre.</p>}
              {point && <button type="button" onClick={() => { setLatitude(""); setLongitude(""); }} className="text-sm font-medium text-slate-600 underline">Clear map location</button>}
            </div>
          </div>}
          {point && <>
            <input type="hidden" name="lat" value={latitude} />
            <input type="hidden" name="lng" value={longitude} />
            <input type="hidden" name="radius" value={radius} />
          </>}
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
          <button className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
            <Search aria-hidden="true" className="h-4 w-4" /> Search homes
          </button>
          <a href="/" className="flex min-h-11 items-center rounded-xl px-3 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-900">Reset</a>
        </div>
      </div>
      <SaveSearchButton filters={{
        q: p.q,
        estate: p.estate,
        type: p.type,
        minRent: p.minRent,
        maxRent: p.maxRent,
        water: p.water,
        gated: p.gated,
        sort: p.sort,
        lat: p.lat,
        lng: p.lng,
        radius: p.radius,
      }} />
    </form>
  );
}
