import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import {
  SAML_RESPONSE_MARKUP_BUDGET,
  SAML_RESPONSE_MAX_LENGTH,
} from "@/modules/ee/auth/saml/lib/saml-response-bounds";
import { POST } from "./route";

const { samlResponseMock, jacksonMock, applyIPRateLimitMock, redirectMock, clientIpMock } = vi.hoisted(() => {
  const samlResponseMock = vi.fn(async (_body: { RelayState: string; SAMLResponse: string }) => ({
    redirect_url: "https://app.example.com/api/auth/saml/authorize?code=c",
  }));
  return {
    samlResponseMock,
    jacksonMock: vi.fn(async () => ({ oauthController: { samlResponse: samlResponseMock } })),
    applyIPRateLimitMock: vi.fn(async (_config: unknown) => ({ allowed: true })),
    redirectMock: vi.fn((url: string) => new Response(null, { status: 307, headers: { location: url } })),
    clientIpMock: vi.fn(async () => "203.0.113.7"),
  };
});

vi.mock("@/modules/ee/auth/saml/lib/jackson", () => ({ default: jacksonMock }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyIPRateLimit: applyIPRateLimitMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/utils/client-ip", () => ({
  UNTRUSTED_CLIENT_IP: "untrusted-client-ip",
  getClientIpFromHeaders: clientIpMock,
}));

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
    clientIpMock.mockResolvedValue("203.0.113.7");
  });

  test("hands a response within the budget to jackson and redirects", async () => {
    const response = await POST(callback({ SAMLResponse: b64(ISSUER), RelayState: "boxyhq_jackson_state" }));

    expect(response.status).toBe(307);
    expect(samlResponseMock).toHaveBeenCalledWith({
      RelayState: "boxyhq_jackson_state",
      SAMLResponse: b64(ISSUER),
    });
    expect(applyIPRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "auth:saml-callback" })
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

  test.each([
    [403, 403],
    [400, 400],
  ])(
    "answers a response jackson refuses with %i as %i, logging only its fixed reason",
    async (statusCode, status) => {
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
      samlResponseMock.mockRejectedValueOnce(
        Object.assign(new Error("Something wrong happened."), {
          statusCode,
          internalError: "Issuer not found.",
        })
      );

      const response = await POST(callback({ SAMLResponse: b64(ISSUER), RelayState: "s" }));

      expect(response.status).toBe(status);
      expect(await response.json()).not.toHaveProperty("details.internalError");
      expect(warn).toHaveBeenCalledWith(
        { status, reason: "Issuer not found." },
        "jackson refused a SAML response"
      );
    }
  );

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
    const request = callback({ SAMLResponse: b64(ISSUER), RelayState: "s" });
    const formData = vi.spyOn(request, "formData");

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(formData).not.toHaveBeenCalled();
    expect(samlResponseMock).not.toHaveBeenCalled();
  });

  test("skips the per-IP limit when every caller shares the untrusted identity", async () => {
    // A shared bucket would let one caller lock SAML sign-in for the whole instance; the budget still applies.
    clientIpMock.mockResolvedValue("untrusted-client-ip");
    const flood = `<samlp:Response>${"<a/>".repeat(SAML_RESPONSE_MARKUP_BUDGET)}</samlp:Response>`;

    const ok = await POST(callback({ SAMLResponse: b64(ISSUER), RelayState: "s" }));
    const refused = await POST(callback({ SAMLResponse: b64(flood), RelayState: "s" }));

    expect(applyIPRateLimitMock).not.toHaveBeenCalled();
    expect(ok.status).toBe(307);
    expect(refused.status).toBe(400);
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
