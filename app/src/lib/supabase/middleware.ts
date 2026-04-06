import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { logEvent } from "@/lib/logger";

const SESSION_COOKIE = "syg_session_start";
const SESSION_MAX_AGE = 259200; // 3 days in seconds

export async function updateSession(request: NextRequest) {
  // Generate request ID for tracing
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
  supabaseResponse.headers.set("x-request-id", requestId);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
          supabaseResponse.headers.set("x-request-id", requestId);
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 3-day session expiry check
  if (user) {
    const sessionStart = request.cookies.get(SESSION_COOKIE)?.value;
    if (sessionStart) {
      const elapsed = Math.floor(Date.now() / 1000) - parseInt(sessionStart, 10);
      if (elapsed > SESSION_MAX_AGE) {
        await supabase.auth.signOut();
        logEvent("auth.session_expired_3day", {
          success: false,
          metadata: { path: request.nextUrl.pathname, elapsed_seconds: elapsed },
        }).catch(() => {});
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        const response = NextResponse.redirect(url);
        response.cookies.delete(SESSION_COOKIE);
        return response;
      }
    }
  }

  // Redirect unauthenticated users to login (except auth pages and API routes)
  const isAuthPage =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/callback") ||
    request.nextUrl.pathname.startsWith("/reset-password") ||
    request.nextUrl.pathname.startsWith("/forgot-password");
  const isApiRoute = request.nextUrl.pathname.startsWith("/api");

  if (!user && !isAuthPage && !isApiRoute) {
    // Log session drop - fire and forget
    logEvent("auth.session_expired", {
      success: false,
      metadata: { path: request.nextUrl.pathname, reason: "no_session" },
    }).catch(() => {});

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages (except reset-password, which needs auth mid-flow)
  if (user && isAuthPage && !request.nextUrl.pathname.startsWith("/reset-password")) {
    const url = request.nextUrl.clone();
    url.pathname = "/inbox";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
