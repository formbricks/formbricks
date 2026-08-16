import { describe, expect, test } from "vitest";
import { AUTHZED_ERROR_CODES, AuthzedError } from "@/lib/authzed/errors";
import { normalizeAuthorizationOperationalError, toAuthorizationDecisionLabel } from "./comparison-helpers";

describe("authorization comparison helpers", () => {
  test.each([
    [true, "allow"],
    [false, "deny"],
    [undefined, "unknown"],
  ] as const)("maps decision %s to %s", (decision, expected) => {
    expect(toAuthorizationDecisionLabel(decision)).toBe(expected);
  });

  test("preserves stable AuthZed fields while replacing the operation", () => {
    const source = new AuthzedError({
      attempts: 3,
      code: AUTHZED_ERROR_CODES.UNAVAILABLE,
      grpcStatus: 14,
      operation: "lookup_resources",
      retryable: true,
    });

    expect(normalizeAuthorizationOperationalError(source, "authorization_shadow")).toMatchObject({
      attempts: 3,
      code: AUTHZED_ERROR_CODES.UNAVAILABLE,
      grpcStatus: 14,
      operation: "authorization_shadow",
      retryable: true,
    });
  });

  test("sanitizes unexpected failures as non-retryable internal errors", () => {
    const normalized = normalizeAuthorizationOperationalError(
      new Error("private raw message"),
      "authorization_shadow"
    );

    expect(normalized).toMatchObject({
      attempts: 1,
      code: AUTHZED_ERROR_CODES.INTERNAL,
      operation: "authorization_shadow",
      retryable: false,
    });
    expect(JSON.stringify(normalized)).not.toContain("private raw message");
  });
});
