import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next.js middleware:
 *  1. Generates a request ID (x-request-id) for every request
 *  2. Refreshes the Supabase auth session
 *  3. Redirects unauthenticated users to /login
 */
export async function middleware(request: NextRequest) {
  // --- 1. Request ID ---
  const requestId = crypto.randomUUID();

  // Clone request headers so we can inject x-request-id for downstream routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Stamp the response too (useful for debugging from browser devtools)
  supabaseResponse.headers.set("x-request-id", requestId);

  // --- 2. Supabase session refresh ---
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
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

  // --- 3. Auth redirects ---
  const isAuthPage =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/callback");
  const isApiRoute = request.nextUrl.pathname.startsWith("/api");

  if (!user && !isAuthPage && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/inbox";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and images.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
