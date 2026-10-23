const PROTOCOL_NS = "urn:oasis:names:tc:SAML:2.0:protocol";
const ASSERTION_NS = "urn:oasis:names:tc:SAML:2.0:assertion";

/**
 * The characters whose literal form does not parse back to themselves, written as numeric references instead: the
 * markup characters; CR, NEL, LINE SEPARATOR and PARAGRAPH SEPARATOR, which a parser turns into line feeds; U+FFFD and
 * the C0 controls but tab and line feed, which saml20 refuses literally; and lone surrogates, which UTF-8 cannot carry.
 * Each of these can only have reached the issuer through a reference or CDATA at least as long as the reference written
 * here, and every other character is written as it is, so the stand-in's issuer is never longer than the original's:
 * jackson's parse of it costs no more than its parse of the response it stands in for.
 */
const REFERENCED = new Set([0x26, 0x3c, 0x3e, 0x85, 0x2028, 0x2029, 0xfffd]);

const needsReference = (codePoint: number): boolean =>
  codePoint < 0x20
    ? codePoint !== 0x09 && codePoint !== 0x0a
    : REFERENCED.has(codePoint) || (codePoint >= 0xd800 && codePoint <= 0xdfff);

/**
 * `text` as XML character data that parses back to exactly `text`. Iterated by code point, so a surrogate pair stays
 * one character and only a lone surrogate is referenced.
 */
const escapeText = (text: string): string => {
  let escaped = "";
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    escaped += needsReference(codePoint) ? `&#x${codePoint.toString(16)};` : char;
  }
  return escaped;
};

/**
 * A SAMLResponse holding nothing but `issuer`, base64 as the POST binding carries it, for jackson to judge in place of a
 * response the parse worker refused once it had begun decrypting its assertion (ENG-6646).
 *
 * Before it decrypts, jackson reads nothing of a response but its issuer (saml20's `parseIssuer`, which reads this one
 * back as exactly `issuer`); the rest of what it checks is the RelayState's session, the connection and its redirect
 * URL. So it answers this one as it answers any response from `issuer` whose assertion does not decrypt, in whatever
 * state those checks are in: refused before decrypting, or failed at validation, which this response cannot pass.
 */
export const samlResponseWithoutAssertion = (issuer: string): string =>
  Buffer.from(
    `<samlp:Response xmlns:samlp="${PROTOCOL_NS}">` +
      `<saml:Issuer xmlns:saml="${ASSERTION_NS}">${escapeText(issuer)}</saml:Issuer>` +
      "</samlp:Response>",
    "utf8"
  ).toString("base64");
