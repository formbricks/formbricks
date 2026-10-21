import { rootCertificates } from "node:tls";
import { describe, expect, test, vi } from "vitest";
import { getRedisTlsOptions } from "./index";

describe("Redis TLS policy", () => {
  test("preserves plaintext development connections without private trust", () => {
    expect(getRedisTlsOptions("redis://localhost:6379/2")).toBeUndefined();
  });

  test("verifies public-CA TLS even while a legacy global bypass exists", () => {
    vi.stubEnv("NODE_TLS_REJECT_UNAUTHORIZED", "0");
    try {
      expect(getRedisTlsOptions("rediss://redis.example.com:6380")).toEqual({ rejectUnauthorized: true });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  test("accepts all CA certificates in a multiline rotation bundle", () => {
    const ca = `\n${rootCertificates[0]}\r\n${rootCertificates[1]}\n`;
    expect(getRedisTlsOptions("rediss://:password@127.0.0.1:6378/3", ca)).toEqual({
      ca: rootCertificates.slice(0, 2).map((pem) => pem.trim()),
      rejectUnauthorized: true,
    });
  });

  test.each([
    "",
    " ",
    "not a certificate",
    "-----BEGIN CERTIFICATE-----\ninvalid\n-----END CERTIFICATE-----",
  ])("rejects invalid private trust without exposing its value: %j", (ca) => {
    expect(() => getRedisTlsOptions("rediss://localhost", ca)).toThrow(
      "REDIS_TLS_CA must contain only valid PEM CA certificates"
    );
  });

  test("rejects repeated unterminated PEM headers", () => {
    expect(() =>
      getRedisTlsOptions("rediss://localhost", "-----BEGIN CERTIFICATE-----".repeat(10_000))
    ).toThrow("REDIS_TLS_CA must contain only valid PEM CA certificates");
  });

  test("rejects nested PEM headers before a valid certificate", () => {
    expect(() =>
      getRedisTlsOptions("rediss://localhost", `-----BEGIN CERTIFICATE-----${rootCertificates[0]}`)
    ).toThrow("REDIS_TLS_CA must contain only valid PEM CA certificates");
  });

  test("rejects a valid CA followed by unparsed content", () => {
    expect(() =>
      getRedisTlsOptions("rediss://localhost", `${rootCertificates[0]}\nprivate material`)
    ).toThrow("REDIS_TLS_CA must contain only valid PEM CA certificates");
  });

  test("does not silently downgrade configured private trust to plaintext", () => {
    expect(() => getRedisTlsOptions("redis://localhost", rootCertificates[0])).toThrow(
      "REDIS_TLS_CA requires a rediss:// REDIS_URL"
    );
  });

  test("does not expose credentials in URL validation errors", () => {
    expect(() => getRedisTlsOptions("rediss://user:very-secret-password@[invalid")).toThrow(
      /^REDIS_URL must be a valid Redis URL$/
    );
  });

  test("rejects unsupported protocols", () => {
    expect(() => getRedisTlsOptions("https://user:secret@example.com")).toThrow(
      /^REDIS_URL must use redis:\/\/ or rediss:\/\/$/
    );
  });
});
