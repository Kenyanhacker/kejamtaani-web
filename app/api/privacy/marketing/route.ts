import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  let body: { optIn?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid preference." }, { status: 400 });
  }
  if (typeof body.optIn !== "boolean") return NextResponse.json({ error: "Choose whether to receive optional listing updates." }, { status: 400 });
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to update your email preferences." }, { status: 401 });
    const optedAt = body.optIn ? new Date().toISOString() : null;
    const { error } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        marketing_opt_in: body.optIn,
        marketing_opt_in_at: optedAt,
        marketing_preference_updated_at: new Date().toISOString(),
      },
    });
    if (error) throw error;
    return NextResponse.json({ optIn: body.optIn });
  } catch (error) {
    console.error("Unable to update marketing preference.", error);
    return NextResponse.json({ error: "Email preference could not be saved." }, { status: 503 });
  }
}
