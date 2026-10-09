import { describe, expect, test } from "vitest";
import { UNKNOWN_SERVICE_ERROR, toLoggableErrorCode, toLoggableStorageError } from "./loggable-error";

describe("toLoggableStorageError", () => {
  test("keeps a provider error's code, status and request id, and nothing the provider sent", () => {
    // The shape the SDK builds from a MinIO-style 403 body.
    const error = Object.assign(new Error("Access Denied for ws1/private/scan.pdf"), {
      name: "AccessDenied",
      $metadata: { httpStatusCode: 403, requestId: "req-1", extendedRequestId: "ext", attempts: 1 },
      $fault: "client",
      Code: "AccessDenied",
      Key: "ws1/private/scan.pdf",
      Resource: "/bucket/ws1/private/scan.pdf",
    });

    expect(toLoggableStorageError(error)).toStrictEqual({
      name: "AccessDenied",
      httpStatusCode: 403,
      requestId: "req-1",
      attempts: 1,
    });
  });

  test("drops the message of a response the SDK couldn't parse, which echoes the body", () => {
    const error = Object.assign(new Error("Unexpected token in ws1/private/scan.pdf"), {
      $metadata: { httpStatusCode: 500 },
    });

    expect(toLoggableStorageError(error)).toStrictEqual({
      name: "Error",
      httpStatusCode: 500,
      requestId: undefined,
      attempts: undefined,
    });
  });

  test("keeps the cause of a failure that got no response, though the SDK adds $metadata to it", () => {
    // What a real S3Client throws when the store is down.
    const error = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:9000"), {
      code: "ECONNREFUSED",
      $metadata: { attempts: 3, totalRetryDelay: 120 },
    });

    expect(toLoggableStorageError(error)).toStrictEqual({
      name: "Error",
      code: "ECONNREFUSED",
      attempts: 3,
      message: "connect ECONNREFUSED 127.0.0.1:9000",
    });
  });

  test("replaces a provider error name that isn't an identifier", () => {
    const error = Object.assign(new Error("x"), {
      name: "Denied: ws1/private/scan.pdf",
      $metadata: { httpStatusCode: 403 },
    });

    expect(toLoggableStorageError(error).name).toBe(UNKNOWN_SERVICE_ERROR);
  });

  test("ignores fields of the wrong type", () => {
    expect(
      toLoggableStorageError({ name: 1, code: 2, $metadata: { httpStatusCode: "403", attempts: "1" } })
    ).toStrictEqual({ name: undefined, code: undefined, attempts: undefined, message: undefined });
  });

  test("describes a thrown non-object by its type", () => {
    expect(toLoggableStorageError("ws1/private/scan.pdf")).toStrictEqual({ name: "string" });
    expect(toLoggableStorageError(null)).toStrictEqual({ name: "object" });
  });
});

describe("toLoggableErrorCode", () => {
  test.each(["AccessDenied", "SlowDown", "XMinioServerNotInitialized", "Some.Code1"])("keeps %s", (code) => {
    expect(toLoggableErrorCode(code)).toBe(code);
  });

  test.each([undefined, "", "__proto__", "Access denied: ws1/private/scan.pdf", "a".repeat(65), 403])(
    "replaces %s",
    (code) => {
      expect(toLoggableErrorCode(code)).toBe(UNKNOWN_SERVICE_ERROR);
    }
  );
});
