import "server-only";

/**
 * Most nodes a `SAMLResponse` may carry before jackson parses it (ENG-3973, ENG-3248).
 *
 * jackson decodes the response and builds its whole DOM (`saml20.parseIssuer`) before it checks the issuer,
 * the connection or RelayState, so an anonymous caller chooses how much parsing the callback does. Parse cost
 * follows the number of nodes, not the number of bytes: inside the 256 KiB `/api/auth` body limit, a response
 * that is nothing but ~49,000 empty elements holds a ~52 MB DOM and blocks the event loop for 60-200 ms,
 * against ~1 MB and ~5 ms for a real signed assertion carrying 150 groups.
 *
 * The budget counts what becomes a node: every `<` (tags, comments, CDATA, processing instructions) and every
 * attribute name inside a tag, with or without a value. Text is never counted, so group values such as AD
 * distinguished names (`CN=…,OU=…,DC=…`) cost nothing however many `=` they hold. A real response written as
 * verbosely as Okta writes one (`xmlns:xs`, `xmlns:xsi` and `xsi:type` on every group) reaches about 5,000
 * only at 1,000 groups, where it already fills the whole 256 KiB body limit, so nothing legitimate that fits
 * comes near 12,000.
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

const COMMENT_OPEN = Buffer.from("<!--");
const COMMENT_CLOSE = Buffer.from("-->");
const CDATA_OPEN = Buffer.from("<![CDATA[");
const CDATA_CLOSE = Buffer.from("]]>");
const PI_CLOSE = Buffer.from("?>");

/** Index just past the next `close` at or after `from`, or the end of the buffer if it never closes. */
const skipPast = (xml: Buffer, from: number, close: Buffer): number => {
  const end = xml.indexOf(close, from);
  return end === -1 ? xml.length : end + close.length;
};

/** Where a comment, CDATA section or processing instruction starting at `lt` ends, or -1 if `lt` opens a tag. */
const endOfSingleNode = (xml: Buffer, lt: number): number => {
  if (xml[lt + 1] === QUESTION) return skipPast(xml, lt + 2, PI_CLOSE);
  if (xml[lt + 1] !== BANG) return -1;
  if (xml.subarray(lt, lt + COMMENT_OPEN.length).equals(COMMENT_OPEN)) {
    return skipPast(xml, lt + COMMENT_OPEN.length, COMMENT_CLOSE);
  }
  if (xml.subarray(lt, lt + CDATA_OPEN.length).equals(CDATA_OPEN)) {
    return skipPast(xml, lt + CDATA_OPEN.length, CDATA_CLOSE);
  }
  return -1;
};

/**
 * Reads the tag that starts at `lt`, past its name, and counts every attribute name that starts after
 * whitespace or a closing quote. Quoted values are skipped whole, so neither `>` nor `=` inside one is misread.
 */
const readTag = (xml: Buffer, lt: number): { end: number; attributes: number } => {
  let attributes = 0;
  let afterSeparator = false;
  let j = lt + 1;
  while (j < xml.length && xml[j] !== GREATER_THAN) {
    const byte = xml[j];
    if (byte === DOUBLE_QUOTE || byte === SINGLE_QUOTE) {
      const close = xml.indexOf(byte, j + 1);
      j = close === -1 ? xml.length : close + 1;
      afterSeparator = true;
      continue;
    }
    const startsAttribute = afterSeparator && !isWhitespace(byte) && byte !== EQUALS && byte !== SLASH;
    if (startsAttribute) attributes++;
    afterSeparator = isWhitespace(byte);
    j++;
  }
  return { end: j + 1, attributes };
};

/**
 * Counts the nodes the decoded response would become, in one pass over its bytes, without building a string
 * or a tree (~1 ms at the body limit). Not a parser and not a validator: whatever it miscounts, jackson still
 * parses and rejects exactly as before. It only has to be right about what is expensive, which is a node.
 */
export const countSamlResponseMarkup = (samlResponseBase64: string): number => {
  const xml = Buffer.from(samlResponseBase64, "base64");
  let count = 0;
  let i = 0;

  while (i < xml.length) {
    const lt = xml.indexOf(LESS_THAN, i);
    if (lt === -1) break;
    count++;

    // A comment, CDATA section or processing instruction is one node, whatever its content says.
    const singleNodeEnd = endOfSingleNode(xml, lt);
    if (singleNodeEnd !== -1) {
      i = singleNodeEnd;
      continue;
    }

    const tag = readTag(xml, lt);
    count += tag.attributes;
    i = tag.end;
  }

  return count;
};

/** Whether jackson should be allowed to parse this response at all. */
export const isSamlResponseWithinBudget = (samlResponseBase64: string): boolean =>
  countSamlResponseMarkup(samlResponseBase64) <= SAML_RESPONSE_MARKUP_BUDGET;
