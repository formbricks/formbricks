import { describe, expect, test, vi } from "vitest";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { handleUnexpectedError } from "./errors";

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
