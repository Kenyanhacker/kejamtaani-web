"use client";

import { useEffect } from "react";

export default function RecordListingView({ listingId }: { listingId: string }) {
  useEffect(() => {
    const key = `keja-mtaani:view-recorded:${listingId}`;
    if (sessionStorage.getItem(key)) return;
    void fetch("/api/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, interactionType: "listing_view" }),
      keepalive: true,
    }).then((response) => {
      if (response.ok) sessionStorage.setItem(key, "1");
      else if (response.status !== 401) console.error("Property view was not recorded.", response.status);
    }).catch((error: unknown) => console.error("Unable to send property view interaction.", error));
  }, [listingId]);

  return null;
}
