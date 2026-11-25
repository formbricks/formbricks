import { status } from "@grpc/grpc-js";
import { describe, expect, test } from "vitest";
import { AUTHZED_ERROR_CODES, AuthzedError, mapAuthzedError } from "./errors";

describe("mapAuthzedError", () => {
  test.each([
    [status.DEADLINE_EXCEEDED, AUTHZED_ERROR_CODES.TIMEOUT, true],
    [status.UNAVAILABLE, AUTHZED_ERROR_CODES.UNAVAILABLE, true],
    [status.RESOURCE_EXHAUSTED, AUTHZED_ERROR_CODES.OVERLOADED, true],
    [status.ABORTED, AUTHZED_ERROR_CODES.ABORTED, true],
    [status.UNAUTHENTICATED, AUTHZED_ERROR_CODES.UNAUTHENTICATED, false],
    [status.PERMISSION_DENIED, AUTHZED_ERROR_CODES.PERMISSION_DENIED, false],
    [status.INVALID_ARGUMENT, AUTHZED_ERROR_CODES.INVALID_REQUEST, false],
    [status.OUT_OF_RANGE, AUTHZED_ERROR_CODES.INVALID_REQUEST, false],
    [status.FAILED_PRECONDITION, AUTHZED_ERROR_CODES.FAILED_PRECONDITION, false],
    [status.NOT_FOUND, AUTHZED_ERROR_CODES.NOT_FOUND, false],
    [status.ALREADY_EXISTS, AUTHZED_ERROR_CODES.CONFLICT, false],
    [status.CANCELLED, AUTHZED_ERROR_CODES.CANCELLED, false],
    [status.UNIMPLEMENTED, AUTHZED_ERROR_CODES.UNSUPPORTED, false],
    [status.UNKNOWN, AUTHZED_ERROR_CODES.INTERNAL, false],
    [status.INTERNAL, AUTHZED_ERROR_CODES.INTERNAL, false],
    [status.DATA_LOSS, AUTHZED_ERROR_CODES.INTERNAL, false],
  ])("maps gRPC status %i to %s", (grpcStatus, code, retryable) => {
    const sourceError = { code: grpcStatus, details: "raw-sdk-details" };

    const result = mapAuthzedError(sourceError, "read_schema", 2);

    expect(result).toBeInstanceOf(AuthzedError);
    expect(result).toMatchObject({
      attempts: 2,
      code,
      grpcStatus,
      message: code,
      name: "AuthzedError",
      operation: "read_schema",
      retryable,
    });
    expect(result.cause).toBe(sourceError);
  });

  // grpc-js reports a peer resetting an in-flight stream (an LB reaping the connection, a SpiceDB pod
  // rotating mid-call) as INTERNAL, while a connection found dead before the call is UNAVAILABLE.
  // Both are the same dropped transport, so both are retried (ENG-7041).
  test.each([
    "Received RST_STREAM with code 2 (Internal server error)",
    "Received RST_STREAM with code 0 (Call ended without gRPC status)",
    "Received RST_STREAM with code 1",
  ])("classifies an INTERNAL stream reset (%s) as a retryable unavailable error", (details) => {
    const sourceError = Object.assign(new Error(`13 INTERNAL: ${details}`), {
      code: status.INTERNAL,
      details,
    });

    const result = mapAuthzedError(sourceError, "check_permission", 1);

    expect(result).toMatchObject({
      attempts: 1,
      code: AUTHZED_ERROR_CODES.UNAVAILABLE,
      grpcStatus: status.INTERNAL,
      operation: "check_permission",
      retryable: true,
    });
    expect(result.cause).toBe(sourceError);
  });

  test.each([
    [status.UNKNOWN, "Received RST_STREAM with code 2 (Internal server error)"],
    [status.INTERNAL, "Received RST_STREAM with code 2 triggered by internal client error: write EPIPE"],
  ])("keeps gRPC status %i with details %j non-retryable", (grpcStatus, details) => {
    const result = mapAuthzedError({ code: grpcStatus, details }, "check_permission", 1);

    expect(result).toMatchObject({ code: AUTHZED_ERROR_CODES.INTERNAL, retryable: false });
  });

  test.each([new Error("socket failure"), "string failure", null, { code: "14" }])(
    "maps a non-gRPC error to an internal error",
    (sourceError) => {
      const result = mapAuthzedError(sourceError, "read_schema", 1);

      expect(result).toMatchObject({
        attempts: 1,
        code: AUTHZED_ERROR_CODES.INTERNAL,
        grpcStatus: undefined,
        operation: "read_schema",
        retryable: false,
      });
    }
  );

  test("preserves an existing AuthzedError classification while updating operation metadata", () => {
    const sourceError = new AuthzedError({
      attempts: 1,
      code: AUTHZED_ERROR_CODES.UNAVAILABLE,
      grpcStatus: status.UNAVAILABLE,
      operation: "previous_operation",
      retryable: true,
    });

    const result = mapAuthzedError(sourceError, "read_schema", 3);

    expect(result).not.toBe(sourceError);
    expect(result).toMatchObject({
      attempts: 3,
      code: AUTHZED_ERROR_CODES.UNAVAILABLE,
      grpcStatus: status.UNAVAILABLE,
      operation: "read_schema",
      retryable: true,
    });
  });
});
