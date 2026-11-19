import { describe, expect, test } from "vitest";
import { getAuthzedClient } from "./client";
import { AUTHZED_ERROR_CODES } from "./errors";

/**
 * Against a real SpiceDB: a bulk check of a permission the schema lacks fails the item, not the call, with
 * FAILED_PRECONDITION. `can()` relies on reading that as a missing schema element, never as a retried
 * malformed response, to deny a grant's `mcp_reach` on the previous release's schema (ADR-0042).
 */
describe("AuthZed bulk permission checks (real SpiceDB)", () => {
  test("raise a permission the schema lacks as a permanent failed precondition naming it", async () => {
    const error = await getAuthzedClient()
      .checkPermissionBatch([
        {
          permission: "not_in_the_schema",
          resource: { objectId: "workspace-1", objectType: "workspace" },
          subject: { objectId: "user-1", objectType: "user" },
        },
      ])
      .catch((thrown: unknown) => thrown);

    expect(error).toMatchObject({
      code: AUTHZED_ERROR_CODES.FAILED_PRECONDITION,
      retryable: false,
      attempts: 1,
    });
    expect((error as { cause?: { message?: string } }).cause?.message).toMatch(
      /`not_in_the_schema` not found/
    );
  });
});
