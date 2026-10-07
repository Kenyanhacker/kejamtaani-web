import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Image storage is not configured." }, { status: 503 });

  try {
    const supabase = await createSupabaseServerClient();
    const { data: image, error } = await supabase.from("listing_images").select("storage_path,url,is_approved").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!image) return NextResponse.json({ error: "Image not found." }, { status: 404 });
    if (image.storage_path) {
      const { data, error: signError } = await supabase.storage.from("listing-photos").createSignedUrl(image.storage_path, 3600);
      if (signError) throw signError;
      return NextResponse.redirect(data.signedUrl, { status: 302, headers: { "Cache-Control": "private, no-store" } });
    }
    if (image.is_approved && image.url.startsWith("https://")) {
      return NextResponse.redirect(image.url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  } catch (error) {
    console.error("Unable to serve listing image.", error);
    return NextResponse.json({ error: "Image is temporarily unavailable." }, { status: 503 });
  }
}
