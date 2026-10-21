import { beforeEach, describe, expect, test, vi } from "vitest";
import { parseSamlResponse } from "./saml-parse-worker";
import {
  ENCRYPTED_RESPONSE_ISSUER,
  createSpKeyPair,
  encryptAssertion,
  samlResponseWith,
  signedAssertionWithGroups,
} from "./tests/encrypted-saml-response";

// The worker's job in this thread, so each decision is checked directly; saml-parse-budget.test.ts runs it as a
// real worker against the time budget. jackson's `decryptXml` is real here too, only watched.
const { decryptXmlSpy } = vi.hoisted(() => ({ decryptXmlSpy: vi.fn() }));
vi.mock("@boxyhq/saml20/dist/decrypt.js", () => ({ decryptXml: decryptXmlSpy }));

const CLAIMS = { issuer: ENCRYPTED_RESPONSE_ISSUER, id: "_resp1", inResponseTo: "_req1" };
const sp = createSpKeyPair();
const encrypted = samlResponseWith(encryptAssertion(signedAssertionWithGroups(3), sp.publicKey));

describe("parseSamlResponse", () => {
  beforeEach(async () => {
    const original = await vi.importActual<typeof import("@boxyhq/saml20/dist/decrypt.js")>(
      "@boxyhq/saml20/dist/decrypt.js"
    );
    decryptXmlSpy.mockReset().mockImplementation(original.decryptXml);
  });

  test("decrypts an encrypted assertion with the key, as jackson will, and reads the response's claims", () => {
    expect(parseSamlResponse(encrypted, sp.privateKey)).toEqual(CLAIMS);
    expect(decryptXmlSpy).toHaveBeenCalledWith(encrypted, { privateKey: sp.privateKey });
    expect(decryptXmlSpy.mock.results[0]).toMatchObject({ type: "return", value: { decrypted: true } });
  });

  test.each([
    ["without a key", encrypted, undefined],
    ["with no encrypted assertion", samlResponseWith(signedAssertionWithGroups(3)), sp.privateKey],
    // saml20 only decrypts an EncryptedAssertion directly under a root whose name contains "Response".
    [
      "when the root is not a Response",
      encrypted.replaceAll("saml2p:Response", "saml2p:Other"),
      sp.privateKey,
    ],
  ])("does not decrypt %s", (_name, xml, key) => {
    parseSamlResponse(xml, key);

    expect(decryptXmlSpy).not.toHaveBeenCalled();
  });

  test("keeps the claims when the assertion was encrypted to another key", () => {
    expect(parseSamlResponse(encrypted, createSpKeyPair().privateKey)).toEqual(CLAIMS);
    expect(decryptXmlSpy.mock.results[0]).toMatchObject({ type: "throw" });
  });

  test("returns no claims for a document without a root", () => {
    expect(parseSamlResponse("", sp.privateKey)).toEqual({});
  });
});
