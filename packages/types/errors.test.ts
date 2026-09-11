import { describe, expect, test } from "vitest";
import {
  AUTHZED_MUTATIONS_FENCED_ERROR_CODE,
  AUTHZED_MUTATIONS_FENCED_RETRY_AFTER_SECONDS,
  AuthzedMutationsFencedError,
  isAuthzedMutationsFencedError,
  normalizeAuthzedMutationsFencedError,
} from "./errors";

const prismaFenceError = (overrides?: Readonly<{ originalCode?: string; originalMessage?: string }>) => ({
  code: "P2010",
  message: "Raw query failed without a safe public message",
  meta: {
    driverAdapterError: {
      name: "DriverAdapterError",
      cause: {
        kind: "postgres",
        originalCode: overrides?.originalCode ?? "P0001",
        originalMessage: overrides?.originalMessage ?? AUTHZED_MUTATIONS_FENCED_ERROR_CODE,
      },
    },
  },
});

describe("AuthzedMutationsFencedError", () => {
  test("exposes a stable retryable 503 contract without a raw cause", () => {
    const error = new AuthzedMutationsFencedError();

    expect(error).toMatchObject({
      code: AUTHZED_MUTATIONS_FENCED_ERROR_CODE,
      message: AUTHZED_MUTATIONS_FENCED_ERROR_CODE,
      name: "AuthzedMutationsFencedError",
      retryable: true,
      retryAfter: AUTHZED_MUTATIONS_FENCED_RETRY_AFTER_SECONDS,
      statusCode: 503,
    });
    expect(Object.prototype.hasOwnProperty.call(error, "cause")).toBe(false);
  });
});

describe("isAuthzedMutationsFencedError", () => {
  test.each([
    new AuthzedMutationsFencedError(),
    AUTHZED_MUTATIONS_FENCED_ERROR_CODE,
    new Error(AUTHZED_MUTATIONS_FENCED_ERROR_CODE),
    { code: AUTHZED_MUTATIONS_FENCED_ERROR_CODE },
    { message: AUTHZED_MUTATIONS_FENCED_ERROR_CODE },
    { code: "P0001", message: AUTHZED_MUTATIONS_FENCED_ERROR_CODE },
    prismaFenceError(),
    { cause: { error: prismaFenceError() } },
  ])("recognizes a supported fence error shape", (error) => {
    expect(isAuthzedMutationsFencedError(error)).toBe(true);
  });

  test.each([
    null,
    undefined,
    "authzed_mutations_fenced_suffix",
    new Error("prefix authzed_mutations_fenced"),
    { code: "P0002", message: AUTHZED_MUTATIONS_FENCED_ERROR_CODE },
    { code: "P0001", message: "a different user-raised database error" },
    prismaFenceError({ originalCode: "23505" }),
    prismaFenceError({ originalMessage: "another P0001 exception" }),
    { code: "P2010", meta: { driverAdapterError: { cause: { originalCode: "P0001" } } } },
  ])("rejects an unsupported or inexact error shape", (error) => {
    expect(isAuthzedMutationsFencedError(error)).toBe(false);
  });

  test("handles cyclic structures without recursing indefinitely", () => {
    const cyclic: { cause?: unknown } = {};
    cyclic.cause = cyclic;

    expect(isAuthzedMutationsFencedError(cyclic)).toBe(false);
  });

  test("does not invoke getters while traversing an error", () => {
    const error = {};
    Object.defineProperty(error, "cause", {
      get() {
        throw new Error("getter must not run");
      },
    });

    expect(isAuthzedMutationsFencedError(error)).toBe(false);
  });

  test("bounds traversal depth", () => {
    const shallow = { cause: { cause: { code: AUTHZED_MUTATIONS_FENCED_ERROR_CODE } } };
    let deep: unknown = { code: AUTHZED_MUTATIONS_FENCED_ERROR_CODE };
    for (let index = 0; index < 10; index += 1) deep = { cause: deep };

    expect(isAuthzedMutationsFencedError(shallow)).toBe(true);
    expect(isAuthzedMutationsFencedError(deep)).toBe(false);
  });

  test("bounds the number of inspected aggregate errors", () => {
    const errors = Array.from({ length: 64 }, (_, index) => ({ message: `unrelated-${index}` }));
    errors.push({ message: AUTHZED_MUTATIONS_FENCED_ERROR_CODE });

    expect(isAuthzedMutationsFencedError({ errors })).toBe(false);
  });
});

describe("normalizeAuthzedMutationsFencedError", () => {
  test("replaces a raw database error with a fresh cause-free typed error", () => {
    const secret = "database-secret-that-must-not-escape";
    const rawError = {
      ...prismaFenceError(),
      connectionString: `postgresql://app:${secret}@database/formbricks`,
    };

    const normalized = normalizeAuthzedMutationsFencedError(rawError);

    expect(normalized).toBeInstanceOf(AuthzedMutationsFencedError);
    expect(JSON.stringify(normalized)).not.toContain(secret);
    expect(Object.prototype.hasOwnProperty.call(normalized, "cause")).toBe(false);
  });

  test("returns null for unrelated failures", () => {
    expect(normalizeAuthzedMutationsFencedError(new Error("connection refused"))).toBeNull();
  });
});
