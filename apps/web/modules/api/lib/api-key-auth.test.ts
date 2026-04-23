import { describe, expect, test } from "vitest";
import { getApiKeyFromHeaders, getFeedbackRecordsGatewayJwtFromHeaders } from "./api-key-auth";

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
    expect(getFeedbackRecordsGatewayJwtFromHeaders(headers)).toBeNull();
  });

  test("treats jwt-shaped bearer tokens as gateway JWTs, not API keys", () => {
    const headers = new Headers({
      authorization: "Bearer header.payload.signature",
    });

    expect(getApiKeyFromHeaders(headers)).toBeNull();
    expect(getFeedbackRecordsGatewayJwtFromHeaders(headers)).toBe("header.payload.signature");
  });
});
