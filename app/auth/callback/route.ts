import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUserRole } from "@/lib/supabase/roles";
import { safeInternalRedirect } from "@/lib/safe-redirect";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { isConfiguredAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const role = request.nextUrl.searchParams.get("role");
  const next = request.nextUrl.searchParams.get("next");
  const redirectTo = safeInternalRedirect(next, request.nextUrl.origin, role === "landlord" ? "/dashboard/landlord" : "/dashboard/tenant");
  if (!code || !isUserRole(role)) return NextResponse.redirect(new URL("/auth?error=confirmation", request.url));

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError ?? new Error("The confirmed account could not be loaded.");
    if (user.app_metadata.provider === "google") {
      const consentAccepted = request.nextUrl.searchParams.get("acceptedPolicies") === "true"
        && request.nextUrl.searchParams.get("termsVersion") === TERMS_VERSION
        && request.nextUrl.searchParams.get("privacyVersion") === PRIVACY_VERSION;
      if (!consentAccepted) throw new Error("Required policy acknowledgement is missing.");
      const marketingOptIn = request.nextUrl.searchParams.get("marketingOptIn") === "true"
        || user.user_metadata.marketing_opt_in === true;
      if (user.user_metadata.terms_version !== TERMS_VERSION
        || user.user_metadata.privacy_version !== PRIVACY_VERSION
        || user.user_metadata.marketing_opt_in !== marketingOptIn) {
        const acceptedAt = new Date().toISOString();
        const { error: consentError } = await supabase.auth.updateUser({
          data: {
            ...user.user_metadata,
            terms_accepted_at: acceptedAt,
            terms_version: TERMS_VERSION,
            privacy_acknowledged_at: acceptedAt,
            privacy_version: PRIVACY_VERSION,
            marketing_opt_in: marketingOptIn,
            marketing_opt_in_at: marketingOptIn ? acceptedAt : null,
          },
        });
        if (consentError) throw consentError;
      }
    }
    if (isConfiguredAdmin(user)) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, role_locked")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile) throw profileError ?? new Error("The account profile has not been created.");
    if (!profile.role_locked) {
      const { error: roleError } = await supabase.rpc("set_initial_profile_role", { requested_role: role });
      if (roleError) throw roleError;
    }
    const roleRedirect = profile.role_locked
      ? profile.role === "landlord" ? "/dashboard/landlord" : "/dashboard/tenant"
      : role === "landlord" ? "/dashboard/landlord" : "/dashboard/tenant";
    return NextResponse.redirect(new URL(next ? safeInternalRedirect(next, request.nextUrl.origin, roleRedirect) : roleRedirect, request.url));
  } catch (error) {
    console.error("Unable to complete account confirmation.", error);
    return NextResponse.redirect(new URL("/auth?error=confirmation", request.url));
  }
}
