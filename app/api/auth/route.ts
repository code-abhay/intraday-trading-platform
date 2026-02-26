import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const SITE_PASSWORD = process.env.SITE_PASSWORD || "admin123";

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

    if (password !== SITE_PASSWORD) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const token = hashToken(SITE_PASSWORD);
    const cookieStore = await cookies();
    cookieStore.set("site_auth", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("site_auth");
  return NextResponse.json({ success: true });
}

export function getExpectedToken(): string {
  return hashToken(SITE_PASSWORD);
}
