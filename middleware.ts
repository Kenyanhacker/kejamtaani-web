import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { isMissingAuthSession } from "@/lib/supabase/errors";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");

  if (!url || !key) {
    if (!isDashboard) return NextResponse.next();
    const setupUrl = new URL("/auth?setup=required", request.url);
    return NextResponse.redirect(setupUrl);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, {
          ...options,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        }));
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error && !isMissingAuthSession(error)) {
    console.error("Unable to validate Supabase session.", error.message);
  }
  if (isDashboard && (!user || error)) {
    const loginUrl = new URL("/auth", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
