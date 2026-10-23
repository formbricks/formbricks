const PROTOCOL_NS = "urn:oasis:names:tc:SAML:2.0:protocol";
const ASSERTION_NS = "urn:oasis:names:tc:SAML:2.0:assertion";

/**
 * Everything but tab, line feed and printable ASCII other than the markup characters. Written as numeric references,
 * these parse back to exactly the characters they name, which their literal forms do not always do: a parser turns
 * CR, NEL, LINE SEPARATOR and PARAGRAPH SEPARATOR into line feeds, saml20 refuses a document holding U+FFFD, and UTF-8
 * cannot carry a lone surrogate. Since the issuer itself came out of a parse, every character in it can be referenced.
 */
const NEEDS_REFERENCE = /[&<>]|[^\t\n\x20-\x7E]/gu;

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
