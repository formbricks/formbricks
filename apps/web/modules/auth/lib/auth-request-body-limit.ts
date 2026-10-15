import "server-only";
import { NextRequest } from "next/server";
import { RequestBodyTooLargeError, readRequestBytesWithLimit } from "@/app/lib/api/request-body";

/**
 * Largest request body any `/api/auth/*` route will read (ENG-3846, ENG-3248).
 *
 * Every route under that prefix answers anonymous callers, and none of them buffers its body with a
 * bound of its own: Better Auth's handler, the dynamic-client-registration preprocessing and the SAML
 * bridge's `formData()` each read the whole thing. Next's `proxyClientMaxBodySize` (16 MB,
 * next.config.mjs) caps what the proxy clones, but it truncates rather than refuses, so it bounds the
 * damage without stopping the work.
 *
 * 256 KiB is far above anything these routes legitimately receive — credentials, an OAuth/OIDC
 * `form_post` carrying an id_token, a ~1 KB client registration — and the SAML `SAMLResponse` form post,
 * the largest honest payload, is tens of KB even with a group-heavy signed assertion. It is also 64 times
 * below the proxy ceiling, so a body that hits the ceiling is refused here as well.
 */
export const AUTH_REQUEST_BODY_LIMIT_BYTES = 256 * 1024;

const LIMITED = Symbol.for("formbricks.authRequestBodyLimited");

const bodyTooLargeResponse = (limitBytes: number): Response =>
  Response.json(
    {
      error: "payload_too_large",
      error_description: `Request body must not exceed ${limitBytes} bytes`,
    },
    { status: 413 }
  );

/**
 * The bytes were already read, so hand the handler a request that carries them. A `NextRequest` stays
 * one: a handler that reads `nextUrl` or cookies must not find a bare `Request` where it expected one.
 */
const withBody = <R extends Request>(request: R, body: Uint8Array): R => {
  const init = {
    method: request.method,
    headers: request.headers,
    body: body as BodyInit,
    signal: request.signal,
  };
  return (
    request instanceof NextRequest ? new NextRequest(request.url, init) : new Request(request.url, init)
  ) as R;
};

/**
 * Wraps a route handler so the request body is read once, bounded, before the handler sees it.
 *
 * The handler receives the same bytes as a fresh request, so the limit costs nothing that the handler's
 * own read did not already cost, and nothing downstream (the DCR preprocessing, Better Auth, `formData()`)
 * can buffer more than {@link AUTH_REQUEST_BODY_LIMIT_BYTES}. A request with no body — every GET — is
 * handed over untouched, identity included. Anything over the limit is answered `413` and the stream is
 * cancelled, whether it declared its size, understated it, or carried no `Content-Length` at all.
 */
export const withAuthRequestBodyLimit = <Args extends unknown[], R extends Request>(
  handler: (request: R, ...args: Args) => Response | Promise<Response>
) => {
  const limited = async (request: R, ...args: Args): Promise<Response> => {
    if (!request.body) return handler(request, ...args);

    let body: Uint8Array;
    try {
      body = await readRequestBytesWithLimit(request, AUTH_REQUEST_BODY_LIMIT_BYTES);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) return bodyTooLargeResponse(error.limitBytes);
      throw error;
    }

    return handler(withBody(request, body), ...args);
  };

  return Object.assign(limited, { [LIMITED]: true as const });
};

/** Whether a route export went through {@link withAuthRequestBodyLimit}; the route-surface test reads it. */
export const isAuthRequestBodyLimited = (handler: unknown): boolean =>
  typeof handler === "function" && (handler as { [LIMITED]?: boolean })[LIMITED] === true;
