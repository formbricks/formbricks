import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";
import { parseSamlResponse } from "./saml-parse-worker";
import {
  ENCRYPTED_RESPONSE_ISSUER,
  createSpKeyPair,
  encryptAssertion,
  samlResponseWith,
  signedAssertionWithGroups,
} from "./tests/encrypted-saml-response";

// The worker's job in this thread, so each outcome is checked directly; saml-parse-budget.test.ts runs it as a real
// worker against the time budget.

const CLAIMS = { issuer: ENCRYPTED_RESPONSE_ISSUER, id: "_resp1", inResponseTo: "_req1" };
const sp = createSpKeyPair();
const assertion = signedAssertionWithGroups(150);
const encrypted = samlResponseWith(encryptAssertion(assertion, sp.publicKey));

describe("parseSamlResponse", () => {
  test("decrypts a signed assertion of 150 groups as jackson will, returning the document jackson validates", () => {
    const { claims, decryptedXml } = parseSamlResponse(encrypted, sp.privateKey);

    expect(claims).toEqual(CLAIMS);
    expect(decryptedXml).toContain('<saml2:Assertion xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion"');
    expect(decryptedXml).toContain("CN=Group 149 Engineering");
    expect(decryptedXml).not.toContain("EncryptedAssertion");
  });

  test.each([
    ["without a key", encrypted, undefined],
    ["with no encrypted assertion", samlResponseWith(assertion), sp.privateKey],
    // saml20 only decrypts an EncryptedAssertion directly under a root whose name contains "Response".
    [
      "when the root is not a Response",
      encrypted.replaceAll("saml2p:Response", "saml2p:Other"),
      sp.privateKey,
    ],
  ])("decrypts nothing %s", (_name, xml, key) => {
    expect(parseSamlResponse(xml, key).decryptedXml).toBeUndefined();
  });

  test("keeps the claims when the assertion was encrypted to another key", () => {
    expect(parseSamlResponse(encrypted, createSpKeyPair().privateKey)).toEqual({ claims: CLAIMS });
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
