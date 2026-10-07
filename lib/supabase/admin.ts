import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

export function isConfiguredAdmin(user: User) {
  const confirmed = Boolean(user.email_confirmed_at || user.confirmed_at);
  const provider = user.app_metadata.provider;
  const providers = user.app_metadata.providers;
  const signedInWithGoogle = provider === "google"
    || (Array.isArray(providers) && providers.includes("google"));
  const email = user.email?.toLowerCase();
  const allowedEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return confirmed && signedInWithGoogle && email !== undefined
    && allowedEmails.includes(email);
}

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Admin access requires NEXT_PUBLIC_SUPABASE_URL and the server-only SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
