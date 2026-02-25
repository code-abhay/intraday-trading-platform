import { NextRequest, NextResponse } from "next/server";
import { angelOneLogin } from "@/lib/angel-one";

const JWT_COOKIE = "angel_jwt";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANGEL_API_KEY;
  const clientId = process.env.ANGEL_CLIENT_ID;
  const pin = process.env.ANGEL_PIN;

  if (!apiKey || !clientId || !pin) {
    return NextResponse.json(
      {
        error: "Angel One not configured",
        details: "Set ANGEL_API_KEY, ANGEL_CLIENT_ID, ANGEL_PIN in .env.local",
      },
      { status: 400 }
    );
  }

  let body: { totp?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const totp = body.totp?.trim();
  if (!totp || !/^\d{6}$/.test(totp)) {
    return NextResponse.json(
      { error: "Valid 6-digit TOTP required" },
      { status: 400 }
    );
  }

  try {
    const tokens = await angelOneLogin(
      { apiKey, clientId, pin },
      totp
    );

    const res = NextResponse.json({
      success: true,
      message: "Login successful. Session valid until midnight IST.",
    });

    res.cookies.set(JWT_COOKIE, tokens.jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    console.error("[angel-one/login] Error:", message);
    return NextResponse.json(
      { error: "Login failed", details: message },
      { status: 401 }
    );
  }
}
