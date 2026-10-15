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
 * possible group names tops out near 8,000. At 12,000 the costliest shape found parses in ~25 ms, against
 * ~5 ms for 12,000 empty elements and ~300 ms for the uncapped attack.
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

/**
 * What separates attributes, as xmldom reads it: any byte up to a space, so form feed and NUL count as well as
 * space, tab and newlines, plus 0x80, which xmldom also takes as a space. A narrower test lets attributes
 * separated by a control byte through uncounted.
 */
const isSeparator = (byte: number) => byte <= 0x20 || byte === 0x80;

/** Whether a byte can start an element name: a letter, `_`, `:`, or any non-ASCII byte. */
const isNameStart = (byte: number) =>
  (byte >= 0x61 && byte <= 0x7a) ||
  (byte >= 0x41 && byte <= 0x5a) ||
  byte === 0x5f ||
  byte === 0x3a ||
  byte >= 0x80;

/**
 * Weight of a `<` that cannot start anything: `<0`, `< `, `<-`. xmldom raises and recovers from an error for
 * each, which makes it ten to sixteen times dearer than an element, and no well-formed response contains one.
 */
const STRAY_LESS_THAN_WEIGHT = 16;

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
    if (afterSeparator && !isSeparator(byte) && byte !== EQUALS && byte !== SLASH) attributes++;
    afterSeparator = isSeparator(byte);
    j++;
  }
  return attributes;
};

/**
 * Counts the markup in the decoded response in one pass over its bytes, without building a string or a tree
 * (~1 ms at the body limit). Every `<` counts wherever it sits, because xmldom turns each one into a node or
 * into an error it raises and recovers from; one that cannot start anything costs more, so it weighs more.
 * Following XML structure instead lets malformed input hide markup, which is exactly what an attacker sends. A
 * `<` inside a comment or CDATA section is counted too; over-counting that rarity is the safe direction.
 */
export const countSamlResponseMarkup = (samlResponseBase64: string): number => {
  const xml = Buffer.from(samlResponseBase64, "base64");
  let count = 0;
  let lt = xml.indexOf(LESS_THAN);

  while (lt !== -1) {
    const next = xml.indexOf(LESS_THAN, lt + 1);
    const end = next === -1 ? xml.length : next;
    const kind = xml[lt + 1];
    if (kind === SLASH || kind === BANG || kind === QUESTION) {
      // `</…`, `<!…` and `<?…` carry no attributes; malformed ones are fatal to xmldom, so cheap.
      count++;
    } else if (isNameStart(kind)) {
      count += 1 + countAttributes(xml, lt + 1, end);
    } else {
      count += STRAY_LESS_THAN_WEIGHT;
    }
    lt = next;
  }

  return count;
};
