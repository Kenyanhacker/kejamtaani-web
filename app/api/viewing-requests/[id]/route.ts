import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid viewing request." }, { status: 400 });
  }
  let body: { status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid status update." }, { status: 400 });
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to update a viewing request." }, { status: 401 });
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    const status = body.status;
    const { data: current, error: currentError } = await supabase.from("viewing_requests").select("id,status").eq("id", id).maybeSingle();
    if (currentError) throw currentError;
    if (!current) return NextResponse.json({ error: "Viewing request not found or access denied." }, { status: 404 });
    const landlordTransition = profile?.role === "landlord"
      && ((current.status === "pending" && (status === "accepted" || status === "declined"))
        || (current.status === "accepted" && status === "completed"));
    const tenantTransition = profile?.role === "tenant"
      && (current.status === "pending" || current.status === "accepted") && status === "cancelled";
    if (!landlordTransition && !tenantTransition) {
      return NextResponse.json({ error: "That status transition is not allowed for this account." }, { status: 409 });
    }
    const { data, error } = await supabase.from("viewing_requests").update({ status, updated_at: new Date().toISOString() })
      .eq("id", id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Viewing request not found or access denied." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to update viewing request.", error);
    return NextResponse.json({ error: "Viewing request could not be updated." }, { status: 503 });
  }
}
