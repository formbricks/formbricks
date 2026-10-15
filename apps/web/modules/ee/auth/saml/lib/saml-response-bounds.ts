import "server-only";

/**
 * Most markup a `SAMLResponse` may carry before jackson parses it (ENG-3973, ENG-3248).
 *
 * jackson decodes the response and builds its whole DOM (`saml20.parseIssuer`) before it checks the issuer,
 * the connection or RelayState, so an anonymous caller chooses how much parsing the callback does. Parse cost
 * follows the markup, not the bytes: inside the 256 KiB `/api/auth` body limit, a response that is nothing but
 * ~49,000 empty elements holds a ~52 MB DOM and blocks the event loop for 60-200 ms, and ~97,000 stray `<0`
 * cost ~300 ms because xmldom raises and recovers from an error for each. A real signed assertion carrying 150
 * groups costs ~1 MB and ~5 ms.
 *
 * The budget counts every `<` byte and every attribute name inside a tag. Text is never counted, so group values
 * such as AD distinguished names (`CN=…,OU=…,DC=…`) cost nothing however many `=` they hold. A real response
 * written as verbosely as Okta writes one (`xmlns:xs`, `xmlns:xsi` and `xsi:type` on every group) reaches about
 * 5,000 only at 1,000 groups, where it already fills the whole 256 KiB body limit; one with the shortest
 * possible group names tops out near 8,000. At 12,000 the costliest shape (a `<0` flood) parses in ~50 ms.
 */
export const SAML_RESPONSE_MARKUP_BUDGET = 12_000;

const LESS_THAN = 0x3c;
const GREATER_THAN = 0x3e;
const EQUALS = 0x3d;
const SLASH = 0x2f;
const BANG = 0x21;
const QUESTION = 0x3f;
const DOUBLE_QUOTE = 0x22;
const SINGLE_QUOTE = 0x27;

const isWhitespace = (byte: number) => byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d;

/**
 * Attribute names in the tag whose name starts at `from`: each name that starts after whitespace or a closing
 * quote, with or without a value. The scan never passes `end`, the next `<`, so a missing `>` or an unclosed
 * quote can hide no markup from the count, and each byte is read at most once per tag.
 */
const countAttributes = (xml: Buffer, from: number, end: number): number => {
  let attributes = 0;
  let afterSeparator = false;
  let j = from;
  while (j < end && xml[j] !== GREATER_THAN) {
    const byte = xml[j];
    if (byte === DOUBLE_QUOTE || byte === SINGLE_QUOTE) {
      const close = xml.subarray(j + 1, end).indexOf(byte);
      if (close === -1) break;
      j += close + 2;
      afterSeparator = true;
      continue;
    }
    if (afterSeparator && !isWhitespace(byte) && byte !== EQUALS && byte !== SLASH) attributes++;
    afterSeparator = isWhitespace(byte);
    j++;
  }
  return attributes;
};

/**
 * Counts the markup in the decoded response in one pass over its bytes, without building a string or a tree
 * (~1 ms at the body limit). Every `<` counts wherever it sits: xmldom turns each one into a node, or into an
 * error it raises and recovers from, and either costs about the same. Following XML structure instead lets
 * malformed input hide markup, which is exactly what an attacker sends. A `<` inside a comment or CDATA
 * section is counted too; over-counting that rarity is the safe direction.
 */
export const countSamlResponseMarkup = (samlResponseBase64: string): number => {
  const xml = Buffer.from(samlResponseBase64, "base64");
  let count = 0;
  let lt = xml.indexOf(LESS_THAN);

  while (lt !== -1) {
    const next = xml.indexOf(LESS_THAN, lt + 1);
    const end = next === -1 ? xml.length : next;
    count++;
    // `</…`, `<!…` and `<?…` carry no attributes.
    const kind = xml[lt + 1];
    if (kind !== SLASH && kind !== BANG && kind !== QUESTION) count += countAttributes(xml, lt + 1, end);
    lt = next;
  }

  return count;
};
