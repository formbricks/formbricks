import { type NextRequest } from "next/server";
import { arrayBudgetInvalidParam, findArrayBudgetViolation } from "@/app/api/v3/lib/array-budget";
import { problemPayloadTooLarge } from "@/app/api/v3/lib/response";
import {
  DEFAULT_REQUEST_BODY_LIMIT_BYTES,
  RequestBodyTooLargeError,
  readRequestBodyWithLimit,
} from "@/app/lib/api/request-body";
import { handleAuthenticatedMcpRequest } from "@/modules/mcp/auth";
import { mcpHandler } from "@/modules/mcp/server";

export const runtime = "nodejs";
export const fetchCache = "force-no-store";

/** JSON-RPC 2.0 "Invalid params". */
const JSON_RPC_INVALID_PARAMS = -32602;

function getRequestId(request: Request): string {
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

function bodyTooLargeResponse(request: Request): Response {
  return problemPayloadTooLarge(
    getRequestId(request),
    `Request body must not exceed ${DEFAULT_REQUEST_BODY_LIMIT_BYTES} bytes`,
    new URL(request.url).pathname
  );
}

/** Refuses a declared oversize before authentication runs; the cheap path when the client is honest. */
function validateMcpBodySize(request: NextRequest): Response | null {
  const contentLength = getContentLength(request.headers);
  if (contentLength === null || contentLength <= DEFAULT_REQUEST_BODY_LIMIT_BYTES) {
    return null;
  }

  return bodyTooLargeResponse(request);
}

function jsonRpcIdOf(message: unknown): unknown {
  if (typeof message === "object" && message !== null && !Array.isArray(message) && "id" in message) {
    return (message as { id: unknown }).id;
  }
  return null;
}

/**
 * Reads the body itself, bounded, and refuses oversized arrays before the SDK parses anything.
 *
 * Two gaps this closes (ENG-3384). The SDK transport calls `req.json()` with no size check of its own,
 * so a client that omits `Content-Length` — a chunked upload — sailed past `validateMcpBodySize` and
 * was read in full. And the SDK validates tool arguments through Zod's `~standard.validate`, which
 * parses every array element before an array-level `.max()` runs and collects one issue per element,
 * ahead of the scope gate: a 2 MB body of junk entries came back as ~1M issues. Both are caught here,
 * after authentication (so an anonymous caller still costs nothing beyond the header check) and
 * before the handler, by buffering the body once and handing the SDK a request that carries the same
 * bytes. Malformed JSON is passed through untouched so the SDK answers with its own parse error.
 */
async function handleBoundedMcpRequest(request: Request): Promise<Response> {
  let bodyText: string;
  try {
    bodyText = await readRequestBodyWithLimit(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return bodyTooLargeResponse(request);
    }
    throw error;
  }

  let message: unknown;
  try {
    message = JSON.parse(bodyText);
  } catch {
    message = undefined;
  }

  const violation = message === undefined ? null : findArrayBudgetViolation(message);
  if (violation) {
    const param = arrayBudgetInvalidParam(violation, "body");
    return Response.json(
      {
        jsonrpc: "2.0",
        id: jsonRpcIdOf(message),
        error: {
          code: JSON_RPC_INVALID_PARAMS,
          message: `Invalid params: ${param.reason} at ${param.name}`,
          data: { invalid_params: [param] },
        },
      },
      { status: 400 }
    );
  }

  const boundedRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: bodyText,
  });
  // The SDK reads the authenticated principal off the request object itself.
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
