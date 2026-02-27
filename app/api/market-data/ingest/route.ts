import { NextRequest, NextResponse } from "next/server";
import {
  runMarketDataIngestion,
  type IngestionMode,
} from "@/lib/market-data-ingestion";
import { SEGMENTS, type SegmentId } from "@/lib/segments";

const JWT_COOKIE = "angel_jwt";
const INGEST_SECRET_HEADER = "x-ingest-secret";
const ANGEL_JWT_HEADER = "x-angel-jwt";

function isValidSegment(segment?: string): segment is SegmentId {
  if (!segment) return false;
  return SEGMENTS.some((item) => item.id === segment);
}

function isIngestionAuthorized(request: NextRequest, hasJwtToken: boolean): boolean {
  const secret = process.env.INGEST_CRON_SECRET ?? process.env.CRON_SECRET;
  if (!secret) return true;
  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  const providedSecret =
    request.headers.get(INGEST_SECRET_HEADER) ??
    request.nextUrl.searchParams.get("secret");
  if (providedSecret === secret || bearerToken === secret) return true;
  return hasJwtToken;
}

function parseMode(mode?: string): IngestionMode {
  return mode === "daily" ? "daily" : "intraday";
}

async function handleIngestion(
  request: NextRequest,
  mode: IngestionMode,
  requestedSegment?: string,
  jwtFromBody?: string
) {
  const apiKey = process.env.ANGEL_API_KEY;
  const jwtToken =
    jwtFromBody?.trim() ||
    request.headers.get(ANGEL_JWT_HEADER)?.trim() ||
    request.cookies.get(JWT_COOKIE)?.value?.trim() ||
    process.env.ANGEL_JWT_TOKEN?.trim() ||
    undefined;

  if (!isIngestionAuthorized(request, Boolean(jwtToken))) {
    return NextResponse.json(
      {
        error:
          "Unauthorized ingestion request. Provide x-ingest-secret header or a valid login session.",
      },
      { status: 401 }
    );
  }

  if (requestedSegment && !isValidSegment(requestedSegment)) {
    return NextResponse.json(
      {
        error: "Invalid segment value",
        allowedSegments: SEGMENTS.map((item) => item.id),
      },
      { status: 400 }
    );
  }

  const result = await runMarketDataIngestion({
    mode,
    apiKey,
    jwtToken,
    segmentId: requestedSegment as SegmentId | undefined,
  });

  const statusCode =
    result.status === "SUCCESS" ? 200 : result.status === "PARTIAL" ? 207 : 500;
  return NextResponse.json(result, { status: statusCode });
}

export async function GET(request: NextRequest) {
  const mode = parseMode(request.nextUrl.searchParams.get("mode") ?? undefined);
  const segment = request.nextUrl.searchParams.get("segment") ?? undefined;
  return handleIngestion(request, mode, segment);
}

export async function POST(request: NextRequest) {
  let body: { mode?: string; segment?: string; jwtToken?: string };
  try {
    body = (await request.json()) as { mode?: string; segment?: string; jwtToken?: string };
  } catch {
    body = {};
  }

  const mode = parseMode(body.mode);
  return handleIngestion(request, mode, body.segment, body.jwtToken);
}
