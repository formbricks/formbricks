import { describe, expect, test } from "vitest";
import { HubQuerySerializationError, serializeHubQuery } from "./hub-query";

/**
 * The per-value contract. `hub-query-wire.test.ts` covers the same serializer through the real SDK and
 * asserts whole URLs; this file is the cheap exhaustive table for the value kinds, including the two that
 * are unreachable from caller input and exist as tripwires.
 */
describe("serializeHubQuery", () => {
  test("emits each element of an array as its own parameter", () => {
    expect(serializeHubQuery({ source_type: ["survey", "review"] })).toBe(
      "source_type=survey&source_type=review"
    );
  });

  test("emits a one-element array exactly as it would a scalar", () => {
    expect(serializeHubQuery({ source_type: ["survey"] })).toBe("source_type=survey");
    expect(serializeHubQuery({ source_type: "survey" })).toBe("source_type=survey");
  });

  test("keeps the order values were given in", () => {
    // The Hub ORs them, so order does not change the result set — but a stable order keeps URLs
    // comparable in tests and logs.
    expect(serializeHubQuery({ emotions: ["joy", "anger", "fear"] })).toBe(
      "emotions=joy&emotions=anger&emotions=fear"
    );
  });

  test("omits undefined but keeps falsy values", () => {
    expect(
      serializeHubQuery({
        tenant_id: "dir_1",
        cursor: undefined,
        has_sentiment: false,
        value_number_min: 0,
      })
    ).toBe("tenant_id=dir_1&has_sentiment=false&value_number_min=0");
  });

  test("serializes null as a present-but-empty parameter", () => {
    // Matches the SDK rather than dropping the key, so behaviour is unchanged for any caller relying on it.
    expect(serializeHubQuery({ cursor: null })).toBe("cursor=");
  });

  test("keeps an empty string, which is a real value for the string filters", () => {
    expect(serializeHubQuery({ source_type: [""] })).toBe("source_type=");
  });

  test("percent-encodes a space instead of form-encoding it", () => {
    expect(serializeHubQuery({ source_name: "Q1 NPS survey" })).toBe("source_name=Q1%20NPS%20survey");
  });

  test("escapes a literal plus so it survives the round trip", () => {
    // Go decodes a bare "+" as a space, so this is what stops "pt+BR" arriving as "pt BR".
    expect(serializeHubQuery({ language: "pt+BR" })).toBe("language=pt%2BBR");
  });

  test("serializes a Date as ISO-8601, as the SDK does", () => {
    expect(serializeHubQuery({ since: new Date("2026-01-01T00:00:00.000Z") })).toBe(
      "since=2026-01-01T00%3A00%3A00.000Z"
    );
  });

  test("throws on an empty array rather than silently dropping the filter", () => {
    // The SDK drops it, which widens the result set with no signal. Unreachable from input because every
    // array filter is `.min(1)` in the v3 schemas, so this is a tripwire for a mapper bug.
    expect(() => serializeHubQuery({ source_type: [] })).toThrow(HubQuerySerializationError);
    expect(() => serializeHubQuery({ source_type: [] })).toThrow(/empty array/);
  });

  test("throws on a nested object rather than inventing bracket keys", () => {
    expect(() => serializeHubQuery({ filter: { nested: "value" } })).toThrow(HubQuerySerializationError);
  });

  test("names the offending parameter so a failure is actionable", () => {
    expect(() => serializeHubQuery({ weird: Symbol("x") })).toThrow(/"weird"/);
  });

  test("returns an empty string for an empty query", () => {
    expect(serializeHubQuery({})).toBe("");
  });
});
