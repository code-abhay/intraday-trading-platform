import { NextResponse } from "next/server";

const JWT_COOKIE = "angel_jwt";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(JWT_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  return res;
}
