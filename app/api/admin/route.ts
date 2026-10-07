import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, isConfiguredAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireAdmin() {
  const sessionClient = await createSupabaseServerClient();
  const { data: { user }, error } = await sessionClient.auth.getUser();
  if (error) {
    if (error.name === "AuthSessionMissingError") {
      return { response: NextResponse.json({ error: "Sign in with the authorized Google account." }, { status: 401 }) };
    }
    console.error("Unable to verify admin API session.", error.message);
    return { response: NextResponse.json({ error: "Your session could not be verified." }, { status: 503 }) };
  }
  if (!user) return { response: NextResponse.json({ error: "Sign in with the authorized Google account." }, { status: 401 }) };
  if (!isConfiguredAdmin(user)) return { response: NextResponse.json({ error: "Administrator access is not allowed for this account." }, { status: 403 }) };
  return { admin: createSupabaseAdminClient(), user };
}

function hasSameOrigin(request: NextRequest) {
  return request.headers.get("origin") === request.nextUrl.origin;
}

export async function GET() {
  try {
    const access = await requireAdmin();
    if ("response" in access) return access.response;
    const db = access.admin;
    const [pendingResult, publishedResult, reportsResult, privacyResult] = await Promise.all([
      db.from("listings")
        .select("id,title,description,building_name,address,estate,constituency,county,latitude,longitude,property_type,rent_cents,deposit_months,garbage_fee_cents,water_deposit_cents,water_supply,electricity_arrangement,gated,cctv,security_guard,furnished,wifi_available,parking,amenities,deposit_rule,tour_url,availability_status,availability_date,current_status,is_demo,created_at,updated_at,landlord_id,landlord:profiles!listings_landlord_id_fkey(email)", { count: "exact" })
        .eq("current_status", "pending_review")
        .eq("is_demo", false)
        .order("created_at", { ascending: true })
        .limit(100),
      db.from("listings")
        .select("id,title,estate,county,property_type,rent_cents,availability_status,current_status,published_at,updated_at,landlord_id,landlord:profiles!listings_landlord_id_fkey(email)", { count: "exact" })
        .eq("current_status", "published")
        .eq("is_demo", false)
        .order("published_at", { ascending: false })
        .limit(100),
      db.from("listing_reports")
        .select("id,listing_id,reporter_id,reason,details,status,created_at,resolution_note,listing:listings!listing_reports_listing_id_fkey(title,estate),reporter:profiles!listing_reports_reporter_id_fkey(email)", { count: "exact" })
        .eq("status", "open")
        .order("created_at", { ascending: true })
        .limit(100),
      db.from("privacy_requests")
        .select("id,user_id,request_type,details,status,created_at,resolution_note,requester:profiles!privacy_requests_user_id_fkey(email)", { count: "exact" })
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: true })
        .limit(100),
    ]);

    for (const result of [pendingResult, publishedResult, reportsResult, privacyResult]) {
      if (result.error) throw result.error;
    }

    const pendingIds = (pendingResult.data ?? []).map((listing) => listing.id);
    const imageResult = pendingIds.length
      ? await db.from("listing_images")
        .select("id,listing_id,storage_path,is_primary,created_at")
        .in("listing_id", pendingIds)
        .order("is_primary", { ascending: false })
      : { data: [], error: null };
    if (imageResult.error) throw imageResult.error;

    const images = await Promise.all((imageResult.data ?? []).map(async (image) => {
      if (!image.storage_path) return { ...image, signedUrl: null };
      const { data, error } = await db.storage.from("listing-photos").createSignedUrl(image.storage_path, 900);
      if (error) {
        console.error("Unable to create admin listing image URL.", error.message);
        return { ...image, signedUrl: null };
      }
      return { ...image, signedUrl: data.signedUrl };
    }));

    return NextResponse.json({
      adminEmail: access.user.email,
      limits: { pending: 100, published: 100, reports: 100, privacyRequests: 100 },
      counts: {
        pending: pendingResult.count ?? 0,
        published: publishedResult.count ?? 0,
        reports: reportsResult.count ?? 0,
        privacyRequests: privacyResult.count ?? 0,
      },
      pending: pendingResult.data ?? [],
      published: publishedResult.data ?? [],
      reports: reportsResult.data ?? [],
      privacyRequests: privacyResult.data ?? [],
      images,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Unable to load admin dashboard.", error);
    return NextResponse.json({ error: "Admin data could not be loaded. Check the database schema and server configuration." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ error: "Send a valid moderation request." }, { status: 400 });
    }
    body = payload as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
  }

  const entity = body.entity;
  const action = body.action;
  const id = body.id;
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if ((entity !== "listing" && entity !== "report" && entity !== "privacy_request")
    || typeof action !== "string"
    || typeof id !== "string" || !UUID.test(id)
    || note.length > 1000) {
    return NextResponse.json({ error: "Check the moderation action and try again." }, { status: 400 });
  }
  if (entity === "listing" && (!["approve", "reject"].includes(action) || (action === "reject" && !note))) {
    return NextResponse.json({ error: "Approving or rejecting requires a valid action; a rejection reason is required." }, { status: 400 });
  }
  if (entity === "report" && !["resolve", "dismiss"].includes(action)) {
    return NextResponse.json({ error: "Choose resolve or dismiss for the report." }, { status: 400 });
  }
  if (entity === "privacy_request" && !["in_progress", "completed", "rejected"].includes(action)) {
    return NextResponse.json({ error: "Choose a valid privacy-request status." }, { status: 400 });
  }

  try {
    const access = await requireAdmin();
    if ("response" in access) return access.response;
    const db = access.admin;

    if (entity === "listing") {
      const { error } = await db.rpc("admin_review_listing", {
        target_listing: id,
        approve: action === "approve",
        moderator: access.user.id,
        note: note || null,
      });
      if (error) throw error;
    } else if (entity === "report") {
      const { data, error } = await db.from("listing_reports").update({
        status: action === "resolve" ? "resolved" : "dismissed",
        resolution_note: note || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: access.user.id,
      }).eq("id", id).eq("status", "open").select("id").maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "This report is no longer open. Refresh the dashboard." }, { status: 409 });
    } else {
      const { data, error } = await db.from("privacy_requests").update({
        status: action,
        resolution_note: note || null,
        resolved_at: action === "in_progress" ? null : new Date().toISOString(),
        resolved_by: access.user.id,
      }).eq("id", id).in("status", ["open", "in_progress"]).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "This privacy request is no longer open. Refresh the dashboard." }, { status: 409 });
    }

    return NextResponse.json({ updated: true });
  } catch (error) {
    console.error("Unable to process admin moderation action.", error);
    return NextResponse.json({ error: "The moderation action could not be saved. Check the database migration and try again." }, { status: 503 });
  }
}
