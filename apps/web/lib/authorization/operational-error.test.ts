import { describe, expect, test } from "vitest";
import { AUTHZED_ERROR_CODES, AuthzedError } from "@/lib/authzed/errors";
import { AuthorizationFailureCause, normalizeAuthorizationOperationalError } from "./operational-error";

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

  // ENG-7041: Sentry and the API error reporter follow `cause`, so it carries what tells a SpiceDB
  // transport fault from a bug of ours (the original name, gRPC status and frames) and nothing else.
  const everythingReported = (error: Error): string =>
    JSON.stringify({ message: error.message, stack: error.stack, fields: { ...error } });

  test("reports the gRPC failure under an AuthZed error by name, status and frames only", () => {
    const grpcError = Object.assign(new Error("13 INTERNAL: Received RST_STREAM with code 2"), {
      code: 13,
      details: "Received RST_STREAM with code 2",
      metadata: { "x-request-id": "private-trailer" },
    });
    const source = new AuthzedError({
      attempts: 1,
      cause: grpcError,
      code: AUTHZED_ERROR_CODES.INTERNAL,
      grpcStatus: 13,
      operation: "check_permission",
      retryable: false,
    });

    const { cause } = normalizeAuthorizationOperationalError(source, "authorization");

    expect(cause).toBeInstanceOf(AuthorizationFailureCause);
    expect(cause).toMatchObject({ originalName: "Error", grpcStatus: 13 });
    expect((cause as Error).stack).toMatch(/\n\s+at /);
    expect(everythingReported(cause as Error)).not.toMatch(/RST_STREAM|private-trailer|metadata/);
  });

  test("reports the AuthZed error itself as the cause when it wraps nothing", () => {
    const source = new AuthzedError({
      attempts: 1,
      code: AUTHZED_ERROR_CODES.DISABLED,
      operation: "check_permission",
      retryable: false,
    });

    const { cause } = normalizeAuthorizationOperationalError(source, "authorization");

    expect(cause).toBeInstanceOf(AuthorizationFailureCause);
    expect(cause).not.toBe(source);
    expect(cause).toMatchObject({ originalName: "AuthzedError" });
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

  test("reports an unexpected failure by name and frames, so our own bug is not read as a SpiceDB fault", () => {
    const bug = new TypeError("Cannot read properties of undefined (reading 'private raw message')");

    const normalized = normalizeAuthorizationOperationalError(bug, "authorization");

    expect(normalized.code).toBe(AUTHZED_ERROR_CODES.INTERNAL);
    expect(normalized.cause).toBeInstanceOf(AuthorizationFailureCause);
    expect(normalized.cause).toMatchObject({ originalName: "TypeError" });
    expect((normalized.cause as Error).stack).toMatch(/\n\s+at /);
    expect(everythingReported(normalized.cause as Error)).not.toContain("private raw message");
  });

  test("reports a thrown non-Error by its type", () => {
    const normalized = normalizeAuthorizationOperationalError("private raw message", "authorization");

    expect(normalized.cause).toMatchObject({ originalName: "string" });
    expect(everythingReported(normalized.cause as Error)).not.toContain("private raw message");
  });
});
