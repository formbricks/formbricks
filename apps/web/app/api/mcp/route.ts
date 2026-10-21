import { type NextRequest } from "next/server";
import { problemPayloadTooLarge } from "@/app/api/v3/lib/response";
import {
  DEFAULT_REQUEST_BODY_LIMIT_BYTES,
  RequestBodyTooLargeError,
  readRequestBodyWithLimit,
} from "@/app/lib/api/request-body";
import { handleAuthenticatedMcpRequest } from "@/modules/mcp/auth";
import { getMcpRequestBudgetError } from "@/modules/mcp/request-budget";
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

// Bound the actual stream before mcp-handler clones and parses it. Content-Length alone
// does not protect chunked requests (GHSA-46jr-4wx8-v453).
async function handleBoundedMcpRequest(request: Request): Promise<Response> {
  let body: string;
  try {
    body = await readRequestBodyWithLimit(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return problemPayloadTooLarge(
        request.headers.get("x-request-id") ?? crypto.randomUUID(),
        `Request body must not exceed ${DEFAULT_REQUEST_BODY_LIMIT_BYTES} bytes`,
        new URL(request.url).pathname
      );
    }
    throw error;
  }

  let message: unknown;
  try {
    message = JSON.parse(body);
  } catch {
    // Preserve the SDK's response to malformed JSON.
    message = undefined;
  }

  const budgetError = getMcpRequestBudgetError(message);
  if (budgetError) {
    return Response.json(
      {
        jsonrpc: "2.0",
        id: typeof message === "object" && message !== null && "id" in message ? message.id : null,
        error: { code: -32602, message: budgetError },
      },
      { status: 400 }
    );
  }

  const boundedRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    signal: request.signal,
    body,
  });
  // Authentication is attached to the Request and must survive the bounded copy.
  (boundedRequest as Request & { auth?: unknown }).auth = (request as Request & { auth?: unknown }).auth;
  return await mcpHandler(boundedRequest);
}

export async function POST(request: NextRequest): Promise<Response> {
  const bodySizeResponse = validateMcpBodySize(request);
  if (bodySizeResponse) {
    return bodySizeResponse;
  }

  return await handleAuthenticatedMcpRequest(request, handleBoundedMcpRequest);
}
