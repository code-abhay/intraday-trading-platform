import { NextRequest, NextResponse } from "next/server";

function getPassword(): string | null {
  const configuredPassword = process.env.SITE_PASSWORD?.trim();
  if (configuredPassword) return configuredPassword;
  if (process.env.NODE_ENV !== "production") return "admin123";
  return null;
}

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }

    const sitePassword = getPassword();
    if (!sitePassword) {
      return NextResponse.json(
        { error: "SITE_PASSWORD is not configured on server" },
        { status: 503 }
      );
    }

    if (password !== sitePassword) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const token = hashToken(sitePassword);
    const res = NextResponse.json({ success: true });
    res.cookies.set("site_auth", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return res;
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set("site_auth", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  return res;
}
