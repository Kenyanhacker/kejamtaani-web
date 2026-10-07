export function safeInternalRedirect(value: unknown, origin: string, fallback = "/") {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  try {
    const target = new URL(value, origin);
    return target.origin === origin ? `${target.pathname}${target.search}${target.hash}` : fallback;
  } catch {
    return fallback;
  }
}
