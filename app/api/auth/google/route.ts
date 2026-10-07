import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUserRole } from "@/lib/supabase/roles";
import { safeInternalRedirect } from "@/lib/safe-redirect";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";

export async function GET(request: NextRequest) {
  const role = request.nextUrl.searchParams.get("role");
  if (!isUserRole(role)) return NextResponse.redirect(new URL("/auth?error=role", request.url));
  if (request.nextUrl.searchParams.get("acceptedPolicies") !== "true") {
    return NextResponse.redirect(new URL("/auth?error=consent", request.url));
  }
  const marketingOptIn = request.nextUrl.searchParams.get("marketingOptIn") === "true";
  const next = request.nextUrl.searchParams.get("next");
  const safeNext = safeInternalRedirect(next, request.nextUrl.origin);

  try {
    const supabase = await createSupabaseServerClient();
    const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
    const callback = new URL("/auth/callback", appOrigin);
    callback.searchParams.set("role", role);
    callback.searchParams.set("next", safeNext);
    callback.searchParams.set("acceptedPolicies", "true");
    callback.searchParams.set("marketingOptIn", String(marketingOptIn));
    callback.searchParams.set("termsVersion", TERMS_VERSION);
    callback.searchParams.set("privacyVersion", PRIVACY_VERSION);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
    if (error || !data.url) throw error ?? new Error("Google did not return a sign-in URL.");
    const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
    if (new URL(data.url).origin !== supabaseOrigin) {
      throw new Error("Google authorization URL is invalid.");
    }
    return NextResponse.redirect(data.url);
  } catch (error) {
    console.error("Unable to start Google sign-in.", error);
    return NextResponse.redirect(new URL("/auth?error=google", request.url));
  }
}
