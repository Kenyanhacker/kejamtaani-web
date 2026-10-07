import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";

function isListingId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getLandlord(requestId: string) {
  if (!hasSupabaseConfig()) return { response: NextResponse.json({ error: "Photo storage is not configured." }, { status: 503 }) };
  if (!isListingId(requestId)) return { response: NextResponse.json({ error: "Invalid listing ID." }, { status: 400 }) };
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { response: NextResponse.json({ error: "Sign in as a landlord to upload photos." }, { status: 401 }) };
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (error) {
    console.error("Unable to verify photo upload account.", error);
    return { response: NextResponse.json({ error: "Your account could not be verified." }, { status: 503 }) };
  }
  if (profile?.role !== "landlord") return { response: NextResponse.json({ error: "Only landlord accounts can upload listing photos." }, { status: 403 }) };
  return { supabase, userId: user.id };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getLandlord(id);
  if ("response" in result) return result.response;
  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("image");
  } catch {
    return NextResponse.json({ error: "Send a valid image upload." }, { status: 400 });
  }
  if (!(file instanceof File) || file.type !== "image/webp" || file.size < 1 || file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Photos must be WebP images smaller than 2 MB." }, { status: 400 });
  }
  const header = new TextDecoder().decode(await file.slice(0, 12).arrayBuffer());
  if (!header.startsWith("RIFF") || header.slice(8, 12) !== "WEBP") {
    return NextResponse.json({ error: "The uploaded file is not a valid WebP image." }, { status: 400 });
  }

  const path = `${result.userId}/${id}/${crypto.randomUUID()}.webp`;
  const { error } = await result.supabase.storage.from("listing-photos").upload(path, file, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    console.error("Unable to upload landlord listing photo.", error);
    return NextResponse.json({ error: "Photo upload failed. Please try again." }, { status: 503 });
  }
  return NextResponse.json({ path }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getLandlord(id);
  if ("response" in result) return result.response;
  let body: { photoPaths?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid photo cleanup request." }, { status: 400 });
  }
  if (!Array.isArray(body.photoPaths) || body.photoPaths.length > 5
    || !body.photoPaths.every((path): path is string => typeof path === "string" && path.startsWith(`${result.userId}/${id}/`))) {
    return NextResponse.json({ error: "Invalid photo paths." }, { status: 400 });
  }
  const { error } = await result.supabase.storage.from("listing-photos").remove(body.photoPaths);
  if (error) {
    console.error("Unable to clean up landlord listing photos.", error);
    return NextResponse.json({ error: "Uploaded photos could not be removed." }, { status: 503 });
  }
  return NextResponse.json({ success: true });
}
