import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return NextResponse.json({ redirectTo: "/" });
  } catch (error) {
    console.error("Unable to sign out.", error);
    return NextResponse.json({ error: "Unable to sign out. Please try again." }, { status: 503 });
  }
}
