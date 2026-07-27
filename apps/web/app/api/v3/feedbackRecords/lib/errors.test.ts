import { describe, expect, test, vi } from "vitest";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { handleUnexpectedError, hubErrorToProblemResponse } from "./errors";

vi.mock("server-only", () => ({}));

const requestId = "req_1";
const instance = "/api/mcp";
const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn() } as any;

/**
 * The status matrix is exercised end-to-end in `operations.test.ts`; what is pinned here is the part that
 * only this module owns — the *bounds* on what a remote service may contribute to our response body, and
 * the unexpected-throw mapping, which no operation test reaches.
 */
describe("hubErrorToProblemResponse", () => {
  const hubError = (status: number, extra: Record<string, unknown> = {}) => ({
    status,
    message: `${status}`,
    detail: `${status}`,
    ...extra,
  });

  test("truncates a relayed 4xx detail so the Hub cannot size our response body", async () => {
    const response = hubErrorToProblemResponse(
      hubError(422, { problemDetail: "x".repeat(5_000) }),
      requestId,
      instance
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.detail.length).toBe(512);
  });

  test("caps the number of relayed invalid_params", async () => {
    const invalidParams = Array.from({ length: 50 }, (_, i) => ({
      name: `field_${i}`,
      reason: "y".repeat(1_000),
    }));

    const body = await hubErrorToProblemResponse(
      hubError(400, { invalidParams }),
      requestId,
      instance
    ).json();

    expect(body.invalid_params).toHaveLength(20);
    expect(body.invalid_params[0].reason.length).toBe(512);
    expect(body.invalid_params[0].name).toBe("field_0");
  });

  // 5xx bodies can carry upstream internals, so nothing from them is ever echoed — only the status is.
  test("never relays a 5xx problem detail", async () => {
    const body = await hubErrorToProblemResponse(
      hubError(500, { problemDetail: "panic: nil deref at 10.0.0.1" }),
      requestId,
      instance
    ).json();

    expect(body.status).toBe(502);
    expect(JSON.stringify(body)).not.toContain("10.0.0.1");
  });

  test("maps a null error (Hub unconfigured) to a generic 502", async () => {
    const response = hubErrorToProblemResponse(null, requestId, instance);

    expect(response.status).toBe(502);
    expect((await response.json()).detail).toBe("The feedback service is unavailable.");
  });

  // A 503 means embeddings aren't configured — a deployment-level fact no retry fixes, so it must not be
  // folded into the generic "unavailable" 502 that reads as "try again".
  test("maps a 503 to an actionable configuration message rather than a 502", async () => {
    const response = hubErrorToProblemResponse(hubError(503), requestId, instance);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).toBe("service_unavailable");
    expect(body.detail).toContain("EMBEDDING_PROVIDER");
  });
});

describe("handleUnexpectedError", () => {
  test("maps a missing resource to 403, not 404 (no existence oracle)", async () => {
    const response = handleUnexpectedError(
      new ResourceNotFoundError("Workspace", "ws_1"),
      log,
      requestId,
      instance
    );

    expect(response.status).toBe(403);
    // The resource type and id must not travel back to the caller.
    expect(JSON.stringify(await response.json())).not.toContain("ws_1");
  });

  test("maps a database failure to a generic 500", async () => {
    const response = handleUnexpectedError(new DatabaseError("connection lost"), log, requestId, instance);

    expect(response.status).toBe(500);
    expect((await response.json()).detail).toBe("An unexpected error occurred.");
  });

  test("maps an unknown throw to a generic 500 without leaking the message", async () => {
    const response = handleUnexpectedError(new Error("secret internal detail"), log, requestId, instance);

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret internal detail");
  });
});
