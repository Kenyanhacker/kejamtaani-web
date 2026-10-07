export const LISTING_DRAFT_KEY = "keja-mtaani:listing-draft";

export const listingDraftKey = (userId: string) => `${LISTING_DRAFT_KEY}:${userId}`;

export const LISTING_STATUSES = ["Available", "Soon available", "Taken"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export type LandlordListing = {
  id: string;
  title: string;
  buildingName: string;
  unitType: string;
  estate: string;
  county: string;
  address: string;
  latitude: string;
  longitude: string;
  amenities: string[];
  status: ListingStatus;
  availabilityDate: string;
  rent: number;
  depositRule: string;
  description: string;
  tourUrl: string;
  photos: { name: string; dataUrl: string }[];
  createdAt: string;
};
