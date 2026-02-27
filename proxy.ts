import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/auth",
  "/api/auth",
  "/api/market-data/ingest",
  "/terms",
  "/privacy",
  "/disclaimer",
];

function hashToken(password: string): string {
  let hash = 0;
  const str = `${password}_intraday_platform_salt`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `auth_${Math.abs(hash).toString(36)}`;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg")
  ) {
    return NextResponse.next();
  }

  const sitePassword = process.env.SITE_PASSWORD || "admin123";
  const expectedToken = hashToken(sitePassword);
  const authCookie = req.cookies.get("site_auth")?.value;

  if (authCookie !== expectedToken) {
    const loginUrl = new URL("/auth", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
