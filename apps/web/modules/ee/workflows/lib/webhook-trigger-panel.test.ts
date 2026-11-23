import { describe, expect, test } from "vitest";
import {
  clearStoredTestPayload,
  countUsableVariables,
  isSampleFromLastCall,
  maskWebhookSecretUrl,
  parsePastedSample,
  readStoredTestPayload,
  resolveTestPayload,
  toVariableListRows,
  writeStoredTestPayload,
} from "./webhook-trigger-panel";

const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
};

const throwingStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

describe("maskWebhookSecretUrl", () => {
  test("hides the token and keeps the rest of the URL", () => {
    expect(
      maskWebhookSecretUrl("https://app.formbricks.com/api/v3/workflows/cm9wf2k8x0001/webhook/s3cr3tT0ken")
    ).toBe("https://app.formbricks.com/api/v3/workflows/cm9wf2k8x0001/webhook/••••••••••••••••");
  });

  test("hides the whole value when it is not a Secret URL", () => {
    expect(maskWebhookSecretUrl("s3cr3tT0ken")).toBe("••••••••••••••••");
  });
});

describe("isSampleFromLastCall", () => {
  test("a call saves the sample with it; a paste afterwards does not", () => {
    expect(isSampleFromLastCall("2026-11-13T09:00:00.120Z", "2026-11-13T09:00:00.000Z")).toBe(true);
    expect(isSampleFromLastCall("2026-11-13T09:30:00.000Z", "2026-11-13T09:00:00.000Z")).toBe(false);
    expect(isSampleFromLastCall("2026-11-13T09:30:00.000Z", null)).toBe(false);
  });
});

describe("parsePastedSample", () => {
  test("accepts a JSON object", () => {
    expect(parsePastedSample('{"customer":{"email":"a@b.co"}}')).toEqual({
      ok: true,
      payload: { customer: { email: "a@b.co" } },
    });
  });

  test("refuses text that is not JSON", () => {
    expect(parsePastedSample("{customer: 1}")).toEqual({ ok: false, reason: "invalid_json" });
  });

  test("refuses a list, which a call to the Secret URL may not send either", () => {
    expect(parsePastedSample("[1, 2]")).toEqual({ ok: false, reason: "not_object" });
  });

  test("refuses a payload over 100 KB", () => {
    expect(parsePastedSample(JSON.stringify({ text: "x".repeat(101 * 1024) }))).toEqual({
      ok: false,
      reason: "too_large",
    });
  });
});

describe("test payload storage", () => {
  test("keeps an edit per workflow", () => {
    const storage = memoryStorage();
    expect(writeStoredTestPayload("wf1", '{"a":1}', storage)).toBe(true);

    expect(readStoredTestPayload("wf1", storage)).toBe('{"a":1}');
    expect(readStoredTestPayload("wf2", storage)).toBeNull();
  });

  test("forgets the edit on reset", () => {
    const storage = memoryStorage();
    writeStoredTestPayload("wf1", '{"a":1}', storage);

    clearStoredTestPayload("wf1", storage);

    expect(readStoredTestPayload("wf1", storage)).toBeNull();
  });

  test("works without storage when the browser refuses it", () => {
    expect(readStoredTestPayload("wf1", throwingStorage)).toBeNull();
    expect(writeStoredTestPayload("wf1", "{}", throwingStorage)).toBe(false);
    expect(() => clearStoredTestPayload("wf1", throwingStorage)).not.toThrow();
    expect(writeStoredTestPayload("wf1", "{}", null)).toBe(false);
  });
});

describe("resolveTestPayload", () => {
  test("prefers the edit kept in this browser", () => {
    expect(resolveTestPayload({ stored: '{"edited":true}', sample: { received: true } })).toEqual({
      text: '{"edited":true}',
      source: "edited",
    });
  });

  test("starts from the last received sample", () => {
    expect(resolveTestPayload({ stored: null, sample: { channel: "call" } })).toEqual({
      text: '{\n  "channel": "call"\n}',
      source: "received",
    });
  });

  test("is empty before any call or paste", () => {
    expect(resolveTestPayload({ stored: null, sample: null })).toEqual({ text: "", source: "empty" });
  });
});

describe("toVariableListRows", () => {
  const variables = {
    variables: [
      { path: "payload.channel", valueType: "string" as const },
      { path: "payload.customer", valueType: "object" as const },
      { path: "payload.customer.id", valueType: "string" as const },
      { path: "payload.handle_time_sec", valueType: "number" as const },
      { path: "payload.resolved", valueType: "boolean" as const },
    ],
    notSupported: [
      { path: "payload.tags", reason: "list" as const },
      { path: "payload.a.b", reason: "unreachable_key" as const },
    ],
    truncated: false,
  };

  test("lists the usable Variables by name and type, then the unsupported paths greyed", () => {
    expect(toVariableListRows(variables)).toEqual([
      { path: "payload.channel", name: "channel", typeLabel: "text", isSupported: true },
      { path: "payload.customer.id", name: "customer.id", typeLabel: "text", isSupported: true },
      { path: "payload.handle_time_sec", name: "handle_time_sec", typeLabel: "number", isSupported: true },
      { path: "payload.resolved", name: "resolved", typeLabel: "true_false", isSupported: true },
      { path: "payload.tags", name: "tags", typeLabel: "list", isSupported: false },
      { path: "payload.a.b", name: "a.b", typeLabel: "unsupported", isSupported: false },
    ]);
  });

  test("counts only the Variables a later step can insert", () => {
    expect(countUsableVariables(variables)).toBe(4);
  });
});
