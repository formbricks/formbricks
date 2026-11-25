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

  // ENG-7041: Sentry follows `cause`, and it is the only place the gRPC status, the transport details
  // or our own TypeError survive. Dropping it made every failure read as a bare `authzed_internal`.
  test("keeps the original failure as the cause of a normalized AuthZed error", () => {
    const grpcError = Object.assign(new Error("13 INTERNAL: Received RST_STREAM with code 2"), { code: 13 });
    const source = new AuthzedError({
      attempts: 1,
      cause: grpcError,
      code: AUTHZED_ERROR_CODES.INTERNAL,
      grpcStatus: 13,
      operation: "check_permission",
      retryable: false,
    });

    expect(normalizeAuthorizationOperationalError(source, "authorization").cause).toBe(grpcError);
  });

  test("keeps the AuthZed error itself as the cause when it carries none", () => {
    const source = new AuthzedError({
      attempts: 1,
      code: AUTHZED_ERROR_CODES.DISABLED,
      operation: "check_permission",
      retryable: false,
    });

    expect(normalizeAuthorizationOperationalError(source, "authorization").cause).toBe(source);
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

  test("keeps an unexpected failure as the cause, so our own bug is not read as a SpiceDB fault", () => {
    const bug = new TypeError("Cannot read properties of undefined (reading 'id')");

    const normalized = normalizeAuthorizationOperationalError(bug, "authorization");

    expect(normalized.code).toBe(AUTHZED_ERROR_CODES.INTERNAL);
    expect(normalized.cause).toBe(bug);
  });
});
