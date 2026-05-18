import { describe, expect, test } from "vitest";
import { getApiKeyFromHeaders, getBearerTokenFromHeaders } from "./api-key-auth";

describe("api-key-auth helpers", () => {
  test("prefers x-api-key over bearer authorization", () => {
    const headers = new Headers({
      "x-api-key": "fbk_from_header",
      authorization: "Bearer fbk_from_bearer",
    });

    expect(getApiKeyFromHeaders(headers)).toBe("fbk_from_header");
  });

  test("extracts bearer API keys", () => {
    const headers = new Headers({
      authorization: "Bearer fbk_from_bearer",
    });

    expect(getApiKeyFromHeaders(headers)).toBe("fbk_from_bearer");
    expect(getBearerTokenFromHeaders(headers)).toBe("fbk_from_bearer");
  });

  test("does not treat jwt-shaped bearer tokens as API keys", () => {
    const headers = new Headers({
      authorization: "Bearer header.payload.signature",
    });

    expect(getApiKeyFromHeaders(headers)).toBeNull();
    expect(getBearerTokenFromHeaders(headers)).toBe("header.payload.signature");
  });

  test("does not treat opaque bearer tokens as API keys", () => {
    const headers = new Headers({
      authorization: "Bearer opaque_service_token",
    });

    expect(getApiKeyFromHeaders(headers)).toBeNull();
    expect(getBearerTokenFromHeaders(headers)).toBe("opaque_service_token");
  });
});
