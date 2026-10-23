const PROTOCOL_NS = "urn:oasis:names:tc:SAML:2.0:protocol";
const ASSERTION_NS = "urn:oasis:names:tc:SAML:2.0:assertion";

/**
 * The characters whose literal form does not parse back to themselves, written as numeric references instead: the
 * markup characters; CR, NEL, LINE SEPARATOR and PARAGRAPH SEPARATOR, which a parser turns into line feeds; U+FFFD and
 * the C0 controls, which saml20 refuses literally; and lone surrogates, which UTF-8 cannot carry. Each of these can
 * only have reached the issuer through a reference or CDATA at least as long as the reference written here, and every
 * other character is written as it is, so the stand-in's issuer is never longer than the original's: jackson's parse
 * of it costs no more than its parse of the response it stands in for.
 */
const NEEDS_REFERENCE =
  /[&<>\r\u0085\u2028\u2029\uFFFD\x00-\x08\x0B\x0C\x0E-\x1F]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** `text` as XML character data that parses back to exactly `text`. */
const escapeText = (text: string): string =>
  text.replaceAll(NEEDS_REFERENCE, (char) => `&#x${(char.codePointAt(0) ?? 0).toString(16)};`);

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
