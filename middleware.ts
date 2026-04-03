import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optional HTTP Basic Auth for `/ops/*` when both env vars are set.
 * Does not protect `/api/*` (use CRON_SECRET on cron routes separately).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/ops")) {
    return NextResponse.next();
  }

  const user = process.env.OPS_BASIC_AUTH_USER?.trim();
  const pass = process.env.OPS_BASIC_AUTH_PASSWORD?.trim();
  if (!user || !pass) {
    return NextResponse.next();
  }

  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) {
    return unauthorized();
  }

  let decoded: string;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return unauthorized();
  }

  const sep = decoded.indexOf(":");
  const u = sep >= 0 ? decoded.slice(0, sep) : "";
  const p = sep >= 0 ? decoded.slice(sep + 1) : "";
  if (u !== user || p !== pass) {
    return unauthorized();
  }

  return NextResponse.next();
}

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Ops", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/ops/:path*"],
};
