import { describe, expect, test } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { classifyWorkflowSaveError, getWorkflowApiErrorMessage } from "@/modules/ee/workflows/lib/api-error";

const rejected = (detail: string) => new V3ApiError({ status: 422, detail });
const gatewayError = (status: number) => new V3ApiError({ status, detail: "Bad Gateway" });

describe("getWorkflowApiErrorMessage", () => {
  test("surfaces the server-authored detail of an API problem response", () => {
    expect(getWorkflowApiErrorMessage(rejected("Definition is invalid."), "fallback")).toBe(
      "Definition is invalid."
    );
  });

  test.each([
    // parseV3ApiError falls back to response.statusText, which is always "" over HTTP/2.
    ["a V3ApiError with an empty detail", rejected("")],
    ["a V3ApiError with a whitespace-only detail", rejected("   ")],
    // The strings this helper exists to keep off the screen.
    ["an offline fetch rejection", new TypeError("Failed to fetch")],
    ["a Firefox offline fetch rejection", new TypeError("NetworkError when attempting to fetch resource.")],
    ["the mutation timeout", new DOMException("The operation timed out.", "TimeoutError")],
    ["an unexpected Error", new Error("kaboom")],
    ["a non-Error throw", "kaboom"],
    ["a thrown undefined", undefined],
    // Gateway text is not copy we authored, so it must not reach the user.
    ["a 500", gatewayError(500)],
    ["a 502", gatewayError(502)],
    ["a 503", gatewayError(503)],
    ["a 504", gatewayError(504)],
  ])("falls back to the caller's copy for %s", (_label, error) => {
    expect(getWorkflowApiErrorMessage(error, "fallback")).toBe("fallback");
  });
});

describe("classifyWorkflowSaveError", () => {
  test("treats an API problem response as rejected", () => {
    expect(classifyWorkflowSaveError(rejected("Definition is invalid."))).toBe("rejected");
  });

  test.each([
    ["an offline fetch rejection", new TypeError("Failed to fetch")],
    ["the mutation timeout", new DOMException("The operation timed out.", "TimeoutError")],
    ["a non-Error throw", "kaboom"],
    // A restarting server or a proxy hiccup says nothing about the draft, so it stays retryable.
    ["a 500", gatewayError(500)],
    ["a 502", gatewayError(502)],
    ["a 503", gatewayError(503)],
    ["a 504", gatewayError(504)],
  ])("treats %s as unreachable", (_label, error) => {
    expect(classifyWorkflowSaveError(error)).toBe("unreachable");
  });

  test.each([
    ["a 400", 400],
    ["a 404", 404],
    ["a 422", 422],
    ["a 499", 499],
  ])("treats %s as a refusal that must not auto-retry", (_label, status) => {
    expect(classifyWorkflowSaveError(new V3ApiError({ status, detail: "Nope." }))).toBe("rejected");
  });
});
