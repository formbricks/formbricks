import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { checkSamlResponseBounds } from "@/modules/ee/auth/saml/lib/saml-response-bounds";
import {
  createSpKeyPair,
  encryptAssertion,
  flatAssertion,
  nestedNamespaceAssertion,
  samlResponseWith,
  signedAssertionWithGroups,
} from "@/modules/ee/auth/saml/lib/tests/encrypted-saml-response";
import { POST } from "./route";

// The route with its real bounds and its real parse worker (ENG-4051); only jackson, the rate limiter and Next's
// redirect are stood in for. jackson's own validation cannot run here: it needs a configured connection and, for
// signed responses, ENG-4045's fix. What this proves is which responses reach it.

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

  test("refuses one whose plaintext is too costly to parse before jackson decrypts it", async () => {
    const SAMLResponse = encryptedResponse(nestedNamespaceAssertion(4000));
    // Past the byte bounds: they see only the ciphertext.
    expect(checkSamlResponseBounds(SAMLResponse)).toBeNull();
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    const response = await POST(callback(SAMLResponse));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ message: "SAMLResponse is too costly to process" });
    expect(samlResponseMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "parse_budget", reason: "time" }),
      "Refused a SAML response that was too costly to parse"
    );
  });

  test("refuses one whose decrypted document carries more markup than the bounds allow", async () => {
    const SAMLResponse = encryptedResponse(flatAssertion(13_000));
    expect(checkSamlResponseBounds(SAMLResponse)).toBeNull();
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    const response = await POST(callback(SAMLResponse));

    expect(response.status).toBe(400);
    expect(samlResponseMock).not.toHaveBeenCalled();
    // The markup bound refuses it, or on a loaded machine the time budget gets there first; either way before jackson.
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringMatching(/^(markup|time)$/) }),
      expect.stringMatching(
        /^Refused a SAML response (whose decrypted assertion is past the bounds|that was too costly)/
      )
    );
  });

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
