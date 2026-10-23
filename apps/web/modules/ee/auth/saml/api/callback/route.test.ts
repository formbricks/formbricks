import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { WEBAPP_URL } from "@/lib/constants";
import { hashString } from "@/lib/hash-string";
import type { SamlParseProbe } from "@/modules/ee/auth/saml/lib/saml-parse-budget";
import {
  SAML_RESPONSE_MARKUP_BUDGET,
  SAML_RESPONSE_MAX_ELEMENTS,
  SAML_RESPONSE_MAX_LENGTH,
} from "@/modules/ee/auth/saml/lib/saml-response-bounds";
import { samlResponseWithoutAssertion } from "@/modules/ee/auth/saml/lib/saml-response-without-assertion";
import { JACKSON_RELAY_STATE_PREFIX, POST, type SamlErrorCode, buildLoginErrorUrl } from "./route";

const CLAIMS = { issuer: "https://idp.example.com", id: "_resp1", inResponseTo: "_req1" };
const PARSED: SamlParseProbe = { outcome: "parsed", ms: 3, claims: CLAIMS };

const {
  samlResponseMock,
  decryptionKeyMock,
  jacksonMock,
  applyIPRateLimitMock,
  redirectMock,
  probeMock,
  IDP_VERIFICATION,
} = vi.hoisted(() => {
  const samlResponseMock = vi.fn(async (_body: { RelayState: string; SAMLResponse: string }) => ({
    redirect_url: "https://app.example.com/api/auth/saml/authorize?code=c",
  }));
  const decryptionKeyMock = vi.fn(async () => "sp-private-key");
  // What jackson checks signatures with; the route passes it to the parse worker as it is (ENG-4108).
  const IDP_VERIFICATION = { publicKey: "idp-certificate" };
  return {
    samlResponseMock,
    decryptionKeyMock,
    IDP_VERIFICATION,
    jacksonMock: vi.fn(async () => ({
      oauthController: { samlResponse: samlResponseMock },
      getDecryptionKey: decryptionKeyMock,
      idpVerification: IDP_VERIFICATION,
    })),
    applyIPRateLimitMock: vi.fn(async (_config: unknown, _options?: unknown) => ({ allowed: true })),
    redirectMock: vi.fn((url: string) => new Response(null, { status: 307, headers: { location: url } })),
    probeMock: vi.fn(
      async (
        _samlResponse: string,
        _decryptionKey?: string | null,
        _idpVerification?: unknown
      ): Promise<SamlParseProbe> => PARSED
    ),
  };
});

vi.mock("@/modules/ee/auth/saml/lib/jackson", () => ({ default: jacksonMock }));
vi.mock("@/modules/ee/auth/saml/lib/saml-parse-budget", () => ({ probeSamlResponseParse: probeMock }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyIPRateLimit: applyIPRateLimitMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const b64 = (xml: string) => Buffer.from(xml).toString("base64");
const ISSUER = "<samlp:Response><saml2:Issuer>https://idp.example.com</saml2:Issuer></samlp:Response>";

/** The error jackson throws for a response it refuses, which carries a 4xx status. */
const jacksonError = (message: string, statusCode: number, internalError?: string) =>
  Object.assign(new Error(message), { statusCode, internalError });

const callback = (fields: Record<string, string>) =>
  new Request("http://localhost/api/auth/saml/callback", {
    method: "POST",
    body: new URLSearchParams(fields),
  });

describe("SAML callback route", () => {
  let clock = Date.now();
  beforeEach(() => {
    vi.clearAllMocks();
    probeMock.mockResolvedValue(PARSED);
    // Cheap-path refusal logs are throttled per window: move past it so each test sees its own line.
    vi.useFakeTimers({ toFake: ["Date"] });
    clock += 60_000;
    vi.setSystemTime(clock);
  });
  afterEach(() => {
    vi.useRealTimers();
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

  test("refuses a response over an element cap before jackson parses it", async () => {
    // saml20's parseIssuer selects every Issuer element one by one through xpath's quadratic node-set add, on every
    // callback and before any other check: this shape holds the thread ~1.9 s unless it is refused here.
    const flood = `<samlp:Response>${"<Issuer>x</Issuer>".repeat(4_000)}</samlp:Response>`;
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    const response = await POST(callback({ SAMLResponse: b64(flood), RelayState: "s" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "bad_request",
      message: "SAMLResponse carries more elements than a SAML response does",
    });
    expect(samlResponseMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      {
        reason: "elements",
        localName: "Issuer",
        count: SAML_RESPONSE_MAX_ELEMENTS.Issuer + 1,
        length: b64(flood).length,
        suppressedSinceLast: 0,
      },
      "Refused a SAML response before parsing it"
    );
  });

  test("refuses a response with more Signature elements than the cap before parsing it, by count only", async () => {
    const xml = ISSUER.replace(
      "</samlp:Response>",
      "<ds:Signature/>".repeat(SAML_RESPONSE_MAX_ELEMENTS.Signature + 1) + "</samlp:Response>"
    );
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    const response = await POST(callback({ SAMLResponse: b64(xml), RelayState: "boxyhq_jackson_state" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "bad_request",
      message: "SAMLResponse carries more elements than a SAML response does",
    });
    expect(probeMock).not.toHaveBeenCalled();
    expect(samlResponseMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      {
        reason: "elements",
        localName: "Signature",
        count: SAML_RESPONSE_MAX_ELEMENTS.Signature + 1,
        length: b64(xml).length,
        suppressedSinceLast: 0,
      },
      "Refused a SAML response before parsing it"
    );
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
          claimed: { issuer: CLAIMS.issuer, responseId: CLAIMS.id, inResponseTo: CLAIMS.inResponseTo },
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

    const [fields] = warn.mock.calls[0] as [{ message: string; claimed: Record<string, string> }];
    expect(fields.message.length).toBeLessThanOrEqual(203);
    expect(fields.claimed.responseId.length).toBeLessThanOrEqual(131);
    expect(fields.claimed.issuer).toBe("https://idp.example.com??forged");
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
        claimed: expect.objectContaining({ issuer: CLAIMS.issuer }),
      }),
      "SAML response failed validation"
    );
  });

  describe("parse budget", () => {
    test("parses within the budget before jackson sees the response", async () => {
      await POST(callback({ SAMLResponse: b64(ISSUER), RelayState: "boxyhq_jackson_s" }));

      // With jackson's key, so an encrypted assertion is decrypted and timed before jackson does it (ENG-4051).
      expect(probeMock).toHaveBeenCalledWith(b64(ISSUER), "sp-private-key", IDP_VERIFICATION);
      expect(probeMock.mock.invocationCallOrder[0]).toBeLessThan(
        samlResponseMock.mock.invocationCallOrder[0]
      );
    });

    test.each(["", "s", "BOXYHQ_JACKSON_s"])(
      "reads no key for a response jackson would not decrypt (RelayState %j), so the worker decrypts nothing",
      async (RelayState) => {
        await POST(callback({ SAMLResponse: b64(ISSUER), RelayState }));

        expect(decryptionKeyMock).not.toHaveBeenCalled();
        expect(probeMock).toHaveBeenCalledWith(b64(ISSUER), null, IDP_VERIFICATION);
        expect(samlResponseMock).toHaveBeenCalled();
      }
    );

    test("knows jackson's RelayState prefix", () => {
      // jackson decrypts only for responses carrying it, so the worker's decision has to follow the same mark.
      const jacksonUtils = createRequire(import.meta.url)("@boxyhq/saml-jackson/dist/controller/utils") as {
        relayStatePrefix: string;
      };

      expect(JACKSON_RELAY_STATE_PREFIX).toBe(jacksonUtils.relayStatePrefix);
    });

    test("refuses rather than parse without jackson's key, which an encrypted assertion would need", async () => {
      const error = vi.spyOn(logger, "error").mockImplementation(() => undefined);
      decryptionKeyMock.mockRejectedValueOnce(new Error("Certificate store not initialized"));

      const response = await POST(callback({ SAMLResponse: b64(ISSUER), RelayState: "boxyhq_jackson_s" }));

      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("1");
      expect(probeMock).not.toHaveBeenCalled();
      expect(samlResponseMock).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Certificate store not initialized", length: b64(ISSUER).length }),
        "SAML decryption key could not be read; refused a SAML response"
      );
    });

    test.each(["time", "memory"] as const)(
      "refuses a response too costly to parse (%s), without jackson",
      async (reason) => {
        const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
        probeMock.mockResolvedValueOnce({ outcome: "too_costly", reason });

        const response = await POST(callback({ SAMLResponse: b64(ISSUER), RelayState: "s" }));

        expect(response.status).toBe(400);
        expect(samlResponseMock).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledWith(
          expect.objectContaining({ stage: "parse_budget", reason }),
          "Refused a SAML response that was too costly to parse"
        );
      }
    );

    // ENG-6646: once the worker has begun decrypting, the route has no answer of its own. jackson answers the response
    // without its assertion, which is how it answers an assertion that does not decrypt.
    describe("a response refused once its encrypted assertion was opened", () => {
      const OPENED = { RelayState: "boxyhq_jackson_s", SAMLResponse: b64(ISSUER) };
      const opened = (cause: Extract<SamlParseProbe, { outcome: "refused_encrypted" }>["cause"]) =>
        probeMock.mockResolvedValueOnce({
          outcome: "refused_encrypted",
          issuer: "https://idp.example.com",
          cause,
        });
      /** What jackson is asked to judge in its place. */
      const WITHOUT_ASSERTION = {
        RelayState: OPENED.RelayState,
        SAMLResponse: samlResponseWithoutAssertion("https://idp.example.com"),
      };

      test.each([
        ["past the markup budget", { reason: "markup", markup: 13_002, depth: 2, decryptedBytes: 52_400 }],
        ["carrying a DOCTYPE", { reason: "declaration", decryptedBytes: 900 }],
      ] as const)(
        "is answered by jackson when its decrypted assertion is %s, and logged by size",
        async (_name, refusal) => {
          const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
          opened(refusal);
          samlResponseMock.mockRejectedValueOnce(
            jacksonError("Unable to validate state from the origin request.", 403)
          );

          const response = await POST(callback(OPENED));

          // jackson's refusal, as for an assertion that does not decrypt: no session, so before it would decrypt.
          expect(response.status).toBe(403);
          expect(await response.json()).toEqual({
            code: "forbidden",
            message: "The SAML response was not accepted",
            details: {},
          });
          expect(samlResponseMock).toHaveBeenCalledExactlyOnceWith(WITHOUT_ASSERTION);
          expect(warn).toHaveBeenCalledWith(
            { ...refusal, suppressedSinceLast: 0 },
            "Refused a SAML response whose decrypted assertion is past the bounds"
          );
        }
      );

      test.each(["time", "memory"] as const)(
        "is answered by jackson when it was too costly (%s) once decrypting",
        async (reason) => {
          const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
          opened({ reason });
          samlResponseMock.mockResolvedValueOnce({
            redirect_url: "https://app.example.com/cb?error=access_denied",
            error: "Could not find assertion",
          } as never);

          const response = await POST(callback(OPENED));

          // jackson got as far as validation (a live session), so its validation failure: never "too costly".
          expect(response.status).toBe(400);
          expect(await response.json()).toEqual({
            code: "bad_request",
            message: "The SAML response was not accepted",
            details: {},
          });
          expect(samlResponseMock).toHaveBeenCalledExactlyOnceWith(WITHOUT_ASSERTION);
          expect(warn).toHaveBeenCalledWith(
            expect.objectContaining({ stage: "parse_budget", reason, decrypting: true }),
            "Refused a SAML response that was too costly to parse"
          );
        }
      );

      test("is answered by jackson when the worker died decrypting, and logged as an error", async () => {
        const error = vi.spyOn(logger, "error").mockImplementation(() => undefined);
        vi.spyOn(logger, "warn").mockImplementation(() => undefined);
        opened({ reason: "failed" });
        samlResponseMock.mockRejectedValueOnce(jacksonError("SAML connection not found.", 403));

        const response = await POST(callback(OPENED));

        expect(response.status).toBe(403);
        expect(samlResponseMock).toHaveBeenCalledExactlyOnceWith(WITHOUT_ASSERTION);
        expect(error).toHaveBeenCalledWith(
          expect.objectContaining({
            claimed: expect.objectContaining({ issuer: "https://idp.example.com" }),
          }),
          "SAML parse worker failed while decrypting; refused a SAML response"
        );
      });

      test("is refused even were jackson to accept the response without its assertion", async () => {
        const error = vi.spyOn(logger, "error").mockImplementation(() => undefined);
        vi.spyOn(logger, "warn").mockImplementation(() => undefined);
        opened({ reason: "time" });
        // The default mock accepts anything.

        const response = await POST(callback(OPENED));

        expect(response.status).toBe(400);
        expect(response.headers.get("location")).toBeNull();
        expect(error).toHaveBeenCalledWith(
          expect.any(Object),
          "jackson accepted a SAML response without an assertion; refused it"
        );
      });
    });

    test("logs cheap-path refusals at most once per window, counting the rest", async () => {
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

    const VALID = { SAMLResponse: b64(ISSUER), RelayState: "s" };

    // Every way the callback refuses a response, and the code the login page shows for it.
    const REFUSALS: [string, Record<string, string> | null, () => unknown, SamlErrorCode][] = [
      ["a body that is not a form", null, () => undefined, "saml_response_rejected"],
      [
        "an empty SAMLResponse",
        { SAMLResponse: "", RelayState: "s" },
        () => undefined,
        "saml_response_rejected",
      ],
      [
        "markup over the budget",
        { SAMLResponse: b64(`<r>${"<a/>".repeat(SAML_RESPONSE_MARKUP_BUDGET)}</r>`), RelayState: "s" },
        () => undefined,
        "saml_response_rejected",
      ],
      [
        "a DOCTYPE",
        { SAMLResponse: b64('<!DOCTYPE r SYSTEM "x"><r/>'), RelayState: "s" },
        () => undefined,
        "saml_response_rejected",
      ],
      [
        "the per-IP limit",
        VALID,
        () => applyIPRateLimitMock.mockRejectedValueOnce(new TooManyRequestsError("Maximum reached.", 30)),
        "saml_unavailable",
      ],
      [
        "a full parse queue",
        VALID,
        () => probeMock.mockResolvedValueOnce({ outcome: "busy" }),
        "saml_unavailable",
      ],
      [
        "a failed parse worker",
        VALID,
        () => probeMock.mockResolvedValueOnce({ outcome: "failed" }),
        "saml_unavailable",
      ],
      [
        "a parse past the budget",
        VALID,
        () => probeMock.mockResolvedValueOnce({ outcome: "too_costly", reason: "time" }),
        "saml_response_rejected",
      ],
      [
        "a connection jackson cannot find",
        VALID,
        () => samlResponseMock.mockRejectedValueOnce(jacksonError("x", 403, "SAML connection not found.")),
        "saml_connection_unavailable",
      ],
      [
        "a response that names no issuer",
        VALID,
        () => samlResponseMock.mockRejectedValueOnce(jacksonError("x", 403, "Issuer not found.")),
        "saml_response_rejected",
      ],
      [
        "a RelayState jackson did not issue",
        VALID,
        () =>
          samlResponseMock.mockRejectedValueOnce(
            jacksonError("Unable to validate state from the origin request.", 403)
          ),
        "saml_response_rejected",
      ],
      [
        "a response that fails validation",
        VALID,
        () =>
          samlResponseMock.mockResolvedValueOnce({
            redirect_url: "https://app.example.com/cb?error=access_denied&error_description=Bad%20signature",
            error: "Bad signature",
          } as never),
        "saml_response_rejected",
      ],
      [
        "a decrypted assertion past the bounds, as jackson refuses one that does not decrypt",
        VALID,
        () => {
          probeMock.mockResolvedValueOnce({
            outcome: "refused_encrypted",
            issuer: "https://idp.example.com",
            cause: { reason: "depth", markup: 80, depth: 70, decryptedBytes: 4_000 },
          });
          samlResponseMock.mockRejectedValueOnce(
            jacksonError("Unable to validate state from the origin request.", 403)
          );
        },
        "saml_response_rejected",
      ],
      [
        "SAML not being licensed",
        VALID,
        () => jacksonMock.mockResolvedValueOnce(undefined as never),
        "saml_connection_unavailable",
      ],
      [
        "jackson's decryption key being unreadable",
        { ...VALID, RelayState: "boxyhq_jackson_s" },
        () => decryptionKeyMock.mockRejectedValueOnce(new Error("Certificate store not initialized")),
        "saml_unavailable",
      ],
    ];

    test.each(REFUSALS)(
      "is sent to the login page with a fixed code for %s",
      async (_name, fields, arrange, code) => {
        vi.spyOn(logger, "warn").mockImplementation(() => undefined);
        vi.spyOn(logger, "error").mockImplementation(() => undefined);
        arrange();
        const request = fields
          ? browserPost(fields, NAVIGATE)
          : new Request("http://localhost/api/auth/saml/callback", {
              method: "POST",
              headers: NAVIGATE,
              body: "{}",
            });

        const response = await POST(request);

        expect(response.status).toBe(303);
        const location = response.headers.get("location") ?? "";
        expect(location).toBe(buildLoginErrorUrl(WEBAPP_URL, code));
        expect(location.startsWith(`${WEBAPP_URL.replace(/\/+$/, "")}/auth/login?`)).toBe(true);
        expect(location).not.toMatch(/signature|connection not found/i);
      }
    );

    test.each([
      ["https://forms.example.com", "https://forms.example.com/auth/login?error=saml_unavailable"],
      [
        "https://example.com/custom-path",
        "https://example.com/custom-path/auth/login?error=saml_unavailable",
      ],
      [
        "https://example.com/custom-path/",
        "https://example.com/custom-path/auth/login?error=saml_unavailable",
      ],
    ])("keeps the base path of %s in the login URL", (webappUrl, expected) => {
      expect(buildLoginErrorUrl(webappUrl, "saml_unavailable")).toBe(expected);
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
