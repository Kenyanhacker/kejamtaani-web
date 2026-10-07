import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const REQUEST_TYPES = ["access", "correction", "deletion"] as const;

export async function POST(request: NextRequest) {
  let body: { requestType?: unknown; details?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid privacy request." }, { status: 400 });
  }
  const requestType = body.requestType;
  const details = typeof body.details === "string" ? body.details.trim() : "";
  if (!REQUEST_TYPES.includes(requestType as (typeof REQUEST_TYPES)[number]) || details.length > 1000) {
    return NextResponse.json({ error: "Choose a request type and keep details under 1,000 characters." }, { status: 400 });
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to submit a privacy request." }, { status: 401 });
    const { data, error } = await supabase.from("privacy_requests").insert({
      user_id: user.id,
      request_type: requestType,
      details: details || null,
    }).select("id").single();
    if (error) throw error;
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    console.error("Unable to submit privacy request.", error);
    return NextResponse.json({ error: "Your privacy request could not be saved. Email ceejaycreationofficial@gmail.com for assistance." }, { status: 503 });
  }
}
