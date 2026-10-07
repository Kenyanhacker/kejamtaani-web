import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Free launch mode is active: viewing requests and listings are free. No payment flow is enabled.",
    },
    { status: 410 },
  );
}
