import { NextRequest, NextResponse } from "next/server";
import { runMarketDataIngestion } from "@/lib/market-data-ingestion";
import { SEGMENTS, type SegmentId } from "@/lib/segments";

const JWT_COOKIE = "angel_jwt";
const INGEST_SECRET_HEADER = "x-ingest-secret";
const ANGEL_JWT_HEADER = "x-angel-jwt";

function isValidSegment(segment?: string): segment is SegmentId {
  if (!segment) return false;
  return SEGMENTS.some((item) => item.id === segment);
}

function isIngestionAuthorized(request: NextRequest, hasJwtToken: boolean): boolean {
  const secret = (process.env.INGEST_CRON_SECRET ?? process.env.CRON_SECRET)?.trim();
  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  const headerSecret = request.headers.get(INGEST_SECRET_HEADER)?.trim();
  const querySecret = request.nextUrl.searchParams.get("secret")?.trim();

  // No shared secret configured: keep local/dev behavior permissive, but require auth in production.
  if (!secret) {
    return process.env.NODE_ENV !== "production" || hasJwtToken;
  }

  if (headerSecret === secret || querySecret === secret || bearerToken === secret) return true;
  return hasJwtToken;
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.ANGEL_API_KEY;
  const jwtToken =
    request.headers.get(ANGEL_JWT_HEADER)?.trim() ||
    request.cookies.get(JWT_COOKIE)?.value?.trim() ||
    process.env.ANGEL_JWT_TOKEN?.trim() ||
    undefined;
  const segment = request.nextUrl.searchParams.get("segment") ?? undefined;

  if (!isIngestionAuthorized(request, Boolean(jwtToken))) {
    return NextResponse.json(
      {
        error:
          "Unauthorized ingestion request. Provide x-ingest-secret header or a valid login session.",
      },
      { status: 401 }
    );
  }

  if (segment && !isValidSegment(segment)) {
    return NextResponse.json(
      {
        error: "Invalid segment value",
        allowedSegments: SEGMENTS.map((item) => item.id),
      },
      { status: 400 }
    );
  }

  const result = await runMarketDataIngestion({
    mode: "daily",
    apiKey,
    jwtToken,
    segmentId: segment as SegmentId | undefined,
  });

  const statusCode =
    result.status === "SUCCESS" ? 200 : result.status === "PARTIAL" ? 207 : 500;
  return NextResponse.json(result, { status: statusCode });
}
