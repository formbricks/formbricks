import "server-only";
import { NextRequest } from "next/server";
import { RequestBodyTooLargeError, readRequestBytesWithLimit } from "@/app/lib/api/request-body";

/**
 * Largest request body any `/api/auth/*` route will read (ENG-3846, ENG-3248).
 *
 * Every route under that prefix answers anonymous callers, and none of them buffers its body with a
 * bound of its own: Better Auth's handler, the dynamic-client-registration preprocessing and the SAML
 * bridge's `formData()` each read the whole thing. This guard is the first thing to read the body:
 * `patches/next@16.3.8.patch` stops Next cloning it for the proxy (ENG-3972), so an oversized or slow
 * upload is refused as soon as it passes the limit, not after the client's last byte.
 *
 * 256 KiB is far above anything these routes legitimately receive — credentials, an OAuth/OIDC
 * `form_post` carrying an id_token, a ~1 KB client registration. The largest honest payload is the SAML
 * callback's base64 `SAMLResponse`, and AWS, a service provider every major IdP federates into, refuses one
 * over 100,000 characters (STS `AssumeRoleWithSAML`), so this leaves more than twice that. It is also 64
 * times below Next's `proxyClientMaxBodySize` (16 MB), so without the patch a body Next cut off at that
 * size is still refused here.
 *
 * One limit for the whole surface on purpose: the SAML callback parses the XML before checking anything
 * (jackson's `parseIssuer`), so a larger limit there would buy memory amplification for an anonymous
 * caller, not headroom for a real IdP.
 */
export const AUTH_REQUEST_BODY_LIMIT_BYTES = 256 * 1024;

// A registered symbol rather than a module-level WeakSet: Next can bundle this module once per route, and
// a marker that only its own copy recognises would read as "not guarded" across that boundary.
const LIMITED = Symbol.for("formbricks.authRequestBodyLimited");

// `error` / `error_description` are what an OAuth client reads (RFC 6749 §5.2, RFC 7591 §3.2.2);
// `message` / `code` are what Better Auth's own client reads. `no-store` because a token-endpoint response
// must never be cached (RFC 6749 §5.1).
const bodyTooLargeResponse = (limitBytes: number): Response => {
  const description = `Request body must not exceed ${limitBytes} bytes`;
  return Response.json(
    {
      error: "payload_too_large",
      error_description: description,
      code: "PAYLOAD_TOO_LARGE",
      message: description,
    },
    { status: 413, headers: { "cache-control": "no-store" } }
  );
};

/**
 * The bytes were already read, so hand the handler a request that carries them. A `NextRequest` stays
 * one: a handler that reads `nextUrl` or cookies must not find a bare `Request` where it expected one.
 */
const withBody = <R extends Request>(request: R, body: Uint8Array): R => {
  // The framing headers described the stream that was just consumed; the new body carries its own.
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  const init = {
    method: request.method,
    headers,
    body: body as BodyInit,
    signal: request.signal,
  };
  return (
    request instanceof NextRequest ? new NextRequest(request.url, init) : new Request(request.url, init)
  ) as R;
};

/**
 * Whether a failed body read means the client went away mid-upload. Node fails the read with `ECONNRESET`
 * ("aborted"), and the request's signal fires, though not always before the read rejects, so either counts.
 */
const isClientAbort = (request: Request, error: unknown): boolean =>
  request.signal.aborted || (error as { code?: unknown } | null)?.code === "ECONNRESET";

/**
 * Wraps a route handler so the request body is read once, bounded, before the handler sees it.
 *
 * The handler receives the same bytes as a fresh request, so the limit costs nothing that the handler's
 * own read did not already cost, and nothing downstream (the DCR preprocessing, Better Auth, `formData()`)
 * can buffer more than {@link AUTH_REQUEST_BODY_LIMIT_BYTES}. A request with no body — every GET — is
 * handed over untouched, identity included. Anything over the limit is answered `413` and the stream is
 * cancelled, whether it declared its size, understated it, or carried no `Content-Length` at all. A client
 * that disconnects mid-upload gets a bare `400` nobody reads, rather than a route error for every abandoned
 * anonymous request.
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
      if (isClientAbort(request, error)) return new Response(null, { status: 400 });
      throw error;
    }

    return handler(withBody(request, body), ...args);
  };

  return Object.assign(limited, { [LIMITED]: true as const });
};

/** Whether a route export went through {@link withAuthRequestBodyLimit}; the route-surface test reads it. */
export const isAuthRequestBodyLimited = (handler: unknown): boolean =>
  typeof handler === "function" && (handler as { [LIMITED]?: boolean })[LIMITED] === true;
