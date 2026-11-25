import { describe, expect, test } from "vitest";
import { mayAssertConfirm } from "./confirm-gate";

const CAPS_KEY = "io.modelcontextprotocol/clientCapabilities";

const ctx = (authMethod?: string, capabilities?: Record<string, unknown>) =>
  ({
    http: { authInfo: { token: "t", clientId: "c", scopes: [], extra: { authMethod } } },
    mcpReq: { method: "tools/call", ...(capabilities ? { envelope: { [CAPS_KEY]: capabilities } } : {}) },
  }) as never;

describe("mayAssertConfirm", () => {
  test("an API key may confirm for itself: there is no person to ask", () => {
    expect(mayAssertConfirm(ctx("apiKey", { elicitation: { form: {} } }))).toBe(true);
  });

  test("an OAuth client that declared elicitation may not: the user can be asked", () => {
    expect(mayAssertConfirm(ctx("oauth", { elicitation: { form: {} } }))).toBe(false);
    expect(mayAssertConfirm(ctx("oauth", { elicitation: {} }))).toBe(false);
  });

  test("an OAuth client that declared no elicitation may: it cannot answer a prompt", () => {
    expect(mayAssertConfirm(ctx("oauth", {}))).toBe(true);
  });

  test("a client that only declared URL elicitation cannot answer our form prompt, so it may", () => {
    expect(mayAssertConfirm(ctx("oauth", { elicitation: { url: {} } }))).toBe(true);
    expect(mayAssertConfirm(ctx("oauth", { elicitation: { form: {}, url: {} } }))).toBe(false);
  });

  test("a malformed envelope entry fails closed", () => {
    expect(mayAssertConfirm(ctx("oauth", { elicitation: null }))).toBe(false);
  });

  test("a request without the capability envelope cannot elicit, so it may", () => {
    expect(mayAssertConfirm(ctx("oauth"))).toBe(true);
  });
});
