import { describe, expect, test } from "vitest";
import { WEBHOOK_PAYLOAD_MAX_BYTES } from "./limits";
import { checkWebhookPayloadShape, parseWebhookPayload } from "./payload";

const nest = (depth: number): Record<string, unknown> => {
  let value: Record<string, unknown> = { leaf: true };
  for (let level = 1; level < depth; level++) value = { child: value };
  return value;
};

describe("parseWebhookPayload", () => {
  test("accepts a JSON object", () => {
    expect(parseWebhookPayload('{"order":{"id":42}}')).toEqual({ ok: true, payload: { order: { id: 42 } } });
  });

  test.each([
    ["malformed JSON", "{not json", "invalid_json"],
    ["an array", "[1,2]", "not_object"],
    ["a string", '"hello"', "not_object"],
    ["null", "null", "not_object"],
  ])("refuses %s", (_label, text, reason) => {
    expect(parseWebhookPayload(text)).toEqual({ ok: false, reason });
  });

  test("refuses a NUL character in any value or key, which Postgres can't store", () => {
    expect(parseWebhookPayload(String.raw`{"a":{"b":["x\u0000y"]}}`)).toEqual({
      ok: false,
      reason: "null_byte",
    });
    expect(parseWebhookPayload(String.raw`{"k\u0000":1}`)).toEqual({ ok: false, reason: "null_byte" });
    // A backslash followed by "u0000" is plain text, not a NUL.
    expect(parseWebhookPayload(String.raw`{"a":"\\u0000"}`).ok).toBe(true);
  });

  test("accepts exactly ten levels of nesting and refuses eleven", () => {
    expect(parseWebhookPayload(JSON.stringify(nest(10))).ok).toBe(true);
    expect(parseWebhookPayload(JSON.stringify(nest(11)))).toEqual({ ok: false, reason: "too_deep" });
  });

  test("counts lists as nesting levels", () => {
    // object → list → object → … : 11 containers deep in total.
    let value: unknown = { leaf: true };
    for (let level = 1; level < 11; level++) value = level % 2 === 0 ? { child: value } : [value];

    expect(parseWebhookPayload(JSON.stringify(value))).toEqual({ ok: false, reason: "too_deep" });
  });

  test("survives a pathologically deep document without a stack overflow", () => {
    const text = `{"a":${"[".repeat(50_000)}${"]".repeat(50_000)}}`;

    expect(parseWebhookPayload(text)).toEqual({ ok: false, reason: "too_deep" });
  });
});

describe("checkWebhookPayloadShape", () => {
  test("refuses a NUL character anywhere in the object", () => {
    expect(checkWebhookPayloadShape({ a: [{ b: "x\u0000" }] })).toEqual({ ok: false, reason: "null_byte" });
  });

  test("refuses an object over the size cap once serialized", () => {
    const payload = { text: "x".repeat(WEBHOOK_PAYLOAD_MAX_BYTES) };

    expect(checkWebhookPayloadShape(payload)).toEqual({ ok: false, reason: "too_large" });
  });

  test("measures size in UTF-8 bytes, not characters", () => {
    // Each "é" is two bytes, so this is under the cap in characters but over it in bytes.
    const payload = { text: "é".repeat(WEBHOOK_PAYLOAD_MAX_BYTES / 2) };

    expect(checkWebhookPayloadShape(payload)).toEqual({ ok: false, reason: "too_large" });
  });

  test("accepts a small object", () => {
    expect(checkWebhookPayloadShape({ a: 1 })).toEqual({ ok: true, payload: { a: 1 } });
  });
});
