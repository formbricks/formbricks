import { describe, expect, test } from "vitest";
import { AUTHZED_ERROR_CODES, AuthzedError } from "@/lib/authzed/errors";
import { normalizeAuthorizationOperationalError } from "./operational-error";

describe("authorization operational error normalization", () => {
  test("preserves stable AuthZed fields while replacing the operation", () => {
    const source = new AuthzedError({
      attempts: 3,
      code: AUTHZED_ERROR_CODES.UNAVAILABLE,
      grpcStatus: 14,
      operation: "lookup_resources",
      retryable: true,
    });

    expect(normalizeAuthorizationOperationalError(source, "authorization")).toMatchObject({
      attempts: 3,
      code: AUTHZED_ERROR_CODES.UNAVAILABLE,
      grpcStatus: 14,
      operation: "authorization",
      retryable: true,
    });
  });

  test("sanitizes unexpected failures as non-retryable internal errors", () => {
    const normalized = normalizeAuthorizationOperationalError(
      new Error("private raw message"),
      "authorization"
    );

    expect(normalized).toMatchObject({
      attempts: 1,
      code: AUTHZED_ERROR_CODES.INTERNAL,
      operation: "authorization",
      retryable: false,
    });
    expect(normalized.message).not.toContain("private raw message");
    expect(normalized.stack ?? "").not.toContain("private raw message");
  });
});
