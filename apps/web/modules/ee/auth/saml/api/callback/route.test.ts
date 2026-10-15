import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { SAML_RESPONSE_MARKUP_BUDGET } from "@/modules/ee/auth/saml/lib/saml-response-bounds";
import { POST } from "./route";

const { samlResponseMock, jacksonMock, applyIPRateLimitMock, redirectMock } = vi.hoisted(() => {
  const samlResponseMock = vi.fn(async (_body: { RelayState: string; SAMLResponse: string }) => ({
    redirect_url: "https://app.example.com/api/auth/saml/authorize?code=c",
  }));
  return {
    samlResponseMock,
    jacksonMock: vi.fn(async () => ({ oauthController: { samlResponse: samlResponseMock } })),
    applyIPRateLimitMock: vi.fn(async (_config: unknown) => ({ allowed: true })),
    redirectMock: vi.fn((url: string) => new Response(null, { status: 307, headers: { location: url } })),
  };
});

vi.mock("@/modules/ee/auth/saml/lib/jackson", () => ({ default: jacksonMock }));
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

    const response = await POST(callback({ SAMLResponse: b64(flood), RelayState: "s" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "bad_request" });
    expect(samlResponseMock).not.toHaveBeenCalled();
  });

  test("answers 429 once the caller's IP is over its limit, without reading or parsing the body", async () => {
    applyIPRateLimitMock.mockRejectedValueOnce(
      new TooManyRequestsError("Maximum number of requests reached.")
    );
    const request = callback({ SAMLResponse: b64(ISSUER), RelayState: "s" });
    const formData = vi.spyOn(request, "formData");

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(formData).not.toHaveBeenCalled();
    expect(samlResponseMock).not.toHaveBeenCalled();
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

  test("passes a missing SAMLResponse to jackson unchanged, which rejects it as before", async () => {
    await POST(callback({ RelayState: "s" }));

    expect(samlResponseMock).toHaveBeenCalledWith({ RelayState: "s", SAMLResponse: undefined });
  });
});
