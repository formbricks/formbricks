import { parseIssuer } from "@boxyhq/saml20/dist/response.js";
import { describe, expect, test } from "vitest";
import { samlResponseWithoutAssertion } from "./saml-response-without-assertion";

const PROTOCOL_NS = "urn:oasis:names:tc:SAML:2.0:protocol";
const ASSERTION_NS = "urn:oasis:names:tc:SAML:2.0:assertion";
const decoded = (base64: string) => Buffer.from(base64, "base64").toString();

// ENG-6646: jackson judges this response in place of one refused once its assertion was opened. It reads nothing of
// a response but its issuer before it decrypts, so this one stands in exactly when that issuer reads back the same.
describe("samlResponseWithoutAssertion", () => {
  test.each([
    ["a plain entity ID", "<saml:Issuer>https://idp.example.com/saml</saml:Issuer>"],
    [
      "markup characters, a carriage return and non-ASCII",
      "<saml:Issuer>a &amp; b &lt;c&gt; &#13;&#10; d\tü 😀</saml:Issuer>",
    ],
    ["a CDATA section", "<saml:Issuer><![CDATA[x <y> & z]]></saml:Issuer>"],
    ["a comment and a child element", "<saml:Issuer>a<!-- c -->b<x>c</x>d</saml:Issuer>"],
    ["surrounding whitespace and a line break", "<saml:Issuer>  spaced \r\n x  </saml:Issuer>"],
    ["no namespace on the Issuer", "<Issuer>no-namespace</Issuer>"],
  ])("carries an issuer saml20 reads back exactly, from %s", (_name, issuerElement) => {
    const original = `<samlp:Response xmlns:samlp="${PROTOCOL_NS}" xmlns:saml="${ASSERTION_NS}">${issuerElement}</samlp:Response>`;
    const issuer = parseIssuer(original);
    expect(issuer).toBeTypeOf("string");

    expect(parseIssuer(decoded(samlResponseWithoutAssertion(issuer!)))).toBe(issuer);
  });

  test("carries no assertion, so jackson cannot accept it", () => {
    const xml = decoded(samlResponseWithoutAssertion("https://idp.example.com"));

    expect(xml).not.toMatch(/Assertion\b/);
    expect(xml).not.toMatch(/Signature\b/);
  });
});
