import { createRequire } from "node:module";
import { describe, expect, test, vi } from "vitest";
import { dropInsecureAlgorithmWarnings, parseSamlResponse } from "./saml-parse-worker";
import { SAML_RESPONSE_MARKUP_BUDGET, SAML_RESPONSE_MAX_DEPTH } from "./saml-response-bounds";
import {
  ENCRYPTED_RESPONSE_ISSUER,
  createSpKeyPair,
  encryptAssertion,
  flatAssertion,
  nestedNamespaceAssertion,
  samlResponseWith,
  signedAssertionWithGroups,
} from "./tests/encrypted-saml-response";

// The worker's job in this thread, so each outcome is checked directly and without timing; saml-parse-budget.test.ts
// runs it as a real worker against the time budget.

const CLAIMS = { issuer: ENCRYPTED_RESPONSE_ISSUER, id: "_resp1", inResponseTo: "_req1" };
const sp = createSpKeyPair();
const assertion = signedAssertionWithGroups(150);
const encryptedWith = (plaintext: string, publicKey = sp.publicKey) =>
  samlResponseWith(encryptAssertion(plaintext, publicKey));
const encrypted = encryptedWith(assertion);

describe("parseSamlResponse", () => {
  test("decrypts a signed assertion of 150 groups as jackson will, and it passes the bounds", () => {
    expect(parseSamlResponse(encrypted, sp.privateKey)).toEqual({
      claims: CLAIMS,
      decryption: { decrypted: true, refusal: null },
    });
  });

  test.each([
    [
      "more markup than the budget",
      flatAssertion(SAML_RESPONSE_MARKUP_BUDGET + 1_000),
      { reason: "markup", markup: expect.any(Number), depth: expect.any(Number) },
    ],
    [
      "nesting past the depth cap",
      nestedNamespaceAssertion(SAML_RESPONSE_MAX_DEPTH + 10),
      { reason: "depth", markup: expect.any(Number), depth: expect.any(Number) },
    ],
  ])("refuses a decrypted assertion carrying %s, with its sizes only", (_name, plaintext, refusal) => {
    const { decryption } = parseSamlResponse(encryptedWith(plaintext), sp.privateKey);

    expect(decryption).toEqual({
      decrypted: true,
      refusal: { ...refusal, decryptedBytes: expect.any(Number) },
    });
  });

  test.each([
    ["without a key", encrypted, null],
    ["encrypted to another key", encrypted, createSpKeyPair().privateKey],
    // saml20 parses the plaintext strictly and gives up on a DOCTYPE, as jackson will.
    ["holding a DOCTYPE", encryptedWith(`<!DOCTYPE r SYSTEM "x">${assertion}`), sp.privateKey],
  ])("reports an encrypted assertion it cannot decrypt (%s), keeping the claims", (_name, xml, key) => {
    expect(parseSamlResponse(xml, key)).toEqual({ claims: CLAIMS, decryption: { decrypted: false } });
  });

  test.each([
    ["with no encrypted assertion", samlResponseWith(assertion)],
    // saml20 only decrypts an EncryptedAssertion directly under a root whose name contains "Response".
    ["when the root is not a Response", encrypted.replaceAll("saml2p:Response", "saml2p:Other")],
  ])("has nothing to decrypt %s", (_name, xml) => {
    expect(parseSamlResponse(xml, sp.privateKey).decryption).toBeUndefined();
  });

  test("decrypts with the saml20 release jackson validates with", () => {
    // The worker times saml20's `decryptXml` as jackson's stand-in, so they must be the same release: bump the
    // direct dependency in apps/web/package.json whenever a jackson upgrade moves its saml20.
    const require = createRequire(import.meta.url);
    const jacksonManifest = require("@boxyhq/saml-jackson/package.json") as {
      dependencies: Record<string, string>;
    };

    expect(require("@boxyhq/saml20/package.json").version).toBe(
      jacksonManifest.dependencies["@boxyhq/saml20"]
    );
  });

  test("returns no claims for a document without a root", () => {
    expect(parseSamlResponse("", sp.privateKey)).toEqual({ claims: {} });
  });
});

describe("dropInsecureAlgorithmWarnings", () => {
  test("drops xml-encryption's insecure-algorithm warning and passes every other warning on", () => {
    const warn = vi.fn();
    const filtered = dropInsecureAlgorithmWarnings(warn);

    filtered(
      "http://www.w3.org/2001/04/xmlenc#rsa-1_5 is no longer recommended due to security reasons. Please deprecate its use as soon as possible."
    );
    filtered("[xmldom warning]\tsomething else", 1);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[xmldom warning]\tsomething else", 1);
  });
});
