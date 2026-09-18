import { describe, expect, test, vi } from "vitest";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { handleUnexpectedError, hubErrorToProblemResponse, relayableHubDetail } from "./errors";

vi.mock("server-only", () => ({}));

const requestId = "req_1";
const instance = "/api/mcp";
const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn() } as any;

/**
 * The unexpected-throw mapping, which no operation test reaches. The Hub → problem bounds moved with the
 * mapper to `../../lib/hub-errors.test.ts`.
 */
describe("handleUnexpectedError", () => {
  test("maps a missing resource to 403, not 404 (no existence oracle)", async () => {
    const response = handleUnexpectedError(
      new ResourceNotFoundError("Workspace", "ws_1"),
      log,
      requestId,
      instance,
      "feedbackRecords.get"
    );

    expect(response.status).toBe(403);
    // The resource type and id must not travel back to the caller.
    expect(JSON.stringify(await response.json())).not.toContain("ws_1");
  });

  test("maps a database failure to a generic 500", async () => {
    const response = handleUnexpectedError(
      new DatabaseError("connection lost"),
      log,
      requestId,
      instance,
      "feedbackRecords.get"
    );

    expect(response.status).toBe(500);
    expect((await response.json()).detail).toBe("An unexpected error occurred.");
  });

  test("maps an unknown throw to a generic 500 without leaking the message", async () => {
    const response = handleUnexpectedError(
      new Error("secret internal detail"),
      log,
      requestId,
      instance,
      "feedbackRecords.get"
    );

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret internal detail");
  });
});

/**
 * The vocabulary binding, which nothing else covers.
 *
 * The shared Hub mapper leaves the Hub's `tenant_id` alone by default, because taxonomy shares it and
 * exposes `directoryId`. This surface genuinely renames the tenant to `dataset_id` on the way out
 * (`serializeV3FeedbackRecord`), so it re-exports the mapper pre-bound to that vocabulary. Without a
 * test here, deleting the binding would relay `tenant_id` to callers of an API that has no such field,
 * and every existing test would still pass — the shared module's own tests opt in explicitly.
 */
describe("the surface's bound Hub mapper", () => {
  const hubError = (extra: Record<string, unknown>) =>
    ({ status: 409, message: "", problemDetail: null, invalidParams: null, ...extra }) as never;

  // The real Hub 409 from a duplicate create.
  const duplicate = () =>
    hubError({
      problemDetail: "a feedback record with this tenant_id, submission_id, and field_id already exists",
      invalidParams: [{ name: "tenant_id", reason: "tenant_id is required" }],
    });

  test("renames the tenant in a relayed detail", async () => {
    const body = await hubErrorToProblemResponse(duplicate(), requestId, instance).json();

    expect(body.detail).toContain("dataset_id");
    expect(body.detail).not.toContain("tenant_id");
  });

  test("renames it in relayed invalid_params too", async () => {
    const withParams = hubError({
      status: 400,
      problemDetail: "invalid",
      invalidParams: [{ name: "tenant_id", reason: "tenant_id is required" }],
    });
    const body = await hubErrorToProblemResponse(withParams, requestId, instance).json();

    expect(JSON.stringify(body.invalid_params)).not.toContain("tenant_id");
    expect(body.invalid_params[0].name).toBe("dataset_id");
  });

  test("relayableHubDetail is bound the same way", () => {
    expect(relayableHubDetail(duplicate(), "fallback")).toContain("dataset_id");
  });

  test("still forwards options through to the shared mapper", async () => {
    const body = await hubErrorToProblemResponse(hubError({ status: 503 }), requestId, instance, {
      serviceUnavailableDetail: "Semantic search is unavailable.",
    }).json();

    expect(body.detail).toBe("Semantic search is unavailable.");
  });
});
