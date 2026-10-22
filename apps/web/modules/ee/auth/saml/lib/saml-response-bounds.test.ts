import { describe, expect, test } from "vitest";
import {
  SAML_RESPONSE_MARKUP_BUDGET,
  SAML_RESPONSE_MAX_DEPTH,
  SAML_RESPONSE_MAX_LENGTH,
  checkSamlResponseBounds,
  measureSamlResponseMarkup,
} from "./saml-response-bounds";

const b64 = (xml: string) => Buffer.from(xml).toString("base64");
const count = (xml: string) => measureSamlResponseMarkup(b64(xml)).markup;
const depth = (xml: string) => measureSamlResponseMarkup(b64(xml)).depth;
const withinBudget = (xml: string) => checkSamlResponseBounds(b64(xml)) === null;

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

/** What a response has to fit in to reach the parser, as base64 characters. */
const BODY_LIMIT = SAML_RESPONSE_MAX_LENGTH;

describe("measureSamlResponseMarkup", () => {
  test("counts every tag and every attribute", () => {
    // 3 tags (<r, <a, </r) and 2 attributes.
    expect(count('<r><a x="1" y="2"/></r>')).toBe(5);
  });

  test("never counts text, however many = it holds", () => {
    expect(count("<v>CN=G1,OU=Grp,DC=corp,DC=ex,DC=com</v>")).toBe(2);
    expect(count("just text")).toBe(0);
    expect(measureSamlResponseMarkup("").markup).toBe(0);
  });

  test("counts attributes with no value and attributes with no space between them", () => {
    // xmldom builds a node for each, warning rather than refusing.
    expect(count("<a b c d/>")).toBe(4);
    expect(count('<a b=""c=""d=""/>')).toBe(4);
  });

  test("separates attributes on any control byte, as xmldom does", () => {
    // Form feed, vertical tab and NUL separate attributes for xmldom; each becomes an attribute node.
    expect(count("<a\fb\vc\u0000d/>")).toBe(4);
    // U+0080 (C2 80) too: xmldom reads it as a space, so each name after it is another attribute.
    expect(count("<a\u0080b\u0080c/>")).toBe(3);
  });

  test("weighs a < that cannot start an element far above an element", () => {
    // xmldom raises and recovers from an error for each of these, which costs far more than an element.
    expect(count("<r>< </r>")).toBe(18);
    expect(count("<r><0</r>")).toBe(18);
    // A leading `:` and a non-ASCII start are not cheap either. `×` decodes to a character that cannot start a
    // name, so xmldom raises and recovers for each one; a rule that let valid UTF-8 through would miss it.
    expect(count("<r><:a/></r>")).toBe(18);
    expect(count("<r><\u00d7/></r>")).toBe(18);
    expect(
      measureSamlResponseMarkup(
        Buffer.from([0x3c, 0x72, 0x3e, 0x3c, 0xff, 0x30, 0x3c, 0x2f, 0x72, 0x3e]).toString("base64")
      ).markup
    ).toBe(18);
    // A closing tag, comment or processing instruction is still one.
    expect(count("<r></r><!---->")).toBe(3);
  });

  test("reads a quoted value whole, so a > or = inside it is not markup", () => {
    expect(count('<a href="x?y=1&gt;2" title=">">t</a>')).toBe(4);
  });

  test("keeps counting attributes after a quote that never closes", () => {
    expect(count("<a ' b c d/>")).toBe(4);
    expect(count('<a e="1 b c d/>')).toBe(5);
    // A matching quote in a later tag does not end the value early: the scan stops at the next <.
    expect(count("<b ' a1 a2 a3><c '/>")).toBe(5);
  });

  test("tracks how deep elements nest, as xmldom closes them", () => {
    expect(depth("<r><a><b/></a><c></c></r>")).toBe(2);
    // Only `/>` closes a tag, with or without attributes or a quoted value before it.
    expect(depth('<r><a x="1"/><b y="/"/></r>')).toBe(1);
    expect(depth("<r/><r/>")).toBe(0);
    // Prologue, comments and processing instructions open nothing.
    expect(depth('<?xml version="1.0"?><!-- c --><r/>')).toBe(0);
  });

  test("takes a tag it cannot read to its end as open, never as closed", () => {
    // xmldom stops at a quote that never closes, so this only ever over-counts the depth.
    expect(depth("<r><a '/><b '/>")).toBe(3);
    // A tag with no > before the next < is open too.
    expect(depth("<r><a<b/>")).toBe(2);
    // Only a strictly written self-closing tag closes: unquoted values, a space before />, or a stray quote do not.
    expect(depth('<r><a b=c/><a b /><a b="c"/ ></r>')).toBe(4);
  });

  test("ends a comment only after its whole opener, as xmldom does", () => {
    expect(depth("<r><a><!--></a>--></r>")).toBe(2);
    expect(depth("<r><a><!---></a>--></r>")).toBe(2);
    expect(depth("<r><a><![CDATA[]]></a>]]></r>")).toBe(2);
  });

  test("stops at a DOCTYPE or any other declaration and reports it", () => {
    for (const declaration of ['<!DOCTYPE r SYSTEM "x">', '<!ENTITY e "x">', "<![IGNORE[", "<!x>"]) {
      expect(measureSamlResponseMarkup(b64(declaration + "<r/>")).declaration).toBe(true);
    }
    expect(
      measureSamlResponseMarkup(b64('<?xml version="1.0"?><!-- c --><r><![CDATA[x]]></r>')).declaration
    ).toBe(false);
  });

  test("moves the depth for nothing inside comments, CDATA sections or processing instructions", () => {
    expect(depth("<r><!-- <a><b><c> --></r>")).toBe(1);
    expect(depth("<r><![CDATA[<a><b>]]></r>")).toBe(1);
    expect(depth("<?pi <a><b>?><r/>")).toBe(0);
    // Every < inside them still counts toward the markup.
    expect(count("<r><!-- <a><b> --></r>")).toBe(5);
  });

  test("does not let a stray or unmatched </ take the depth below zero", () => {
    expect(depth("</x></x><r><a></a></r>")).toBe(2);
  });

  test("stops reading once a bound is passed", () => {
    const flood = "<a/>".repeat(SAML_RESPONSE_MARKUP_BUDGET * 10);
    expect(count(flood)).toBe(SAML_RESPONSE_MARKUP_BUDGET + 1);
    expect(depth("<a>".repeat(SAML_RESPONSE_MAX_DEPTH * 10))).toBe(SAML_RESPONSE_MAX_DEPTH + 1);
  });

  test("counts every < inside a comment, CDATA section or processing instruction", () => {
    // Over-counting these rarities is the safe direction; skipping them is how markup gets hidden.
    expect(count("<!-- <x/><y/> --><r/>")).toBe(4);
    expect(count("<r><![CDATA[<d/>]]></r>")).toBe(4);
    expect(count('<?xml version="1.0"?><r/>')).toBe(2);
  });

  test("does not throw on input that is not base64", () => {
    // Buffer's decoder skips what it cannot read, exactly as jackson's does; jackson then rejects it as before.
    expect(() => measureSamlResponseMarkup("%%% not base64 %%%")).not.toThrow();
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

  test("refuses attributes hidden behind a quote that never closes", () => {
    const attributes = Array.from({ length: SAML_RESPONSE_MARKUP_BUDGET }, (_, i) => `a${i}`).join(" ");

    expect(withinBudget(`<r><b ' ${attributes}/></r>`)).toBe(false);
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
  test("refuses attributes separated by U+0080", () => {
    const attributes = Array.from({ length: SAML_RESPONSE_MARKUP_BUDGET }, (_, i) => `a${i}`).join("\u0080");

    expect(withinBudget(`<r\u0080${attributes}></r>`)).toBe(false);
  });
});

/** A signed response and an encrypted assertion as ADFS writes them: the deepest shapes a real IdP sends. */
const SIGNATURE = `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/><ds:Reference URI="#_abc"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"><ec:InclusiveNamespaces xmlns:ec="http://www.w3.org/2001/10/xml-exc-c14n#" PrefixList="xs"/></ds:Transform></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><ds:DigestValue>abc=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>
abc=</ds:SignatureValue><KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><ds:X509Data><ds:X509Certificate>MIIC</ds:X509Certificate></ds:X509Data></KeyInfo></ds:Signature>`;
const ENCRYPTED_ASSERTION = `<EncryptedAssertion><xenc:EncryptedData Type="http://www.w3.org/2001/04/xmlenc#Element" xmlns:xenc="http://www.w3.org/2001/04/xmlenc#"><xenc:EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes256-cbc" /><KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><e:EncryptedKey xmlns:e="http://www.w3.org/2001/04/xmlenc#"><e:EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#rsa-oaep-mgf1p"><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1" /></e:EncryptionMethod><KeyInfo><ds:X509Data xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:X509IssuerSerial><ds:X509IssuerName>CN=x</ds:X509IssuerName><ds:X509SerialNumber>1</ds:X509SerialNumber></ds:X509IssuerSerial></ds:X509Data></KeyInfo><e:CipherData><e:CipherValue>abc</e:CipherValue></e:CipherData></e:EncryptedKey></KeyInfo><xenc:CipherData><xenc:CipherValue>abc</xenc:CipherValue></xenc:CipherData></xenc:EncryptedData></EncryptedAssertion>`;
const SIGNED_ASSERTION = `<Assertion ID="_abc" IssueInstant="2026-01-01T00:00:00Z" Version="2.0" xmlns="urn:oasis:names:tc:SAML:2.0:assertion"><Issuer>http://adfs/</Issuer>${SIGNATURE}<Subject><NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">a@b</NameID><SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><SubjectConfirmationData InResponseTo="_x" NotOnOrAfter="2026" Recipient="https://x/api/auth/saml/callback" /></SubjectConfirmation></Subject><Conditions NotBefore="a" NotOnOrAfter="b"><AudienceRestriction><Audience>https://saml.formbricks.com</Audience></AudienceRestriction></Conditions><AttributeStatement><Attribute Name="email"><AttributeValue>a@b</AttributeValue></Attribute></AttributeStatement><AuthnStatement AuthnInstant="x" SessionIndex="_y"><AuthnContext><AuthnContextClassRef>urn:federation:authentication:windows</AuthnContextClassRef></AuthnContext></AuthnStatement></Assertion>`;
const SIGNED_RESPONSE_HEAD = `<?xml version="1.0" encoding="UTF-8"?><samlp:Response ID="_r" Version="2.0" IssueInstant="x" Destination="https://x" Consent="urn:oasis:names:tc:SAML:2.0:consent:unspecified" InResponseTo="_x" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"><Issuer xmlns="urn:oasis:names:tc:SAML:2.0:assertion">http://adfs/</Issuer>${SIGNATURE}<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success" /></samlp:Status>`;

describe("checkSamlResponseBounds", () => {
  test.each([
    [
      "a signed response with a signed assertion",
      SIGNED_RESPONSE_HEAD + SIGNED_ASSERTION + "</samlp:Response>",
    ],
    [
      "a signed response with an encrypted assertion",
      SIGNED_RESPONSE_HEAD + ENCRYPTED_ASSERTION + "</samlp:Response>",
    ],
  ])("lets through %s, nested well under the depth cap", (_name, xml) => {
    expect(depth(xml)).toBeLessThanOrEqual(10);
    expect(checkSamlResponseBounds(b64(xml))).toBeNull();
  });

  test("refuses a response longer than the cap before reading it, whatever it holds", () => {
    const text = "a".repeat(SAML_RESPONSE_MAX_LENGTH);
    expect(checkSamlResponseBounds(text)).toBeNull();
    expect(checkSamlResponseBounds(text + "a")).toEqual({
      reason: "length",
      length: SAML_RESPONSE_MAX_LENGTH + 1,
    });
  });

  test("allows the depth cap and refuses one level more", () => {
    const nested = (levels: number) => "<a>".repeat(levels) + "</a>".repeat(levels);

    expect(withinBudget(nested(SAML_RESPONSE_MAX_DEPTH))).toBe(true);
    expect(checkSamlResponseBounds(b64(nested(SAML_RESPONSE_MAX_DEPTH + 1)))).toMatchObject({
      reason: "depth",
    });
  });

  // xmldom chains every element that declares a namespace onto its parent's map, so these cost the square of their
  // depth: each fits the markup budget in under 150 KiB and blocked the event loop for 0.5-0.8 s before the cap.
  test.each([
    ["5,995 nested namespace declarations, never closed", 5995, false],
    ["3,996 nested namespace declarations, closed", 3996, true],
  ])("refuses %s", (_name, levels, close) => {
    const opening = Array.from({ length: levels }, (_, i) => `<a xmlns:p${i}="u">`).join("");
    const xml = opening + (close ? "</a>".repeat(levels) : "");

    expect(b64(xml).length).toBeLessThan(SAML_RESPONSE_MAX_LENGTH);
    // Each level is one tag and one attribute, plus its closing tag when closed: within the markup budget, so only
    // the depth cap refuses it (the measure stops at the cap, so its count cannot show this).
    expect(levels * (close ? 3 : 2)).toBeLessThanOrEqual(SAML_RESPONSE_MARKUP_BUDGET);
    expect(checkSamlResponseBounds(b64(xml))).toMatchObject({ reason: "depth" });
  });

  // Shapes xmldom nests that a looser reading of the markup took as flat. Each opened 3,000-6,000 namespace scopes
  // within the budget and cost 100-230 ms to parse before the depth cap read them as xmldom does.
  const scopes = (levels: number) => '<a xmlns:p="x">'.repeat(levels);
  test.each([
    ["an unquoted value ended by a quote, so the /> sits in a value", '<a xmlns:p=x">"/>'.repeat(5999)],
    ["closing tags inside comments", (scopes(60) + "<!--" + "</a>".repeat(60) + "-->").repeat(66)],
    // xmldom's comment runs from after the whole `<!--`, so `<!-->` and `<!--->` open a comment rather than end one.
    [
      "closing tags inside comments opened as <!-->",
      (scopes(60) + "<!-->" + "</a>".repeat(60) + "-->").repeat(66),
    ],
    [
      "closing tags inside comments opened as <!--->",
      (scopes(60) + "<!--->" + "</a>".repeat(60) + "-->").repeat(66),
    ],
    ["closing tags inside CDATA sections", (scopes(60) + "<![CDATA[" + "</a>".repeat(60) + "]]>").repeat(66)],
    [
      "closing tags inside processing instructions",
      (scopes(60) + "<?pi " + "</a>".repeat(60) + "?>").repeat(66),
    ],
  ])("refuses nesting hidden behind %s", (_name, xml) => {
    expect(b64(xml).length).toBeLessThan(SAML_RESPONSE_MAX_LENGTH);
    expect(checkSamlResponseBounds(b64(xml))).toMatchObject({ reason: "depth" });
  });

  // xmldom skips markup inside a DOCTYPE's quoted literals and internal subset, which a byte scan cannot follow:
  // a `<!--` there would hide the depth of everything after it.
  test.each([
    ["a DOCTYPE whose literal opens a comment", '<!DOCTYPE r SYSTEM "<!--">'],
    ["a DOCTYPE with an entity whose value opens a comment", '<!DOCTYPE r [<!ENTITY e "<!--">]>'],
    ["a DOCTYPE whose literal opens a processing instruction", '<!DOCTYPE r SYSTEM "<?">'],
  ])("refuses %s, whatever follows", (_name, doctype) => {
    const xml = doctype + Array.from({ length: 5995 }, (_, i) => `<a xmlns:p${i}="u">`).join("");

    expect(checkSamlResponseBounds(b64(xml))).toEqual({ reason: "declaration", length: b64(xml).length });
  });

  test("names only sizes in a refusal, never content", () => {
    const refusal = checkSamlResponseBounds(b64("<a/>".repeat(SAML_RESPONSE_MARKUP_BUDGET + 1)));
    expect(refusal).toEqual({
      reason: "markup",
      length: expect.any(Number),
      markup: expect.any(Number),
      depth: 0,
    });
  });
});
