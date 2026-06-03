import { type NextRequest } from "next/server";
import { problemPayloadTooLarge } from "@/app/api/v3/lib/response";
import { DEFAULT_REQUEST_BODY_LIMIT_BYTES } from "@/app/lib/api/request-body";
import { handleAuthenticatedMcpRequest } from "@/modules/mcp/auth";
import { mcpHandler } from "@/modules/mcp/server";

export const runtime = "nodejs";
export const fetchCache = "force-no-store";

function getRequestId(request: NextRequest): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

function getContentLength(headers: Headers): number | null {
  const contentLength = headers.get("content-length");
  if (!contentLength) {
    return null;
  }

  const parsedContentLength = Number(contentLength);
  return Number.isSafeInteger(parsedContentLength) && parsedContentLength >= 0 ? parsedContentLength : null;
}

function validateMcpBodySize(request: NextRequest): Response | null {
  const contentLength = getContentLength(request.headers);
  if (contentLength === null || contentLength <= DEFAULT_REQUEST_BODY_LIMIT_BYTES) {
    return null;
  }

  return problemPayloadTooLarge(
    getRequestId(request),
    `Request body must not exceed ${DEFAULT_REQUEST_BODY_LIMIT_BYTES} bytes`,
    request.nextUrl.pathname
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  const bodySizeResponse = validateMcpBodySize(request);
  if (bodySizeResponse) {
    return bodySizeResponse;
  }

  return await handleAuthenticatedMcpRequest(request, mcpHandler);
}
