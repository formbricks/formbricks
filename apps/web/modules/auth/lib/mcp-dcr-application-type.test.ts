import { describe, expect, test } from "vitest";
import {
  isDcrRegistration,
  normalizeDcrRequest,
  withInferredApplicationType,
} from "./mcp-dcr-application-type";

const BASE = "https://app.formbricks.test";
const REGISTER = `${BASE}/api/auth/oauth2/register`;

/**
 * ENG-2343. Better Auth 1.7 hardcodes `application_type: "web"` for dynamic client registration, and a
 * web client is refused any loopback redirect URI — which is exactly what a local MCP client uses. 1.6
 * had no such validation, so a client that omits the field regressed from working to
 * `400 invalid_redirect_uri` before consent. Neither the default nor the clients are ours to change, so
 * the field is inferred here when the URIs make it unambiguous.
 */
describe("withInferredApplicationType (ENG-2343)", () => {
  test("fills in native when every redirect URI is an http loopback", () => {
    const body = JSON.stringify({ redirect_uris: ["http://127.0.0.1:33418/callback"] });

    expect(JSON.parse(withInferredApplicationType(body))).toEqual({
      redirect_uris: ["http://127.0.0.1:33418/callback"],
      application_type: "native",
    });
  });

  // The three hosts upstream itself accepts for native http, so the value we supply is guaranteed to
  // pass the validation that runs immediately after.
  test.each(["http://localhost:8080/cb", "http://127.0.0.1:1/cb", "http://[::1]:9000/cb"])(
    "treats %s as native loopback",
    (uri) => {
      const result = JSON.parse(withInferredApplicationType(JSON.stringify({ redirect_uris: [uri] })));

      expect(result.application_type).toBe("native");
    }
  );

  /**
   * Everything else is passed through so upstream decides, exactly as before. Inferring must never be
   * the reason a registration succeeds that should have failed, nor the reason one fails at all.
   */
  test.each([
    [
      "an explicit application_type is never overridden",
      { application_type: "web", redirect_uris: ["http://127.0.0.1:1/cb"] },
    ],
    ["a non-loopback https URI", { redirect_uris: ["https://app.example.com/cb"] }],
    [
      "a mix of loopback and remote",
      { redirect_uris: ["http://127.0.0.1:1/cb", "https://app.example.com/cb"] },
    ],
    ["https on loopback (upstream refuses this for native)", { redirect_uris: ["https://127.0.0.1:1/cb"] }],
    ["a non-loopback http host", { redirect_uris: ["http://10.0.0.5:1/cb"] }],
    ["no redirect_uris at all", { client_name: "x" }],
    ["an empty redirect_uris array", { redirect_uris: [] }],
    ["a non-string entry", { redirect_uris: [42] }],
  ])("leaves %s untouched", (_label, payload) => {
    const body = JSON.stringify(payload);

    expect(withInferredApplicationType(body)).toBe(body);
  });

  // A malformed body must reach upstream unchanged and produce upstream's own error, not ours.
  test.each(["not json", "[1,2,3]", "null", '"a string"'])("passes through %s unchanged", (body) => {
    expect(withInferredApplicationType(body)).toBe(body);
  });
});

describe("isDcrRegistration", () => {
  test("matches a POST to the registration endpoint", () => {
    expect(isDcrRegistration(new Request(REGISTER, { method: "POST", body: "{}" }))).toBe(true);
  });

  test.each([
    ["a GET", new Request(REGISTER)],
    [
      "a sibling MCP OAuth route",
      new Request(`${BASE}/api/auth/oauth2/token`, { method: "POST", body: "{}" }),
    ],
    [
      "the SSO callback",
      new Request(`${BASE}/api/auth/oauth2/callback/openid`, { method: "POST", body: "{}" }),
    ],
    ["an unrelated endpoint", new Request(`${BASE}/api/auth/sign-in/email`, { method: "POST", body: "{}" })],
  ])("does not match %s", (_label, request) => {
    expect(isDcrRegistration(request)).toBe(false);
  });
});

describe("normalizeDcrRequest", () => {
  test("rebuilds the registration with the inferred type and keeps the headers", async () => {
    const request = new Request(REGISTER, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer t" },
      body: JSON.stringify({ redirect_uris: ["http://127.0.0.1:33418/callback"] }),
    });

    const normalized = await normalizeDcrRequest(request);

    expect(normalized.headers.get("authorization")).toBe("Bearer t");
    await expect(normalized.json()).resolves.toMatchObject({ application_type: "native" });
  });

  // A Request body is single-use, so the normalizer has to reconstruct even when it changes nothing —
  // otherwise the body it consumed would be gone by the time Better Auth reads it.
  test("still yields a readable body when nothing is inferred", async () => {
    const body = JSON.stringify({ redirect_uris: ["https://app.example.com/cb"] });
    const normalized = await normalizeDcrRequest(new Request(REGISTER, { method: "POST", body }));

    await expect(normalized.text()).resolves.toBe(body);
  });

  test("returns the original object for a request it does not handle", async () => {
    const request = new Request(`${BASE}/api/auth/sign-in/email`, { method: "POST", body: "{}" });

    expect(await normalizeDcrRequest(request)).toBe(request);
  });
});
