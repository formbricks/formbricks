import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import {
  SAML_RESPONSE_MARKUP_BUDGET,
  SAML_RESPONSE_MAX_LENGTH,
} from "@/modules/ee/auth/saml/lib/saml-response-bounds";
import { POST } from "./route";

const { samlResponseMock, jacksonMock, applyIPRateLimitMock, redirectMock } = vi.hoisted(() => {
  const samlResponseMock = vi.fn(async (_body: { RelayState: string; SAMLResponse: string }) => ({
    redirect_url: "https://app.example.com/api/auth/saml/authorize?code=c",
  }));
  return {
    samlResponseMock,
    jacksonMock: vi.fn(async () => ({ oauthController: { samlResponse: samlResponseMock } })),
    applyIPRateLimitMock: vi.fn(async (_config: unknown, _options?: unknown) => ({ allowed: true })),
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
  let clock = Date.now();
  beforeEach(() => {
    vi.clearAllMocks();
    // Refusal logs are throttled per window: move past it so each test sees its own line.
    vi.useFakeTimers({ toFake: ["Date"] });
    clock += 60_000;
    vi.setSystemTime(clock);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("hands a response within the bounds to jackson and redirects", async () => {
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
      {
        reason: "markup",
        markup: expect.any(Number),
        depth: expect.any(Number),
        length: b64(flood).length,
        suppressedSinceLast: 0,
      },
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

  test("logs refusals at most once per window, counting the rest", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const doctype = () => callback({ SAMLResponse: b64('<!DOCTYPE r SYSTEM "x"><r/>'), RelayState: "s" });

    for (let i = 0; i < 5; i++) expect((await POST(doctype())).status).toBe(400);
    expect(warn).toHaveBeenCalledTimes(1);

    clock += 60_000;
    vi.setSystemTime(clock);
    await POST(doctype());
    expect(warn).toHaveBeenLastCalledWith(
      expect.objectContaining({ reason: "declaration", suppressedSinceLast: 4 }),
      "Refused a SAML response before parsing it"
    );
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

  test.each([
    ["no SAMLResponse", { RelayState: "s" }],
    ["an empty SAMLResponse", { SAMLResponse: "", RelayState: "s" }],
    ["SAMLResponse as a file part", { SAMLResponse: new File([b64(ISSUER)], "r.xml"), RelayState: "s" }],
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
