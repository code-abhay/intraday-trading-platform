import { NextResponse } from "next/server";

/**
 * Verify Angel One env vars are set (no values exposed).
 * GET /api/angel-one/verify-env
 */
export async function GET() {
  const apiKey = process.env.ANGEL_API_KEY;
  const clientId = process.env.ANGEL_CLIENT_ID;
  const pin = process.env.ANGEL_PIN;

  const status = {
    ANGEL_API_KEY: apiKey ? "set" : "missing",
    ANGEL_CLIENT_ID: clientId ? "set" : "missing",
    ANGEL_PIN: pin ? "set" : "missing",
    allConfigured: !!(apiKey && clientId && pin),
  };

  return NextResponse.json(status);
}
