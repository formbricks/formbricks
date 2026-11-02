import saml20 from "@boxyhq/saml20";
import { DOMParser, MIME_TYPE } from "@xmldom/xmldom";
import { describe, expect, test, vi } from "vitest";
import { checkSamlResponseBounds } from "./saml-response-bounds";
import { createSpKeyPair } from "./tests/encrypted-saml-response";
import {
  SIGNED_RESPONSE_AUDIENCE,
  SIGNED_RESPONSE_ISSUER,
  createSignedSamlIdp,
} from "./tests/signed-saml-response";

// vitestSetup.ts stubs `createHash` for every test; the test IdP's digests need the real one.
vi.unmock("crypto");

// ENG-4045: on main, xml-crypto calls xmldom 0.9.12's `parseFromString` without the mime type it now requires, so
// every signature check throws before it reads the signature. Default it, so this test exercises the validation path
// the caps must leave alone. The fix for ENG-4045 pins xml-crypto to an xmldom that needs no default, and this patch
// then applies to a class xml-crypto no longer loads.
const parseFromString = DOMParser.prototype.parseFromString;
DOMParser.prototype.parseFromString = function (source: string, mimeType?: string) {
  return parseFromString.call(this, source, mimeType ?? MIME_TYPE.XML_APPLICATION);
};

const idp = createSignedSamlIdp();
const sp = createSpKeyPair();

describe("a real signed response (ENG-6648)", () => {
  test.each([
    ["a signed assertion", undefined],
    ["a signed assertion encrypted to the SP", sp.publicKey],
  ])("still validates with %s once the per-local-name caps are in place", async (_name, encryptFor) => {
    const response = idp.signedResponse({ groups: 150, encryptFor });
    expect(checkSamlResponseBounds(response)).toBeNull();

    const profile = await saml20.validate(Buffer.from(response, "base64").toString("utf8"), {
      publicKey: idp.certificate,
      privateKey: sp.privateKey,
      audience: SIGNED_RESPONSE_AUDIENCE,
    });

    expect(profile).toMatchObject({
      issuer: SIGNED_RESPONSE_ISSUER,
      audience: SIGNED_RESPONSE_AUDIENCE,
      claims: { email: "ada@example.com" },
    });
  });
});
