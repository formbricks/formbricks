import { NextRequest, NextResponse } from "next/server";
import { logger } from "@formbricks/logger";
import { getPayload, storePayload } from "@/lib/connector/webhook-listener-store";

// Maximum payload size in bytes (100KB)
const MAX_PAYLOAD_SIZE = 100 * 1024;

/**
 * POST /api/unify/webhook-listener/[sessionId]
 * Receive an incoming webhook payload for testing
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  const { sessionId } = await props.params;

  if (!sessionId || sessionId.length < 10) {
    return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
  }

  try {
    // Check content length
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_SIZE) {
      return NextResponse.json({ error: "Payload too large. Maximum size is 100KB." }, { status: 413 });
    }

    // Parse the JSON payload
    let payload: Record<string, unknown>;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    // Validate payload is an object
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ error: "Payload must be a JSON object" }, { status: 400 });
    }

    // Store the payload
    const stored = storePayload(sessionId, payload);
    if (!stored) {
      return NextResponse.json({ error: "Failed to store payload. It may be too large." }, { status: 413 });
    }

    logger.info({ sessionId }, "Webhook payload received for session");

    return NextResponse.json({ success: true, message: "Webhook received successfully" }, { status: 200 });
  } catch (error) {
    logger.error({ error, sessionId }, "Error processing webhook payload");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/unify/webhook-listener/[sessionId]
 * Poll for a received webhook payload
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  const { sessionId } = await props.params;

  if (!sessionId || sessionId.length < 10) {
    return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
  }

  try {
    // Get the payload (and clear it from the store)
    const payload = getPayload(sessionId, true);

    if (!payload) {
      // No payload received yet - return 204 No Content
      return new NextResponse(null, { status: 204 });
    }

    // Return the payload
    return NextResponse.json({ payload }, { status: 200 });
  } catch (error) {
    logger.error({ error, sessionId }, "Error retrieving webhook payload");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * OPTIONS /api/unify/webhook-listener/[sessionId]
 * Handle CORS preflight requests
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
