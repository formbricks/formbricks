import { describe, expect, test } from "vitest";
import {
  AUTHZED_MUTATIONS_FENCED_ERROR_CODE,
  AUTHZED_MUTATIONS_FENCED_RETRY_AFTER_SECONDS,
} from "@formbricks/types/errors";
import {
  createAuthzedMutationFenceLegacyResponse,
  createAuthzedMutationFenceProblemResponse,
  createAuthzedMutationFenceV2Response,
} from "./mutation-fence-response";

const expectSharedResponseContract = (response: Response, requestId?: string): void => {
  expect(response.status).toBe(503);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Retry-After")).toBe(String(AUTHZED_MUTATIONS_FENCED_RETRY_AFTER_SECONDS));
  expect(response.headers.get("X-Request-Id")).toBe(requestId ?? null);
};

describe("AuthZed mutation-fence responses", () => {
  test("creates a stable legacy response without internal details", async () => {
    const response = createAuthzedMutationFenceLegacyResponse("request-1");

    expectSharedResponseContract(response, "request-1");
    expect(await response.json()).toEqual({
      code: AUTHZED_MUTATIONS_FENCED_ERROR_CODE,
      message: "Authorization changes are temporarily paused. Please retry.",
      details: {},
    });
  });

  test("creates a stable V2 response", async () => {
    const response = createAuthzedMutationFenceV2Response();

    expectSharedResponseContract(response);
    expect(await response.json()).toEqual({
      error: {
        code: 503,
        message: "Service Unavailable",
        details: [{ field: "authorization", issue: AUTHZED_MUTATIONS_FENCED_ERROR_CODE }],
      },
    });
  });

  test("creates a stable RFC 9457 response", async () => {
    const response = createAuthzedMutationFenceProblemResponse("request-2", "/api/v3/surveys");

    expectSharedResponseContract(response, "request-2");
    expect(response.headers.get("Content-Type")).toBe("application/problem+json");
    expect(await response.json()).toEqual({
      title: "Service Unavailable",
      status: 503,
      detail: "Authorization changes are temporarily paused. Please retry.",
      requestId: "request-2",
      code: AUTHZED_MUTATIONS_FENCED_ERROR_CODE,
      instance: "/api/v3/surveys",
    });
  });
});
