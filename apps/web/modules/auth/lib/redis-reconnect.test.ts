import { describe, expect, test } from "vitest";
import { getAuthRedisReconnectDelay } from "./redis-reconnect";

describe("authentication Redis reconnection", () => {
  test.each([
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    "ERR_TLS_CERT_ALTNAME_INVALID",
    "CERT_HAS_EXPIRED",
    "CERT_REVOKED",
    "INVALID_CA",
  ])("does not retry certificate verification failure %s", (code) => {
    expect(getAuthRedisReconnectDelay(0, Object.assign(new Error("Invalid certificate"), { code }))).toBe(
      false
    );
  });

  test("backs off for transient network failures and stops after three retries", () => {
    const error = Object.assign(new Error("Connection reset"), { code: "ECONNRESET" });
    expect([0, 1, 2, 3, 4].map((retry) => getAuthRedisReconnectDelay(retry, error))).toEqual([
      50,
      100,
      200,
      false,
      false,
    ]);
  });

  test("also bounds errors without a system code", () => {
    expect(getAuthRedisReconnectDelay(0, new Error("Socket closed"))).toBe(50);
    expect(getAuthRedisReconnectDelay(3, new Error("Socket closed"))).toBe(false);
  });
});
