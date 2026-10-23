const PROTOCOL_NS = "urn:oasis:names:tc:SAML:2.0:protocol";
const ASSERTION_NS = "urn:oasis:names:tc:SAML:2.0:assertion";

const TEXT_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\r": "&#13;" };

/**
 * `text` as XML character data that parses back to exactly `text`: the markup characters escaped, and carriage returns
 * as references, since a parser turns a literal one into a line feed.
 */
const escapeText = (text: string): string => text.replaceAll(/[&<>\r]/g, (char) => TEXT_ESCAPES[char]);

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
