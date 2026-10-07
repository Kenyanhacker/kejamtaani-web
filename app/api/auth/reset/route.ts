import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Password recovery is not configured." }, { status: 503 });
  let body: { email?: unknown; code?: unknown; accessToken?: unknown; refreshToken?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
  }
  const supabase = await createSupabaseServerClient();
  if (typeof body.code === "string" && body.code.length > 0 && body.code.length <= 2048) {
    const { error } = await supabase.auth.exchangeCodeForSession(body.code);
    if (error) {
      console.error("Unable to exchange password recovery code.", error.message);
      return NextResponse.json({ error: "This recovery link is invalid or expired. Request a new link." }, { status: 400 });
    }
    return NextResponse.json({ recovery: true });
  }
  if (typeof body.accessToken === "string" && typeof body.refreshToken === "string"
    && body.accessToken.length <= 4096 && body.refreshToken.length <= 4096) {
    const { error } = await supabase.auth.setSession({ access_token: body.accessToken, refresh_token: body.refreshToken });
    if (error) {
      console.error("Unable to establish password recovery session.", error.message);
      return NextResponse.json({ error: "This recovery link is invalid or expired. Request a new link." }, { status: 400 });
    }
    return NextResponse.json({ recovery: true });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  try {
    const redirectTo = new URL("/auth/reset", process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin).toString();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      console.error("Unable to request password recovery.", error.message);
      return NextResponse.json({ error: "Password recovery is temporarily unavailable. Try again later." }, { status: 503 });
    }
    return NextResponse.json({ message: "If an account exists for that email, a password reset link has been sent." });
  } catch (error) {
    console.error("Unable to process password recovery.", error);
    return NextResponse.json({ error: "Password recovery is temporarily unavailable. Try again later." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Password recovery is not configured." }, { status: 503 });
  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
  }
  if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 72) {
    return NextResponse.json({ error: "Password must be between 8 and 72 characters." }, { status: 400 });
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || !user) return NextResponse.json({ error: "This recovery link is invalid or expired. Request a new link." }, { status: 401 });
    const { error } = await supabase.auth.updateUser({ password: body.password });
    if (error) {
      console.error("Unable to update account password.", error.message);
      return NextResponse.json({ error: "Password could not be updated. Request a new recovery link and try again." }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to process password update.", error);
    return NextResponse.json({ error: "Password recovery is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
