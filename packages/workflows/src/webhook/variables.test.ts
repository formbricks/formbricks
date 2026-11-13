import { describe, expect, test } from "vitest";
import { detectWebhookVariables } from "./variables";

describe("detectWebhookVariables", () => {
  test("offers every object and scalar as a payload-prefixed dot path, in document order", () => {
    const result = detectWebhookVariables({
      customer: { email: "a@b.co", vip: true, address: { city: "Berlin" } },
      total: 12.5,
      note: null,
    });

    expect(result).toEqual({
      variables: [
        { path: "payload.customer", valueType: "object" },
        { path: "payload.customer.email", valueType: "string" },
        { path: "payload.customer.vip", valueType: "boolean" },
        { path: "payload.customer.address", valueType: "object" },
        { path: "payload.customer.address.city", valueType: "string" },
        { path: "payload.total", valueType: "number" },
        { path: "payload.note", valueType: "null" },
      ],
      notSupported: [],
      truncated: false,
    });
  });

  test("reports lists as not supported yet and does not look inside them", () => {
    const result = detectWebhookVariables({ items: [{ sku: "A" }], id: 1 });

    expect(result.variables).toEqual([{ path: "payload.id", valueType: "number" }]);
    expect(result.notSupported).toEqual([{ path: "payload.items", reason: "list" }]);
  });

  test("refuses unsafe segments and keys a dot path cannot reach", () => {
    const payload = JSON.parse(
      '{"__proto__":{"x":1},"constructor":1,"prototype":{},"a.b":1,"":2,"ok":"yes"}'
    ) as Record<string, unknown>;

    const result = detectWebhookVariables(payload);

    expect(result.variables).toEqual([{ path: "payload.ok", valueType: "string" }]);
    expect(result.notSupported).toEqual([
      { path: "payload.__proto__", reason: "unsafe_segment" },
      { path: "payload.constructor", reason: "unsafe_segment" },
      { path: "payload.prototype", reason: "unsafe_segment" },
      { path: "payload.a.b", reason: "unreachable_key" },
      { path: "payload.", reason: "unreachable_key" },
    ]);
  });

  test("stops after the first 500 paths and says so", () => {
    const payload = Object.fromEntries(Array.from({ length: 600 }, (_, index) => [`k${index}`, index]));

    const result = detectWebhookVariables(payload);

    expect(result.variables).toHaveLength(500);
    expect(result.variables.at(-1)).toEqual({ path: "payload.k499", valueType: "number" });
    expect(result.truncated).toBe(true);
  });

  test("counts refused paths toward the 500", () => {
    const payload: Record<string, unknown> = Object.fromEntries(
      Array.from({ length: 500 }, (_, index) => [`k${index}`, [index]])
    );
    payload.last = 1;

    const result = detectWebhookVariables(payload);

    expect(result.notSupported).toHaveLength(500);
    expect(result.variables).toEqual([]);
    expect(result.truncated).toBe(true);
  });
});
