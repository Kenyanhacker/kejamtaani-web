import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUserRole } from "@/lib/supabase/roles";
import { safeInternalRedirect } from "@/lib/safe-redirect";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") return NextResponse.json({ error: "Invalid account request." }, { status: 400 });
  const body = payload as Record<string, unknown>;
  const mode = body.mode;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role;
  const acceptedPolicies = body.acceptedPolicies === true;
  const marketingOptIn = body.marketingOptIn === true;
  const next = safeInternalRedirect(body.next, request.nextUrl.origin);
  if (mode !== "signin" && mode !== "signup") return NextResponse.json({ error: "Choose sign in or create account." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (password.length < 8 || password.length > 72) return NextResponse.json({ error: "Password must be between 8 and 72 characters." }, { status: 400 });
  if (mode === "signup" && !isUserRole(role)) return NextResponse.json({ error: "Choose tenant or landlord." }, { status: 400 });
  if (mode === "signup" && !acceptedPolicies) return NextResponse.json({ error: "Accept the Terms of Use and acknowledge the Privacy Notice to create an account." }, { status: 400 });

  try {
    const supabase = await createSupabaseServerClient();
    if (mode === "signup") {
      const callback = new URL("/auth/callback", process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin);
      callback.searchParams.set("role", role as string);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: callback.toString(),
          data: {
            role,
            terms_accepted_at: new Date().toISOString(),
            terms_version: TERMS_VERSION,
            privacy_acknowledged_at: new Date().toISOString(),
            privacy_version: PRIVACY_VERSION,
            marketing_opt_in: marketingOptIn,
            ...(marketingOptIn ? { marketing_opt_in_at: new Date().toISOString() } : {}),
          },
        },
      });
      if (error) {
        console.error("Supabase account sign-up failed.", error.message);
        return NextResponse.json({ error: "Unable to create the account. Check the details or try again later." }, { status: 400 });
      }
      return NextResponse.json({ message: "Check your email for a confirmation link before signing in." });
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("Supabase email sign-in failed.", error.message);
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    return NextResponse.json({ redirectTo: next });
  } catch (error) {
    console.error("Unable to process email authentication.", error);
    return NextResponse.json({ error: "Authentication is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
