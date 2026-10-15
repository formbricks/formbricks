import { describe, expect, test } from "vitest";
import { SAML_RESPONSE_MARKUP_BUDGET, countSamlResponseMarkup } from "./saml-response-bounds";

const b64 = (xml: string) => Buffer.from(xml).toString("base64");
const count = (xml: string) => countSamlResponseMarkup(b64(xml));
const withinBudget = (xml: string) => count(xml) <= SAML_RESPONSE_MARKUP_BUDGET;

const RESPONSE_HEAD =
  '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion">';
const RESPONSE_TAIL = "<saml2:Issuer>https://idp.example.com</saml2:Issuer></samlp:Response>";

const groups = (name: string, value: string, times: number) =>
  RESPONSE_HEAD +
  `<saml2:Assertion><saml2:AttributeStatement><saml2:Attribute Name="${name}">` +
  value.repeat(times) +
  "</saml2:Attribute></saml2:AttributeStatement></saml2:Assertion>" +
  RESPONSE_TAIL;

/** Group values written the way Okta writes them: two namespace declarations and a type on every value. */
const verboseGroups = (times: number) =>
  groups(
    "groups",
    '<saml2:AttributeValue xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="xs:string">Engineering-Team-Group-01</saml2:AttributeValue>',
    times
  );

/** Group values written as AD distinguished names: five `=` of text per group, and no attributes. */
const distinguishedNameGroups = (times: number) =>
  groups("memberOf", "<saml2:AttributeValue>CN=G1,OU=Grp,DC=corp,DC=ex,DC=com</saml2:AttributeValue>", times);

/** The densest honest shape: the shortest group names an IdP could send. */
const tinyGroups = (times: number) =>
  groups("groups", "<saml2:AttributeValue>g</saml2:AttributeValue>", times);

/** The /api/auth body limit, as base64 characters: what a response has to fit in to reach the parser. */
const BODY_LIMIT = 256 * 1024;

describe("countSamlResponseMarkup", () => {
  test("counts every tag and every attribute", () => {
    // 3 tags (<r, <a, </r) and 2 attributes.
    expect(count('<r><a x="1" y="2"/></r>')).toBe(5);
  });

  test("never counts text, however many = it holds", () => {
    expect(count("<v>CN=G1,OU=Grp,DC=corp,DC=ex,DC=com</v>")).toBe(2);
    expect(count("just text")).toBe(0);
    expect(countSamlResponseMarkup("")).toBe(0);
  });

  test("counts attributes with no value and attributes with no space between them", () => {
    // xmldom builds a node for each, warning rather than refusing.
    expect(count("<a b c d/>")).toBe(4);
    expect(count('<a b=""c=""d=""/>')).toBe(4);
  });

  test("separates attributes on any control byte, as xmldom does", () => {
    // Form feed, vertical tab and NUL separate attributes for xmldom; each becomes an attribute node.
    expect(count("<a\fb\vc\u0000d/>")).toBe(4);
  });

  test("weighs a < that cannot start an element far above an element", () => {
    // xmldom raises and recovers from an error for each of these, which costs far more than an element.
    expect(count("<r>< </r>")).toBe(18);
    expect(count("<r><0</r>")).toBe(18);
    // A leading `:` and a non-ASCII byte are not cheap starts either.
    expect(count("<r><:a/></r>")).toBe(18);
    expect(
      countSamlResponseMarkup(
        Buffer.from([0x3c, 0x72, 0x3e, 0x3c, 0xff, 0x30, 0x3c, 0x2f, 0x72, 0x3e]).toString("base64")
      )
    ).toBe(18);
    // A closing tag, comment or processing instruction is still one.
    expect(count("<r></r><!---->")).toBe(3);
  });

  test("reads a quoted value whole, so a > or = inside it is not markup", () => {
    expect(count('<a href="x?y=1&gt;2" title=">">t</a>')).toBe(4);
  });

  test("counts every < inside a comment, CDATA section or processing instruction", () => {
    // Over-counting these rarities is the safe direction; skipping them is how markup gets hidden.
    expect(count("<!-- <x/><y/> --><r/>")).toBe(4);
    expect(count("<r><![CDATA[<d/>]]></r>")).toBe(4);
    expect(count('<?xml version="1.0"?><r/>')).toBe(2);
  });

  test("does not throw on input that is not base64", () => {
    // Buffer's decoder skips what it cannot read, exactly as jackson's does; jackson then rejects it as before.
    expect(() => countSamlResponseMarkup("%%% not base64 %%%")).not.toThrow();
  });
});

describe("the budget", () => {
  test.each([
    ["1,000 verbose Okta-style groups", verboseGroups(1000)],
    ["2,300 AD distinguished-name groups", distinguishedNameGroups(2300)],
    ["the most minimal group names that fit", tinyGroups(Math.floor((BODY_LIMIT * 0.75) / 49))],
  ])("lets through %s, which fill the body limit", (_name, xml) => {
    expect(b64(xml).length).toBeGreaterThan(200 * 1024);
    // Leave room for the multipart boundary, field names and RelayState that share the body limit.
    expect(b64(xml).length).toBeLessThanOrEqual(BODY_LIMIT - 1024);
    expect(withinBudget(xml)).toBe(true);
  });

  test("allows exactly the budget and refuses one node more", () => {
    const fixed = count(RESPONSE_HEAD + RESPONSE_TAIL);
    const atBudget = RESPONSE_HEAD + "<a/>".repeat(SAML_RESPONSE_MARKUP_BUDGET - fixed) + RESPONSE_TAIL;
    const overBudget = RESPONSE_HEAD + "<a/>".repeat(SAML_RESPONSE_MARKUP_BUDGET - fixed + 1) + RESPONSE_TAIL;

    expect(count(atBudget)).toBe(SAML_RESPONSE_MARKUP_BUDGET);
    expect(withinBudget(atBudget)).toBe(true);
    expect(withinBudget(overBudget)).toBe(false);
  });

  test("refuses attributes separated by form feeds", () => {
    const attributes = Array.from({ length: SAML_RESPONSE_MARKUP_BUDGET }, (_, i) => `a${i}`).join("\f");

    expect(withinBudget(`<r\f${attributes}></r>`)).toBe(false);
  });

  test("refuses a flood of attributes on a single element", () => {
    const attributes = Array.from({ length: SAML_RESPONSE_MARKUP_BUDGET }, (_, i) => `a${i}=""`).join(" ");

    expect(withinBudget(`<r><a ${attributes}/></r>`)).toBe(false);
  });

  // Malformed XML that xmldom still parses into every element it contains, recovering from each error. A count
  // that followed XML structure saw almost none of these; each one reached the parser at under 10 counted nodes.
  test.each([
    ["a quoted value that never closes", '<r><b a="' + "<a/>".repeat(SAML_RESPONSE_MARKUP_BUDGET)],
    [
      "a stray quote after a valueless attribute",
      '<r><b a "' + "<a b c/>".repeat(SAML_RESPONSE_MARKUP_BUDGET / 2) + '"/></r>',
    ],
    [
      "a tag that never closes, then a flood of <0",
      "<r>" + "<0".repeat(SAML_RESPONSE_MARKUP_BUDGET) + "</r>",
    ],
  ])("refuses %s", (_name, xml) => {
    expect(withinBudget(xml)).toBe(false);
  });
});
