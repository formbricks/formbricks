const PROTOCOL_NS = "urn:oasis:names:tc:SAML:2.0:protocol";
const ASSERTION_NS = "urn:oasis:names:tc:SAML:2.0:assertion";

/** The markup characters, as their shortest references. */
const MARKUP: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };

/**
 * Characters whose literal form does not parse back to themselves, so they are written as numeric references: CR,
 * NEL, LINE SEPARATOR and PARAGRAPH SEPARATOR, which a parser turns into line feeds; U+FFFD, which saml20 refuses
 * literally; the C0 controls but tab and line feed, which XML does not allow literally; and lone surrogates, which
 * UTF-8 cannot carry.
 */
const REFERENCED = new Set([0x0d, 0x85, 0x2028, 0x2029, 0xfffd]);

const needsReference = (codePoint: number): boolean =>
  codePoint < 0x20
    ? codePoint !== 0x09 && codePoint !== 0x0a
    : REFERENCED.has(codePoint) || (codePoint >= 0xd800 && codePoint <= 0xdfff);

/**
 * `text` as XML character data that parses back to exactly `text`, in the shortest forms that do: every other
 * character is written as it is, and references are decimal. Iterated by code point, so a surrogate pair stays one
 * character and only a lone surrogate is referenced.
 */
const escapeText = (text: string): string => {
  let escaped = "";
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    escaped += MARKUP[char] ?? (needsReference(codePoint) ? `&#${codePoint};` : char);
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
 * Its issuer is written about as compactly as the original's (a markup or control character can take a few times the
 * bytes it did there), and the route charges jackson's time on it to the main-thread allowance.
 */
export const samlResponseWithoutAssertion = (issuer: string): string =>
  Buffer.from(
    `<samlp:Response xmlns:samlp="${PROTOCOL_NS}">` +
      `<saml:Issuer xmlns:saml="${ASSERTION_NS}">${escapeText(issuer)}</saml:Issuer>` +
      "</samlp:Response>",
    "utf8"
  ).toString("base64");
