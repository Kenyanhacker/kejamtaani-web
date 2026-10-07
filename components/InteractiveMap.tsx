"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type MapClient from "@/components/MapClient";

const MapClientOnly = dynamic(() => import("@/components/MapClient"), {
  ssr: false,
  loading: () => <div role="status" className="h-80 animate-pulse rounded-2xl bg-slate-100" aria-label="Loading map" />,
});

export default function InteractiveMap(props: ComponentProps<typeof MapClient>) {
  return <MapClientOnly {...props} />;
}
