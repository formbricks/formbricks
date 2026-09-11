import "server-only";
import {
  AUTHZED_MUTATIONS_FENCED_ERROR_CODE,
  AUTHZED_MUTATIONS_FENCED_RETRY_AFTER_SECONDS,
} from "@formbricks/types/errors";

const MUTATION_FENCE_MESSAGE = "Authorization changes are temporarily paused. Please retry.";

const getHeaders = (requestId?: string): Record<string, string> => ({
  "Cache-Control": "private, no-store",
  "Retry-After": String(AUTHZED_MUTATIONS_FENCED_RETRY_AFTER_SECONDS),
  ...(requestId ? { "X-Request-Id": requestId } : {}),
});

/** Response shape used by legacy V1 routes and Better Auth. */
export const createAuthzedMutationFenceLegacyResponse = (requestId?: string): Response =>
  Response.json(
    {
      code: AUTHZED_MUTATIONS_FENCED_ERROR_CODE,
      message: MUTATION_FENCE_MESSAGE,
      details: {},
    },
    { status: 503, headers: getHeaders(requestId) }
  );

/** Response shape used by V2 APIs. */
export const createAuthzedMutationFenceV2Response = (requestId?: string): Response =>
  Response.json(
    {
      error: {
        code: 503,
        message: "Service Unavailable",
        details: [{ field: "authorization", issue: AUTHZED_MUTATIONS_FENCED_ERROR_CODE }],
      },
    },
    { status: 503, headers: getHeaders(requestId) }
  );

/** RFC 9457 response shape used by V3 and MCP. */
export const createAuthzedMutationFenceProblemResponse = (requestId: string, instance?: string): Response =>
  Response.json(
    {
      title: "Service Unavailable",
      status: 503,
      detail: MUTATION_FENCE_MESSAGE,
      requestId,
      code: AUTHZED_MUTATIONS_FENCED_ERROR_CODE,
      ...(instance ? { instance } : {}),
    },
    {
      status: 503,
      headers: {
        ...getHeaders(requestId),
        "Content-Type": "application/problem+json",
      },
    }
  );
