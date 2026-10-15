import { describe, expect, test } from "vitest";
import {
  SAML_RESPONSE_MARKUP_BUDGET,
  countSamlResponseMarkup,
  isSamlResponseWithinBudget,
} from "./saml-response-bounds";

const b64 = (xml: string) => Buffer.from(xml).toString("base64");

const RESPONSE_HEAD =
  '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion">';
const RESPONSE_TAIL = "<saml2:Issuer>https://idp.example.com</saml2:Issuer></samlp:Response>";

/** A group attribute written the way Okta writes it: two namespace declarations and a type on every value. */
const verboseGroups = (count: number) =>
  RESPONSE_HEAD +
  '<saml2:Assertion><saml2:AttributeStatement><saml2:Attribute Name="groups">' +
  '<saml2:AttributeValue xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="xs:string">Engineering-Team-Group-01</saml2:AttributeValue>'.repeat(
    count
  ) +
  "</saml2:Attribute></saml2:AttributeStatement></saml2:Assertion>" +
  RESPONSE_TAIL;

describe("countSamlResponseMarkup", () => {
  test("counts every tag and every attribute in the decoded XML", () => {
    // 3 tags (<r, <a, </r) and 2 attributes.
    expect(countSamlResponseMarkup(b64('<r><a x="1" y="2"/></r>'))).toBe(5);
  });

  test("counts nothing in plain text and treats an empty response as empty", () => {
    expect(countSamlResponseMarkup(b64("just text"))).toBe(0);
    expect(countSamlResponseMarkup("")).toBe(0);
  });

  test("does not throw on input that is not base64", () => {
    // Buffer's base64 decoder skips what it cannot read; jackson then rejects the response as before.
    expect(() => countSamlResponseMarkup("%%% not base64 %%%")).not.toThrow();
  });
});

describe("isSamlResponseWithinBudget", () => {
  test("lets through a real response with 1,000 verbosely written groups", () => {
    const response = b64(verboseGroups(1000));

    // That response already fills the 256 KiB /api/auth body limit, so nothing legitimate that fits gets near
    // the budget.
    expect(response.length).toBeGreaterThan(200 * 1024);
    expect(countSamlResponseMarkup(response)).toBeLessThan(SAML_RESPONSE_MARKUP_BUDGET / 2);
    expect(isSamlResponseWithinBudget(response)).toBe(true);
  });

  test("allows exactly the budget and refuses one node more", () => {
    // Each <a/> is one '<'; the head, tail and namespaces add their own, so pad up to the budget precisely.
    const fixed = countSamlResponseMarkup(b64(RESPONSE_HEAD + RESPONSE_TAIL));
    const atBudget = RESPONSE_HEAD + "<a/>".repeat(SAML_RESPONSE_MARKUP_BUDGET - fixed) + RESPONSE_TAIL;
    const overBudget = RESPONSE_HEAD + "<a/>".repeat(SAML_RESPONSE_MARKUP_BUDGET - fixed + 1) + RESPONSE_TAIL;

    expect(countSamlResponseMarkup(b64(atBudget))).toBe(SAML_RESPONSE_MARKUP_BUDGET);
    expect(isSamlResponseWithinBudget(b64(atBudget))).toBe(true);
    expect(isSamlResponseWithinBudget(b64(overBudget))).toBe(false);
  });

  test("refuses a flood of attributes on a single element", () => {
    // One tag, many attributes: a '<'-only count would let this through.
    const attributes = Array.from({ length: SAML_RESPONSE_MARKUP_BUDGET }, (_, i) => `a${i}=""`).join(" ");

    expect(isSamlResponseWithinBudget(b64(`${RESPONSE_HEAD}<a ${attributes}/>${RESPONSE_TAIL}`))).toBe(false);
  });
});
