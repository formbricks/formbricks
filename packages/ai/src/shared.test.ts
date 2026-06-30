import { describe, expect, test } from "vitest";
import {
  getCredentialFingerprint,
  isValidHttpUrl,
  normalizeValue,
  parseBooleanFlag,
  parseStringRecordJson,
} from "./shared";

describe("packages/ai shared helpers", () => {
  describe("normalizeValue", () => {
    test("trims surrounding whitespace", () => {
      expect(normalizeValue("  value  ")).toBe("value");
    });

    test.each([undefined, null, "", "   "])("returns undefined for %p", (value) => {
      expect(normalizeValue(value)).toBeUndefined();
    });
  });

  describe("getCredentialFingerprint", () => {
    test("returns a stable sha256 hash for the same input", () => {
      const fingerprint = getCredentialFingerprint("secret");
      expect(fingerprint).toBe(getCredentialFingerprint("secret"));
      expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    });

    test("returns different hashes for different inputs", () => {
      expect(getCredentialFingerprint("first")).not.toBe(getCredentialFingerprint("second"));
    });

    test.each([undefined, null, "", "   "])("returns null for %p", (value) => {
      expect(getCredentialFingerprint(value)).toBeNull();
    });
  });

  describe("isValidHttpUrl", () => {
    test.each(["http://vllm:8000/v1", "https://api.example.com/v1"])("accepts %s", (value) => {
      expect(isValidHttpUrl(value)).toBe(true);
    });

    test.each(["not-a-url", "ftp://example.com", "file:///etc/passwd", "  "])("rejects %p", (value) => {
      expect(isValidHttpUrl(value)).toBe(false);
    });
  });

  describe("parseStringRecordJson", () => {
    test.each([
      ['{"X-Tenant":"acme"}', { "X-Tenant": "acme" }],
      ['{"a":"1","b":"2"}', { a: "1", b: "2" }],
      ["{}", {}],
    ])("parses valid JSON object of string values %p", (value, expected) => {
      expect(parseStringRecordJson(value)).toEqual(expected);
    });

    test.each(["{not-json}", "", "{", '{"key":}', "undefined"])(
      "throws a JSON parse error for malformed JSON %p",
      (value) => {
        expect(() => parseStringRecordJson(value)).toThrow("Value must be valid JSON");
      }
    );

    test.each(["[]", '"string"', "42", "null", "true", '{"key":1}', '{"key":null}', '{"key":["a"]}'])(
      "throws a shape error for valid JSON that is not a string record %p",
      (value) => {
        expect(() => parseStringRecordJson(value)).toThrow("Value must be a JSON object of string values");
      }
    );
  });

  describe("parseBooleanFlag", () => {
    test.each(["true", "TRUE", "1", " true "])("returns true for %p", (value) => {
      expect(parseBooleanFlag(value)).toBe(true);
    });

    test.each([undefined, null, "", "false", "0", "yes", "no"])("returns false for %p", (value) => {
      expect(parseBooleanFlag(value)).toBe(false);
    });
  });
});
