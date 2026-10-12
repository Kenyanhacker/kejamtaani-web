export function isMissingAuthSession(error: unknown) {
  return error instanceof Error && error.name === "AuthSessionMissingError";
}

function getErrorMetadata(error: unknown) {
  if (!error || typeof error !== "object") return { message: "", code: "" };
  const value = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown; cause?: unknown };
  const cause = value.cause && typeof value.cause === "object"
    ? value.cause as { message?: unknown; code?: unknown }
    : null;
  const message = [value.message, value.details, value.hint, cause?.message]
    .filter((part): part is string => typeof part === "string")
    .join(" ");
  const code = [value.code, cause?.code]
    .find((part): part is string => typeof part === "string") ?? "";
  return { message, code };
}

export function getSupabaseConnectionMessage(error: unknown) {
  const { message, code } = getErrorMetadata(error);
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(`${code} ${message}`)) {
    return "The Supabase hostname could not be resolved. Check NEXT_PUBLIC_SUPABASE_URL against the Project URL in your Supabase dashboard and verify your network DNS.";
  }
  if (/ECONNREFUSED|ECONNRESET|ETIMEDOUT|fetch failed|AbortError/i.test(`${code} ${message}`)) {
    return "The website could not connect to Supabase. Check the project URL and key, then verify that your network can reach Supabase.";
  }
  if (code === "42703") {
    return "The Supabase database schema is missing a column required by this version of the site. Apply the documented schema or migrations, then try again.";
  }
  return null;
}
