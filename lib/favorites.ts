const FAVORITES_KEY = "keja-mtaani:favorites";
const FAVORITES_EVENT = "keja-mtaani:favorites-change";

export function getFavoriteIds(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? "[]");
    if (Array.isArray(value) && value.every((id) => typeof id === "string")) return value;
    console.error("Saved properties are in an invalid format.");
  } catch (error) {
    console.error("Unable to read saved properties.", error);
  }
  return [];
}

export function setFavoriteIds(ids: string[]) {
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
    window.dispatchEvent(new Event(FAVORITES_EVENT));
  } catch (error) {
    console.error("Unable to save favorite properties.", error);
  }
}

export function subscribeToFavorites(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === FAVORITES_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(FAVORITES_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(FAVORITES_EVENT, onChange);
  };
}
