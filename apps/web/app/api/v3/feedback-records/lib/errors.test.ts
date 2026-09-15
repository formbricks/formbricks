import { describe, expect, test, vi } from "vitest";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { EMBEDDINGS_UNAVAILABLE_DETAIL, handleUnexpectedError, hubErrorToProblemResponse } from "./errors";

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
    expect(body.detail).toHaveLength(512);
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
    expect(body.invalid_params[0].reason).toHaveLength(512);
    expect(body.invalid_params[0].name).toBe("field_0");
  });

  /**
   * The Hub's tenant is our dataset, and the record serializer already renames the field outward — so a
   * relayed message must not send a caller looking for a `tenant_id` parameter this API does not have. The
   * fixture is the Hub's verbatim duplicate-create 409, captured from a live instance.
   */
  test("renames the Hub's tenant_id to dataset_id in a relayed detail", async () => {
    const body = await hubErrorToProblemResponse(
      hubError(409, {
        problemDetail: "a feedback record with this tenant_id, submission_id, and field_id already exists",
      }),
      requestId,
      instance
    ).json();

    expect(body.detail).toBe(
      "a feedback record with this dataset_id, submission_id, and field_id already exists"
    );
    expect(body.detail).not.toContain("tenant_id");
  });

  /**
   * The rewrite lengthens the string (`dataset_id` is a character longer), so it has to happen before the
   * slice — otherwise the cap this module exists to enforce is quietly exceeded by however many times the
   * Hub said `tenant_id`.
   */
  test("stays within the relay cap even when the rewrite lengthens the text", async () => {
    const body = await hubErrorToProblemResponse(
      hubError(409, { problemDetail: "tenant_id ".repeat(200) }),
      requestId,
      instance
    ).json();

    expect(body.detail.length).toBeLessThanOrEqual(512);
    expect(body.detail).not.toContain("tenant_id");
  });

  test("renames tenant_id in relayed invalid_params too, where the Hub also names fields", async () => {
    const body = await hubErrorToProblemResponse(
      hubError(400, { invalidParams: [{ name: "tenant_id", reason: "tenant_id is required" }] }),
      requestId,
      instance
    ).json();

    expect(body.invalid_params).toEqual([{ name: "dataset_id", reason: "dataset_id is required" }]);
  });

  // Word-bounded, so it renames the term without corrupting text that merely contains it.
  test("leaves lookalike substrings alone", async () => {
    const body = await hubErrorToProblemResponse(
      hubError(422, { problemDetail: "my_tenant_identifier and tenant_ids are unaffected" }),
      requestId,
      instance
    ).json();

    expect(body.detail).toBe("my_tenant_identifier and tenant_ids are unaffected");
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

  // Not "any 4xx": a Hub 401/403 means our own Hub credentials were refused, and a 404 can reveal upstream
  // addressing. Echoing either would describe our infrastructure rather than the caller's request.
  test.each([401, 403, 404])("never relays the detail of a Hub %i", async (status) => {
    const body = await hubErrorToProblemResponse(
      hubError(status, { problemDetail: "invalid api key for tenant-service" }),
      requestId,
      instance
    ).json();

    expect(JSON.stringify(body)).not.toContain("invalid api key");
  });

  test("maps a null error (Hub unconfigured) to a generic 502", async () => {
    const response = hubErrorToProblemResponse(null, requestId, instance);

    expect(response.status).toBe(502);
    expect((await response.json()).detail).toBe("The feedback service is unavailable.");
  });

  // A 503 means embeddings aren't configured — a deployment-level fact no retry fixes, so it must not be
  // folded into the generic "unavailable" 502 that reads as "try again".
  test("maps a 503 to 503 rather than folding it into the generic 502", async () => {
    const response = hubErrorToProblemResponse(hubError(503), requestId, instance);

    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("service_unavailable");
  });

  test("uses the caller's wording for a 503 when it knows what is unconfigured", async () => {
    const body = await hubErrorToProblemResponse(hubError(503), requestId, instance, {
      serviceUnavailableDetail: EMBEDDINGS_UNAVAILABLE_DETAIL,
    }).json();

    expect(body.detail).toContain("EMBEDDING_PROVIDER");
  });

  /**
   * The Hub answers 503 for several unrelated unconfigured subsystems, so the default must name none of them:
   * a plain outage on a list or a create would otherwise tell an operator to go configure embeddings.
   */
  test("names no subsystem in a 503 the caller did not explain", async () => {
    const body = await hubErrorToProblemResponse(hubError(503), requestId, instance).json();

    expect(body.detail).not.toContain("EMBEDDING");
    expect(body.detail).not.toMatch(/embedding/i);
    expect(body.detail).toContain("not configured");
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
