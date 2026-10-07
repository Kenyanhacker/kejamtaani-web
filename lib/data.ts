export const TYPES = [
  "Single Room",
  "Bedsitter",
  "Studio",
  "One-bedroom apartment",
  "Two-bedroom apartment",
  "Three-bedroom and larger units",
  "Servant quarters",
  "Maisonette",
  "House with own compound",
];

export const WATER = ["Borehole 24/7", "City Water", "Tank Storage", "Rationing"];

export const ksh = (amount: number) => `KSh ${amount.toLocaleString("en-KE")}`;
