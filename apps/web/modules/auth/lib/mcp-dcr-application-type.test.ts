import { describe, expect, test } from "vitest";
import {
  isDcrRegistration,
  prepareDcrRequest,
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
  test("fills in native when a redirect URI is an http loopback", () => {
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
    ["https on loopback (upstream refuses this for native)", { redirect_uris: ["https://127.0.0.1:1/cb"] }],
    ["a non-loopback http host", { redirect_uris: ["http://10.0.0.5:1/cb"] }],
    ["no redirect_uris at all", { client_name: "x" }],
    ["an empty redirect_uris array", { redirect_uris: [] }],
    ["a non-string entry", { redirect_uris: [42] }],
  ])("leaves %s untouched", (_label, payload) => {
    const body = JSON.stringify(payload);

    expect(withInferredApplicationType(body)).toBe(body);
  });

  /**
   * A native client may register a loopback URI *and* an https one (an app-claimed universal link).
   * Upstream accepts that pair under `native`, and 1.6 accepted it unconditionally, so failing to infer
   * here would newly break it — the regression this file exists to prevent. Widening to "at least one"
   * cannot widen what upstream accepts: it refuses a non-loopback http redirect under `native` too, as
   * the case below asserts.
   */
  test.each([
    ["loopback alongside an https URI", ["http://127.0.0.1:1/cb", "https://app.example.com/cb"]],
    ["an https URI listed first", ["https://app.example.com/cb", "http://localhost:7777/cb"]],
  ])("infers native for %s", (_label, redirect_uris) => {
    const result = JSON.parse(withInferredApplicationType(JSON.stringify({ redirect_uris })));

    expect(result.application_type).toBe("native");
    expect(result.redirect_uris).toEqual(redirect_uris);
  });

  // The security boundary the widening leans on: labelling a client `native` must not be a way to get a
  // non-loopback http redirect registered. We still infer here, and upstream still refuses the URI —
  // asserted end-to-end against the real validator in mcp-oauth-dcr.test.ts.
  test("inferring native does not make a non-loopback http redirect acceptable", () => {
    const redirect_uris = ["http://127.0.0.1:1/cb", "http://evil.example.com/cb"];
    const result = JSON.parse(withInferredApplicationType(JSON.stringify({ redirect_uris })));

    expect(result.application_type).toBe("native");
    expect(result.redirect_uris).toEqual(redirect_uris);
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

describe("prepareDcrRequest", () => {
  test("rebuilds the registration with the inferred type and keeps the headers", async () => {
    const request = new Request(REGISTER, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer t" },
      body: JSON.stringify({ redirect_uris: ["http://127.0.0.1:33418/callback"] }),
    });

    const prepared = await prepareDcrRequest(request);

    expect(prepared).toBeInstanceOf(Request);
    const normalized = prepared as Request;
    expect(normalized.headers.get("authorization")).toBe("Bearer t");
    await expect(normalized.json()).resolves.toMatchObject({ application_type: "native" });
  });

  // ENG-3086: the reported repro — an anonymous registration claiming an attacker-controlled https
  // redirect URI — is rejected before it reaches Better Auth.
  test("rejects a registration with a non-loopback redirect URI", async () => {
    const prepared = await prepareDcrRequest(
      new Request(REGISTER, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_name: "SecurityResearchVerify1",
          redirect_uris: ["https://attacker-controlled-test.example.org/cb"],
          grant_types: ["authorization_code"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
        }),
      })
    );

    expect(prepared).toBeInstanceOf(Response);
    const response = prepared as Response;
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid_redirect_uri" });
  });

  // A Request body is single-use, so the normalizer has to reconstruct even when it changes nothing —
  // otherwise the body it consumed would be gone by the time Better Auth reads it.
  test("still yields a readable body when nothing is inferred", async () => {
    const body = JSON.stringify({
      redirect_uris: ["http://127.0.0.1:1/cb"],
      application_type: "native",
    });
    const prepared = await prepareDcrRequest(new Request(REGISTER, { method: "POST", body }));

    expect(prepared).toBeInstanceOf(Request);
    await expect((prepared as Request).text()).resolves.toBe(body);
  });

  test("returns the original object for a request it does not handle", async () => {
    const request = new Request(`${BASE}/api/auth/sign-in/email`, { method: "POST", body: "{}" });

    expect(await prepareDcrRequest(request)).toBe(request);
  });
});
