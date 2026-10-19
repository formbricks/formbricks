import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { hashString } from "@/lib/hash-string";
import type { SamlParseProbe } from "@/modules/ee/auth/saml/lib/saml-parse-budget";
import {
  SAML_RESPONSE_MARKUP_BUDGET,
  SAML_RESPONSE_MAX_LENGTH,
} from "@/modules/ee/auth/saml/lib/saml-response-bounds";
import { POST } from "./route";

const CLAIMS = { issuer: "https://idp.example.com", id: "_resp1", inResponseTo: "_req1" };
const PARSED: SamlParseProbe = { outcome: "parsed", ms: 3, claims: CLAIMS };

const { samlResponseMock, jacksonMock, applyIPRateLimitMock, redirectMock, probeMock } = vi.hoisted(() => {
  const samlResponseMock = vi.fn(async (_body: { RelayState: string; SAMLResponse: string }) => ({
    redirect_url: "https://app.example.com/api/auth/saml/authorize?code=c",
  }));
  return {
    samlResponseMock,
    jacksonMock: vi.fn(async () => ({ oauthController: { samlResponse: samlResponseMock } })),
    applyIPRateLimitMock: vi.fn(async (_config: unknown, _options?: unknown) => ({ allowed: true })),
    redirectMock: vi.fn((url: string) => new Response(null, { status: 307, headers: { location: url } })),
    probeMock: vi.fn(async (_samlResponse: string): Promise<SamlParseProbe> => PARSED),
  };
});

vi.mock("@/modules/ee/auth/saml/lib/jackson", () => ({ default: jacksonMock }));
vi.mock("@/modules/ee/auth/saml/lib/saml-parse-budget", () => ({ probeSamlResponseParse: probeMock }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyIPRateLimit: applyIPRateLimitMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const b64 = (xml: string) => Buffer.from(xml).toString("base64");
const ISSUER = "<samlp:Response><saml2:Issuer>https://idp.example.com</saml2:Issuer></samlp:Response>";

const callback = (fields: Record<string, string>) =>
  new Request("http://localhost/api/auth/saml/callback", {
    method: "POST",
    body: new URLSearchParams(fields),
  });

describe("SAML callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    probeMock.mockResolvedValue(PARSED);
  });

  test("hands a response within the budget to jackson and redirects", async () => {
    const response = await POST(callback({ SAMLResponse: b64(ISSUER), RelayState: "boxyhq_jackson_state" }));

    expect(response.status).toBe(307);
    expect(samlResponseMock).toHaveBeenCalledWith({
      RelayState: "boxyhq_jackson_state",
      SAMLResponse: b64(ISSUER),
    });
    // The shared untrusted identity is skipped by the limiter itself (helpers.test.ts covers that half).
    expect(applyIPRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "auth:saml-callback" }),
      { skipUntrustedClient: true }
    );
  });

  test("refuses a response over the markup budget before jackson parses it", async () => {
    const flood = `<samlp:Response>${"<a/>".repeat(SAML_RESPONSE_MARKUP_BUDGET)}</samlp:Response>`;
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    const response = await POST(callback({ SAMLResponse: b64(flood), RelayState: "s" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "bad_request" });
    expect(samlResponseMock).not.toHaveBeenCalled();
    // The refusal is logged by size only: no SAMLResponse content may reach the log.
    expect(warn).toHaveBeenCalledWith(
      { reason: "markup", markup: expect.any(Number), depth: expect.any(Number), length: b64(flood).length },
      "Refused a SAML response before parsing it"
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(b64(flood).slice(0, 32));
  });

  test.each([
    ["longer than the cap, however little markup it holds", "a".repeat(SAML_RESPONSE_MAX_LENGTH + 1)],
    [
      "nested deeper than the cap",
      b64(Array.from({ length: 4000 }, (_, i) => `<a xmlns:p${i}="u">`).join("")),
    ],
  ])("refuses a response %s before jackson parses it", async (_name, SAMLResponse) => {
    vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    const response = await POST(callback({ SAMLResponse, RelayState: "s" }));

    expect(response.status).toBe(400);
    expect(samlResponseMock).not.toHaveBeenCalled();
  });

  test("refuses a response with a DOCTYPE before jackson parses it, naming the reason", async () => {
    vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    const response = await POST(
      callback({ SAMLResponse: b64('<!DOCTYPE r SYSTEM "x">' + ISSUER), RelayState: "s" })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ message: expect.stringContaining("DOCTYPE") });
    expect(samlResponseMock).not.toHaveBeenCalled();
  });

  test("answers 400 to a body that is not a form", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/saml/callback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ SAMLResponse: b64(ISSUER) }),
      })
    );

    expect(response.status).toBe(400);
    expect(samlResponseMock).not.toHaveBeenCalled();
  });

  test.each([403, 400, 401, 404])(
    "answers a response jackson refuses with %i with that status, logging its fixed texts and the identifiers",
    async (statusCode) => {
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
      samlResponseMock.mockRejectedValueOnce(
        Object.assign(new Error("Something wrong happened."), {
          statusCode,
          internalError: "Issuer not found.",
        })
      );

      const response = await POST(callback({ SAMLResponse: b64(ISSUER), RelayState: "s" }));

      expect(response.status).toBe(statusCode);
      expect(await response.json()).toMatchObject({ message: "The SAML response was not accepted" });
      expect(warn).toHaveBeenCalledWith(
        {
          stage: "jackson",
          status: statusCode,
          message: "Something wrong happened.",
          reason: "Issuer not found.",
          length: b64(ISSUER).length,
          relayState: hashString("s"),
          claimedIssuer: CLAIMS.issuer,
          responseId: CLAIMS.id,
          inResponseTo: CLAIMS.inResponseTo,
        },
        "jackson refused a SAML response"
      );
    }
  );

  test("logs jackson's message when a refusal carries no separate reason", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    samlResponseMock.mockRejectedValueOnce(
      Object.assign(new Error("Redirect URL is not allowed."), { statusCode: 403 })
    );

    const response = await POST(callback({ SAMLResponse: b64(ISSUER), RelayState: "s" }));

    expect(response.status).toBe(403);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 403, message: "Redirect URL is not allowed.", reason: undefined }),
      "jackson refused a SAML response"
    );
  });

  test("caps and strips what it logs from jackson and from the response's claims", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    probeMock.mockResolvedValueOnce({
      ...PARSED,
      claims: { issuer: "https://idp.example.com\n\u202eforged", id: "x".repeat(500) },
    });
    samlResponseMock.mockRejectedValueOnce(Object.assign(new Error("e".repeat(1000)), { statusCode: 403 }));

    await POST(callback({ SAMLResponse: b64(ISSUER), RelayState: "s" }));

    const [fields] = warn.mock.calls[0] as [Record<string, string>];
    expect(fields.message.length).toBeLessThanOrEqual(203);
    expect(fields.responseId.length).toBeLessThanOrEqual(131);
    expect(fields.claimedIssuer).toBe("https://idp.example.com??forged");
  });

  test("never logs the response or the raw RelayState", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    samlResponseMock.mockRejectedValueOnce(Object.assign(new Error("no"), { statusCode: 403 }));

    await POST(callback({ SAMLResponse: b64(ISSUER), RelayState: "relay-state-secret" }));

    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain(b64(ISSUER).slice(0, 24));
    expect(logged).not.toContain("relay-state-secret");
  });

  test("logs a response that fails validation and does not follow jackson's error redirect", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    samlResponseMock.mockResolvedValueOnce({
      redirect_url:
        "https://app.example.com/callback?error=access_denied&error_description=Invalid%20signature",
      error: "Invalid signature",
    } as never);

    const response = await POST(callback({ SAMLResponse: b64(ISSUER), RelayState: "s" }));

    expect(response.status).toBe(400);
    expect(redirectMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "validation",
        error: "Invalid signature",
        claimedIssuer: CLAIMS.issuer,
      }),
      "SAML response failed validation"
    );
  });

  describe("parse budget", () => {
    test("parses within the budget before jackson sees the response", async () => {
      await POST(callback({ SAMLResponse: b64(ISSUER), RelayState: "s" }));

      expect(probeMock).toHaveBeenCalledWith(b64(ISSUER));
      expect(probeMock.mock.invocationCallOrder[0]).toBeLessThan(
        samlResponseMock.mock.invocationCallOrder[0]
      );
    });

    test("refuses a response that took too long to parse, without jackson", async () => {
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
      probeMock.mockResolvedValueOnce({ outcome: "too_slow" });

      const response = await POST(callback({ SAMLResponse: b64(ISSUER), RelayState: "s" }));

      expect(response.status).toBe(400);
      expect(samlResponseMock).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({ stage: "parse_budget" }),
        "Refused a SAML response that took too long to parse"
      );
    });

    test.each([
      ["the queue is full", "busy" as const],
      ["the parse worker failed", "failed" as const],
    ])("answers 503 with Retry-After when %s, without jackson", async (_name, outcome) => {
      vi.spyOn(logger, "warn").mockImplementation(() => undefined);
      vi.spyOn(logger, "error").mockImplementation(() => undefined);
      probeMock.mockResolvedValueOnce({ outcome });

      const response = await POST(callback({ SAMLResponse: b64(ISSUER), RelayState: "s" }));

      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("1");
      expect(samlResponseMock).not.toHaveBeenCalled();
    });

    test("does not parse what the cheap checks refuse, nor what the rate limit refuses", async () => {
      vi.spyOn(logger, "warn").mockImplementation(() => undefined);
      applyIPRateLimitMock.mockRejectedValueOnce(
        new TooManyRequestsError("Maximum number of requests reached.")
      );

      await POST(callback({ SAMLResponse: "", RelayState: "s" }));
      await POST(callback({ SAMLResponse: b64(ISSUER), RelayState: "s" }));

      expect(probeMock).not.toHaveBeenCalled();
    });
  });

  describe("a browser's form post", () => {
    const browserPost = (fields: Record<string, string>, headers: Record<string, string>) =>
      new Request("http://localhost/api/auth/saml/callback", {
        method: "POST",
        headers,
        body: new URLSearchParams(fields),
      });
    const NAVIGATE = { "sec-fetch-mode": "navigate", accept: "text/html" };

    test.each([
      ["an empty SAMLResponse", { SAMLResponse: "", RelayState: "s" }, undefined, "saml_response_rejected"],
      [
        "a connection jackson cannot find",
        { SAMLResponse: b64(ISSUER), RelayState: "s" },
        Object.assign(new Error("x"), { statusCode: 403, internalError: "SAML connection not found." }),
        "saml_connection_unavailable",
      ],
      [
        "a RelayState jackson did not issue",
        { SAMLResponse: b64(ISSUER), RelayState: "s" },
        Object.assign(new Error("Unable to validate state from the origin request."), { statusCode: 403 }),
        "saml_response_rejected",
      ],
    ])("is sent to the login page with a fixed code for %s", async (_name, fields, jacksonError, code) => {
      vi.spyOn(logger, "warn").mockImplementation(() => undefined);
      if (jacksonError) samlResponseMock.mockRejectedValueOnce(jacksonError);

      const response = await POST(browserPost(fields, NAVIGATE));

      expect(response.status).toBe(303);
      const location = new URL(response.headers.get("location") ?? "");
      expect(location.pathname).toBe("/auth/login");
      expect(location.searchParams.get("error")).toBe(code);
      expect(response.headers.get("location")).not.toContain("SAML connection not found");
    });

    test("falls back to Accept when the browser sends no Fetch Metadata", async () => {
      const response = await POST(
        browserPost({ SAMLResponse: "", RelayState: "s" }, { accept: "text/html" })
      );

      expect(response.status).toBe(303);
    });

    test("leaves a fetch with Fetch Metadata to the JSON answer, whatever it accepts", async () => {
      const response = await POST(
        browserPost({ SAMLResponse: "", RelayState: "s" }, { "sec-fetch-mode": "cors", accept: "text/html" })
      );

      expect(response.status).toBe(400);
    });
  });

  test.each([
    ["a jackson error with a 5xx status", Object.assign(new Error("db down"), { statusCode: 500 })],
    ["any other error", new Error("boom")],
  ])("lets %s propagate", async (_name, error) => {
    samlResponseMock.mockRejectedValueOnce(error);

    await expect(POST(callback({ SAMLResponse: b64(ISSUER), RelayState: "s" }))).rejects.toBe(error);
  });

  test("answers 429 with Retry-After once the caller's IP is over its limit, before jackson parses anything", async () => {
    applyIPRateLimitMock.mockRejectedValueOnce(
      new TooManyRequestsError("Maximum number of requests reached.", 42)
    );

    const response = await POST(callback({ SAMLResponse: b64(ISSUER), RelayState: "s" }));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(samlResponseMock).not.toHaveBeenCalled();
  });

  test.each([
    ["a body that is not a form", () => new Request("http://localhost/x", { method: "POST", body: "{}" })],
    ["an empty SAMLResponse", () => callback({ SAMLResponse: "", RelayState: "s" })],
    [
      "a response over the markup budget",
      () =>
        callback({
          SAMLResponse: b64(`<r>${"<a/>".repeat(SAML_RESPONSE_MARKUP_BUDGET)}</r>`),
          RelayState: "s",
        }),
    ],
  ])("does not count %s against the per-IP limit", async (_name, request) => {
    // Junk refused by the cheap checks must not spend the sign-ins of a tenant behind the same NAT.
    vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(applyIPRateLimitMock).not.toHaveBeenCalled();
  });

  test("lets any other rate-limiter error propagate", async () => {
    const boom = new Error("redis exploded");
    applyIPRateLimitMock.mockRejectedValueOnce(boom);

    await expect(POST(callback({ SAMLResponse: b64(ISSUER), RelayState: "s" }))).rejects.toBe(boom);
    expect(samlResponseMock).not.toHaveBeenCalled();
  });

  test("answers 403 without rate limiting or parsing when SAML is not licensed", async () => {
    jacksonMock.mockResolvedValueOnce(undefined as never);

    const response = await POST(callback({ SAMLResponse: b64(ISSUER), RelayState: "s" }));

    expect(response.status).toBe(403);
    expect(applyIPRateLimitMock).not.toHaveBeenCalled();
    expect(samlResponseMock).not.toHaveBeenCalled();
  });

  test("hands an IdP-initiated response with no RelayState to jackson as an empty RelayState", async () => {
    const response = await POST(callback({ SAMLResponse: b64(ISSUER) }));

    expect(response.status).toBe(307);
    expect(samlResponseMock).toHaveBeenCalledWith({ RelayState: "", SAMLResponse: b64(ISSUER) });
  });

  test.each([
    ["no SAMLResponse", { RelayState: "s" }],
    ["an empty SAMLResponse", { SAMLResponse: "", RelayState: "s" }],
    ["SAMLResponse as a file part", { SAMLResponse: new File([b64(ISSUER)], "r.xml"), RelayState: "s" }],
    ["RelayState as a file part", { SAMLResponse: b64(ISSUER), RelayState: new File(["s"], "s.txt") }],
  ])("answers 400 to %s without handing it to jackson", async (_name, fields) => {
    const form = new FormData();
    for (const [name, value] of Object.entries(fields)) form.append(name, value);

    const response = await POST(
      new Request("http://localhost/api/auth/saml/callback", { method: "POST", body: form })
    );

    expect(response.status).toBe(400);
    expect(samlResponseMock).not.toHaveBeenCalled();
  });
});
