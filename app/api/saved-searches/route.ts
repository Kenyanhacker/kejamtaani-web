import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const FILTER_LIMITS: Record<string, number> = {
  q: 80, estate: 60, type: 80, minRent: 10, maxRent: 10, water: 40, gated: 1, sort: 20, lat: 20, lng: 20, radius: 2,
};

function cleanFilters(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result: Record<string, string> = {};
  for (const [key, limit] of Object.entries(FILTER_LIMITS)) {
    const entry = (value as Record<string, unknown>)[key];
    if (entry === undefined || entry === "") continue;
    if (typeof entry !== "string" || entry.length > limit) return null;
    result[key] = entry;
  }
  return result;
}

async function tenantClient() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { response: NextResponse.json({ error: "Sign in as a tenant to save searches." }, { status: 401 }) };
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (error) throw error;
  if (profile?.role !== "tenant") return { response: NextResponse.json({ error: "Only tenant accounts can save searches." }, { status: 403 }) };
  return { supabase, user };
}

export async function GET() {
  try {
    const result = await tenantClient();
    if ("response" in result) return result.response;
    const { data, error } = await result.supabase.from("saved_searches").select("id,name,filters,created_at").eq("user_id", result.user.id).order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ searches: data });
  } catch (error) {
    console.error("Unable to load saved searches.", error);
    return NextResponse.json({ error: "Saved searches are unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  let body: { name?: unknown; filters?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send valid saved-search details." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const filters = cleanFilters(body.filters);
  if (name.length < 2 || name.length > 80 || !filters || Object.keys(filters).length === 0) {
    return NextResponse.json({ error: "Add a name and at least one valid search filter." }, { status: 400 });
  }
  try {
    const result = await tenantClient();
    if ("response" in result) return result.response;
    const { count, error: countError } = await result.supabase.from("saved_searches").select("id", { count: "exact", head: true }).eq("user_id", result.user.id);
    if (countError) throw countError;
    if ((count ?? 0) >= 20) return NextResponse.json({ error: "You can save up to 20 searches." }, { status: 429 });
    const { error } = await result.supabase.from("saved_searches").insert({ user_id: result.user.id, name, filters });
    if (error) throw error;
    return NextResponse.json({ saved: true }, { status: 201 });
  } catch (error) {
    console.error("Unable to save search.", error);
    return NextResponse.json({ error: "This search could not be saved." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid saved search." }, { status: 400 });
  }
  try {
    const result = await tenantClient();
    if ("response" in result) return result.response;
    const { data, error } = await result.supabase.from("saved_searches").delete().eq("id", id).eq("user_id", result.user.id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Saved search not found." }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Unable to delete saved search.", error);
    return NextResponse.json({ error: "Saved search could not be deleted." }, { status: 503 });
  }
}
