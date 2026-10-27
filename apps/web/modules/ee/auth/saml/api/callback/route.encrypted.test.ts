import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import {
  SAML_RESPONSE_MAX_ELEMENTS,
  checkSamlResponseBounds,
} from "@/modules/ee/auth/saml/lib/saml-response-bounds";
import { samlResponseWithoutAssertion } from "@/modules/ee/auth/saml/lib/saml-response-without-assertion";
import {
  ENCRYPTED_RESPONSE_ISSUER,
  assertionWithSignatures,
  createSpKeyPair,
  encryptAssertion,
  flatAssertion,
  nestedNamespaceAssertion,
  samlResponseWith,
  signedAssertionWithGroups,
} from "@/modules/ee/auth/saml/lib/tests/encrypted-saml-response";
import { POST } from "./route";

// The route with its real bounds and its real parse worker (ENG-4051); only jackson, the rate limiter and Next's
// redirect are stood in for, so this proves which responses reach jackson. jackson accepting a real encrypted
// assertion is covered by ../sp-initiated-sign-in.test.ts, which runs it with a configured connection.

const sp = createSpKeyPair();

const { samlResponseMock } = vi.hoisted(() => ({
  samlResponseMock: vi.fn(async (_body: { RelayState: string; SAMLResponse: string }) => ({
    redirect_url: "https://app.example.com/api/auth/saml/authorize?code=c",
  })),
}));

vi.mock("@/modules/ee/auth/saml/lib/jackson", () => ({
  default: vi.fn(async () => ({
    oauthController: { samlResponse: samlResponseMock },
    getDecryptionKey: async () => sp.privateKey,
    // No connection: the worker skips the signature check, which these tests do not measure.
    idpVerification: null,
  })),
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyIPRateLimit: vi.fn(async () => ({ allowed: true })),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => new Response(null, { status: 307, headers: { location: url } })),
}));

const encryptedResponse = (assertion: string) =>
  Buffer.from(samlResponseWith(encryptAssertion(assertion, sp.publicKey))).toString("base64");

const callback = (SAMLResponse: string) =>
  new Request("http://localhost/api/auth/saml/callback", {
    method: "POST",
    body: new URLSearchParams({ SAMLResponse, RelayState: "boxyhq_jackson_state" }),
  });

describe("SAML callback with an encrypted assertion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ENG-6646: refused once decrypted, each is answered by jackson for the response without its assertion, which is
  // its answer to an assertion that does not decrypt. The decrypted plaintext never reaches jackson.
  test.each([
    [
      "its plaintext is too costly to parse",
      nestedNamespaceAssertion(4000),
      [
        expect.objectContaining({ stage: "parse_budget", reason: "time", decrypting: true }),
        "Refused a SAML response that was too costly to parse",
      ],
    ],
    [
      "its decrypted document carries more markup than the bounds allow",
      flatAssertion(13_000),
      // The markup bound refuses it, or on a loaded machine the time budget gets there first.
      [
        expect.objectContaining({ reason: expect.stringMatching(/^(markup|time)$/) }),
        expect.stringMatching(
          /^Refused a SAML response (whose decrypted assertion is past the bounds|that was too costly)/
        ),
      ],
    ],
    [
      "its decrypted document carries more Signature elements than the cap",
      assertionWithSignatures(SAML_RESPONSE_MAX_ELEMENTS.Signature + 1),
      [
        expect.objectContaining({
          reason: "elements",
          localName: "Signature",
          count: SAML_RESPONSE_MAX_ELEMENTS.Signature + 1,
        }),
        "Refused a SAML response whose decrypted assertion is past the bounds",
      ],
    ],
  ])(
    "leaves one refused because %s for jackson to answer, without its assertion",
    async (_name, assertion, logged) => {
      const SAMLResponse = encryptedResponse(assertion);
      // The bounds see only the ciphertext.
      expect(checkSamlResponseBounds(SAMLResponse)).toBeNull();
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
      samlResponseMock.mockRejectedValueOnce(
        Object.assign(new Error("Unable to validate state from the origin request."), { statusCode: 403 })
      );

      const response = await POST(callback(SAMLResponse));

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        code: "forbidden",
        message: "The SAML response was not accepted",
        details: {},
      });
      expect(samlResponseMock).toHaveBeenCalledExactlyOnceWith({
        RelayState: "boxyhq_jackson_state",
        SAMLResponse: samlResponseWithoutAssertion(ENCRYPTED_RESPONSE_ISSUER),
      });
      expect(warn).toHaveBeenCalledWith(...logged);
    }
  );

  test("hands one encrypted to another key to jackson like any other, so its answer never says whether it decrypted", async () => {
    const SAMLResponse = Buffer.from(
      samlResponseWith(encryptAssertion(signedAssertionWithGroups(150), createSpKeyPair().publicKey))
    ).toString("base64");

    const response = await POST(callback(SAMLResponse));

    expect(response.status).toBe(307);
    expect(samlResponseMock).toHaveBeenCalledWith({ RelayState: "boxyhq_jackson_state", SAMLResponse });
  });

  test("leaves one jackson would not decrypt (no RelayState of its own) undecrypted, for jackson to refuse", async () => {
    // A plaintext that would blow the budget if decrypted: the worker does not decrypt it, so it parses quickly.
    const SAMLResponse = encryptedResponse(nestedNamespaceAssertion(4000));

    const response = await POST(
      new Request("http://localhost/api/auth/saml/callback", {
        method: "POST",
        body: new URLSearchParams({ SAMLResponse, RelayState: "" }),
      })
    );

    expect(response.status).toBe(307);
    expect(samlResponseMock).toHaveBeenCalledWith({ RelayState: "", SAMLResponse });
  });

  test("hands a signed one of 150 groups to jackson", async () => {
    const SAMLResponse = encryptedResponse(signedAssertionWithGroups(150));

    const response = await POST(callback(SAMLResponse));

    expect(response.status).toBe(307);
    expect(samlResponseMock).toHaveBeenCalledWith({ RelayState: "boxyhq_jackson_state", SAMLResponse });
  });
});
