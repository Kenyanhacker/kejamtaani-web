"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import type { LeafletMouseEvent, Map as LeafletMap } from "leaflet";

export type MapPoint = { lat: number; lng: number };
export type MapListing = MapPoint & { id: string; title: string; estate: string; rent: number };

const NAIROBI: MapPoint = { lat: -1.2864, lng: 36.8172 };
const pinIcon = L.divIcon({
  className: "keja-map-pin",
  html: '<span aria-hidden="true"></span>',
  iconSize: [28, 36],
  iconAnchor: [14, 34],
});

type Props = {
  selectedPoint?: MapPoint | null;
  radiusKm?: number;
  selectable?: boolean;
  listings?: MapListing[];
  onSelect?: (point: MapPoint) => void;
  heightClassName?: string;
  zoom?: number;
};

export default function MapClient({
  selectedPoint,
  radiusKm,
  selectable = false,
  listings = [],
  onSelect,
  heightClassName = "h-80",
  zoom = 13,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const selectedRef = useRef<MapPoint | null>(selectedPoint ?? null);
  const selectableRef = useRef(selectable);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, { scrollWheelZoom: true }).setView([NAIROBI.lat, NAIROBI.lng], zoom);
    const layers = L.layerGroup().addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    map.on("click", (event: LeafletMouseEvent) => {
      if (!selectableRef.current) return;
      const point = { lat: event.latlng.lat, lng: event.latlng.lng };
      selectedRef.current = point;
      onSelectRef.current?.(point);
    });
    mapRef.current = map;
    layerRef.current = layers;

    return () => {
      map.off();
      map.remove();
      if (mapRef.current === map) mapRef.current = null;
      if (layerRef.current === layers) layerRef.current = null;
    };
  }, [zoom]);

  useEffect(() => {
    selectedRef.current = selectedPoint ?? null;
    selectableRef.current = selectable;
    onSelectRef.current = onSelect;

    const map = mapRef.current;
    const layers = layerRef.current;
    if (!map || !layers) return;
    layers.clearLayers();

    const center = selectedPoint ?? listings[0] ?? NAIROBI;
    if (radiusKm && selectedPoint) {
      const searchRadius = L.circle([center.lat, center.lng], {
        radius: radiusKm * 1000,
        color: "#047857",
        fillColor: "#10b981",
        fillOpacity: 0.12,
        weight: 2,
      }).addTo(layers);
      map.fitBounds(searchRadius.getBounds(), {
        padding: [24, 24],
        maxZoom: 13,
      });
    } else {
      map.setView([center.lat, center.lng], zoom);
    }

    if (selectedPoint) {
      const marker = L.marker([selectedPoint.lat, selectedPoint.lng], {
        icon: pinIcon,
        draggable: selectable,
      }).addTo(layers);
      marker.on("dragend", () => {
        const position = marker.getLatLng();
        const point = { lat: position.lat, lng: position.lng };
        selectedRef.current = point;
        onSelectRef.current?.(point);
      });
    }

    for (const listing of listings) {
      const marker = L.circleMarker([listing.lat, listing.lng], {
        radius: 8,
        color: "#fff",
        weight: 2,
        fillColor: "#047857",
        fillOpacity: 0.95,
      }).addTo(layers);
      const popup = document.createElement("div");
      const title = document.createElement("p");
      title.className = "font-semibold";
      title.textContent = listing.title;
      const detail = document.createElement("p");
      detail.className = "text-xs text-slate-600";
      detail.textContent = `${listing.estate} · KSh ${listing.rent.toLocaleString("en-KE")}/mo`;
      const link = document.createElement("a");
      link.href = `/property/${encodeURIComponent(listing.id)}`;
      link.className = "mt-2 inline-block text-sm font-semibold text-emerald-800 underline";
      link.textContent = "View keja";
      popup.append(title, detail, link);
      marker.bindPopup(popup);
    }

    window.setTimeout(() => map.invalidateSize(), 0);
  }, [selectedPoint?.lat, selectedPoint?.lng, radiusKm, selectable, listings, zoom]);

  return (
    <div
      role="region"
      aria-label={selectable ? "Interactive map for choosing a location" : "Map showing approximate property locations"}
      className={`relative z-0 overflow-hidden rounded-2xl border border-slate-200 ${heightClassName}`}
    >
      {selectable && <p className="pointer-events-none absolute right-3 top-3 z-[500] rounded-lg bg-white/95 px-3 py-2 text-xs font-medium text-slate-800 shadow">
        Tap the map to drop your pin
      </p>}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
