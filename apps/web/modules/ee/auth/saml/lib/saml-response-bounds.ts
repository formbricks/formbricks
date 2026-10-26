// No "server-only" guard: the SAML parse worker imports this module as well (ENG-4051), and it runs as a plain
// worker thread where that guard throws. It holds no secrets and imports nothing, so it stays safe to load anywhere.

/**
 * Most markup a `SAMLResponse` may carry before jackson parses it (ENG-3973, ENG-3248).
 *
 * jackson decodes the response and builds its whole DOM (`saml20.parseIssuer`) before it checks the issuer,
 * the connection or RelayState, so an anonymous caller chooses how much parsing the callback does. Parse cost
 * follows the markup, not the bytes: inside the 256 KiB length cap below, a response that is nothing but
 * ~49,000 empty elements holds a ~52 MB DOM and blocks the event loop for 60-200 ms, and ~97,000 stray `<0`
 * cost ~300 ms because xmldom raises and recovers from an error for each. A real signed assertion carrying 150
 * groups costs ~1 MB and ~5 ms.
 *
 * The budget counts every `<` byte and every attribute name inside a tag. Text is never counted, so group values
 * such as AD distinguished names (`CN=…,OU=…,DC=…`) cost nothing however many `=` they hold. A real response
 * written as verbosely as Okta writes one (`xmlns:xs`, `xmlns:xsi` and `xsi:type` on every group) reaches about
 * 5,000 only at 1,000 groups, where it already fills the whole length cap; one with the shortest
 * possible group names tops out near 8,000.
 *
 * Costs above and below were measured on Node 26.4 (arm64 laptop), warm, as the median of five single
 * `parseIssuer` calls; read them as ratios. Within the length cap and the depth cap below, the costliest shape
 * found (a valueless attribute followed by a stray quote, repeated) costs about four times as much as the same
 * budget of empty elements, against roughly sixty times for the uncapped attack.
 */
export const SAML_RESPONSE_MARKUP_BUDGET = 12_000;

/**
 * Longest `SAMLResponse` (base64 characters) the callback parses. The budget only holds inside a byte bound:
 * past it, text alone costs parse time however little markup it carries (16 MB of `&lt;` scores 8 and costs
 * jackson's signature path seconds). It matches the 256 KiB limit on `/api/auth` request bodies (ENG-3846), so
 * behind `withAuthRequestBodyLimit` it cannot be reached; it keeps the scan bounded if that limit grows or this
 * handler is mounted elsewhere. The largest real responses the budget is sized for fit (1,000 verbose Okta groups
 * are ~247 KiB).
 */
export const SAML_RESPONSE_MAX_LENGTH = 256 * 1024;

/**
 * Deepest element nesting the callback parses. xmldom chains each element that declares a namespace onto its
 * parent's map, and every element then looks names up through that chain, so nested declarations cost the square
 * of their depth: ~6,000 of them fit in 150 KiB under the budget and block the event loop for ~0.5-0.8 s. A real
 * response nests about ten deep (an encrypted assertion's key info is the deepest part), so 64 leaves room.
 */
export const SAML_RESPONSE_MAX_DEPTH = 64;

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
 * separated by a control byte through uncounted. Taking the byte 0x80 as a separator also splits the rare
 * non-ASCII character that contains it, which over-counts: the safe direction.
 */
const isSeparator = (byte: number) => byte <= 0x20 || byte === 0x80;

/**
 * Whether a byte starts an element name that xmldom accepts cheaply: an ASCII letter or `_`. A leading `:` makes
 * xmldom raise and recover just as a stray `<` does, and so does a non-ASCII byte that decodes to a character
 * that cannot start a name (`×`, `÷`, combining marks). SAML element names are ASCII, so every other start,
 * non-ASCII included, is weighted as stray; for the rare non-ASCII letter that is an over-count, the safe side.
 */
const isNameStart = (byte: number) =>
  (byte >= 0x61 && byte <= 0x7a) || (byte >= 0x41 && byte <= 0x5a) || byte === 0x5f;

/**
 * Weight of a `<` that cannot start an element: `<0`, `< `, `<:`. xmldom raises and recovers from an error for
 * each, which measured eight to sixteen times dearer than an element, and no SAML response contains one.
 */
const STRAY_LESS_THAN_WEIGHT = 16;

/**
 * Attribute names in the tag whose name starts at `from`: each name that starts after whitespace or a closing
 * quote, with or without a value. The scan never passes `end`, the next `<`, so a missing `>` can hide no markup
 * from the count, and each byte is read at most once per tag. A quote that never closes before `end` is stepped
 * over rather than ending the scan, so the names after it still count: xmldom happens to reject that shape
 * before reading them today, but the count does not rely on it.
 */
const countAttributes = (xml: Buffer, from: number, end: number): number => {
  let attributes = 0;
  let afterSeparator = false;
  let j = from;
  while (j < end && xml[j] !== GREATER_THAN) {
    const byte = xml[j];
    if (byte === DOUBLE_QUOTE || byte === SINGLE_QUOTE) {
      const close = xml.indexOf(byte, j + 1);
      const closed = close !== -1 && close < end;
      j = closed ? close + 1 : j + 1;
      afterSeparator = closed;
      continue;
    }
    if (afterSeparator && !isSeparator(byte) && byte !== EQUALS && byte !== SLASH) attributes++;
    afterSeparator = isSeparator(byte);
    j++;
  }
  return attributes;
};

const isXmlSpace = (byte: number) => byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d;

const isNameByte = (byte: number) =>
  !isSeparator(byte) &&
  byte !== SLASH &&
  byte !== GREATER_THAN &&
  byte !== EQUALS &&
  byte !== DOUBLE_QUOTE &&
  byte !== SINGLE_QUOTE &&
  byte !== LESS_THAN;

/** The first index from `from` on, short of `end`, whose byte fails `test`; `end` if none does. */
const skipWhile = (xml: Buffer, from: number, end: number, test: (byte: number) => boolean): number => {
  let j = from;
  while (j < end && test(xml[j])) j++;
  return j;
};

/**
 * Just past the quoted `name="value"` attribute (spaces allowed around the `=`) starting at `from`, or `null` when
 * what starts there is anything else, an unquoted or unterminated value included.
 */
const quotedAttributeEnd = (xml: Buffer, from: number, end: number): number | null => {
  let j = skipWhile(xml, from, end, isNameByte);
  if (j === from) return null;
  j = skipWhile(xml, j, end, isXmlSpace);
  if (j >= end || xml[j] !== EQUALS) return null;
  j = skipWhile(xml, j + 1, end, isXmlSpace);
  const quote = xml[j];
  if (j >= end || (quote !== DOUBLE_QUOTE && quote !== SINGLE_QUOTE)) return null;
  const close = xml.indexOf(quote, j + 1);
  return close === -1 || close >= end ? null : close + 1;
};

/**
 * Whether the tag whose name starts at `from` closes itself: a name, then only quoted `name="value"` attributes,
 * then `/>`. Anything else counts as opening a scope, even where xmldom would close it, because the
 * other way round is how scopes hide: xmldom ends an unquoted value at a quote, so `<a b=x">"/>` opens an element
 * that a looser reading takes as closed. Counting an odd tag open only over-counts the depth, the safe side, and
 * every IdP writes its self-closing tags in this shape.
 */
const closesItself = (xml: Buffer, from: number, end: number): boolean => {
  let j = skipWhile(xml, from, end, isNameByte);
  for (;;) {
    j = skipWhile(xml, j, end, isXmlSpace);
    if (j < end && xml[j] === SLASH) return j + 1 < end && xml[j + 1] === GREATER_THAN;
    const after = quotedAttributeEnd(xml, j, end);
    if (after === null) return false;
    j = after;
  }
};

/** What `<!` and `<?` open, as xmldom reads them, with the opener's length and its terminator. */
const OPAQUE_OPENERS = [
  { opener: "<!--", terminator: "-->" },
  { opener: "<![CDATA[", terminator: "]]>" },
  { opener: "<?", terminator: "?>" },
] as const;

/**
 * Where the comment, CDATA section or processing instruction starting at `lt` ends, as xmldom reads it: at the
 * first `-->`, `]]>` or `?>` after its whole opener, so `<!-->` does not end where it starts. xmldom does not
 * parse what is inside, so a `</` there closes nothing. Returns `null` for any other `<!`: a DOCTYPE, an entity
 * declaration or a malformed CDATA start. xmldom skips markup inside a DOCTYPE's quoted literals and internal
 * subset, which a byte scan cannot follow, and no SAML response carries one, so the response is refused instead.
 */
const opaqueEnd = (xml: Buffer, lt: number): number | null => {
  for (const { opener, terminator } of OPAQUE_OPENERS) {
    if (xml.toString("latin1", lt, lt + opener.length) !== opener) continue;
    const at = xml.indexOf(terminator, lt + opener.length);
    return at === -1 ? xml.length : at + terminator.length;
  }
  return null;
};

/** What a response holds, read up to the point where it passed a bound. */
export interface SamlResponseMarkup {
  /** Tags and attribute names, as the budget weighs them. */
  markup: number;
  /** Deepest nesting of open elements. */
  depth: number;
  /** Whether a DOCTYPE or other `<!` declaration was found; the measure stops there. */
  declaration: boolean;
}

/** The running totals of one measure. */
interface MarkupScan {
  markup: number;
  /** Elements open at this point. */
  depth: number;
  maxDepth: number;
  /** Just past the comment, CDATA section or processing instruction a `<` sits in; nothing there moves the depth. */
  opaqueUntil: number;
}

/**
 * Adds the `<` at `lt`, whose tag runs to `end` (the next `<`), to `scan`. Returns `false` when it starts a DOCTYPE
 * or other declaration, where the measure stops.
 */
const measureTag = (xml: Buffer, lt: number, end: number, scan: MarkupScan): boolean => {
  const kind = xml[lt + 1];
  const structural = lt >= scan.opaqueUntil;
  if (kind === SLASH) {
    scan.markup++;
    if (structural) scan.depth = Math.max(0, scan.depth - 1);
    return true;
  }
  if (kind === BANG || kind === QUESTION) {
    // `<!…` and `<?…` carry no attributes and open nothing; malformed ones are fatal to xmldom, so cheap.
    scan.markup++;
    if (!structural) return true;
    const until = opaqueEnd(xml, lt);
    if (until === null) return false;
    scan.opaqueUntil = until;
    return true;
  }
  if (!isNameStart(kind)) {
    scan.markup += STRAY_LESS_THAN_WEIGHT;
    return true;
  }
  scan.markup += 1 + countAttributes(xml, lt + 1, end);
  if (structural && !closesItself(xml, lt + 1, end)) scan.maxDepth = Math.max(scan.maxDepth, ++scan.depth);
  return true;
};

/**
 * Measures the markup in the decoded response in one pass over its bytes, without building a string or a tree
 * (~1 ms at the length cap), and stops as soon as the markup passes the budget or the nesting passes the depth
 * cap, so a refused flood costs nothing past that point. Every `<` counts wherever it sits, because xmldom turns
 * each one into a node or into an error it raises and recovers from; one that cannot start anything costs more,
 * so it weighs more. Following XML structure instead lets malformed input hide markup, which is exactly what an
 * attacker sends. A `<` inside a comment or CDATA section is counted too; over-counting that rarity is the safe
 * direction. Depth rises on every tag that does not strictly close itself and falls on every `</`, both only
 * outside comments, CDATA sections and processing instructions: a `</` that does not match the open element is
 * fatal to xmldom, so it cannot hide a scope.
 */
const measureMarkup = (xml: Buffer): SamlResponseMarkup => {
  const scan: MarkupScan = { markup: 0, depth: 0, maxDepth: 0, opaqueUntil: 0 };
  let lt = xml.indexOf(LESS_THAN);

  while (
    lt !== -1 &&
    scan.markup <= SAML_RESPONSE_MARKUP_BUDGET &&
    scan.maxDepth <= SAML_RESPONSE_MAX_DEPTH
  ) {
    const next = xml.indexOf(LESS_THAN, lt + 1);
    if (!measureTag(xml, lt, next === -1 ? xml.length : next, scan)) {
      return { markup: scan.markup, depth: scan.maxDepth, declaration: true };
    }
    lt = next;
  }

  return { markup: scan.markup, depth: scan.maxDepth, declaration: false };
};

/** `measureMarkup` on a response as the callback receives it, decoded as jackson decodes it. */
export const measureSamlResponseMarkup = (samlResponseBase64: string): SamlResponseMarkup =>
  measureMarkup(Buffer.from(samlResponseBase64, "base64"));

/** A refusal by what the markup holds, with its counts. */
type SamlMarkupRefusal =
  | { reason: "declaration" }
  | { reason: "markup" | "depth"; markup: number; depth: number };

/** Why a response is refused before jackson parses it; only sizes, never content, so it is safe to log. */
export type SamlResponseRefusal =
  | { reason: "length"; length: number }
  | (SamlMarkupRefusal & {
      /** The response's length in base64 characters, as the callback received it. */
      length: number;
    });

/** Why a response's decrypted assertion is refused; only sizes, never content, so it is safe to log. */
export type SamlDecryptedRefusal = SamlMarkupRefusal & {
  /**
   * The size in bytes of the response as saml20 re-serialized it with the assertion decrypted in place, which is what
   * jackson parses next. Not comparable with a response's base64 `length`.
   */
  decryptedBytes: number;
};

const markupRefusal = ({ markup, depth, declaration }: SamlResponseMarkup): SamlMarkupRefusal | null => {
  if (declaration) return { reason: "declaration" };
  if (markup > SAML_RESPONSE_MARKUP_BUDGET) return { reason: "markup", markup, depth };
  if (depth > SAML_RESPONSE_MAX_DEPTH) return { reason: "depth", markup, depth };
  return null;
};

/** The refusal for a response past any bound, or `null` when jackson may parse it. Length is checked first. */
export const checkSamlResponseBounds = (samlResponseBase64: string): SamlResponseRefusal | null => {
  const length = samlResponseBase64.length;
  if (length > SAML_RESPONSE_MAX_LENGTH) return { reason: "length", length };

  const refusal = markupRefusal(measureSamlResponseMarkup(samlResponseBase64));
  return refusal && { ...refusal, length };
};

/**
 * The same markup, depth and declaration bounds on a response whose encrypted assertion has been decrypted and put
 * in place (ENG-4051): the document jackson validates from then on. The bounds above only ever see the assertion's
 * ciphertext, and jackson's later passes over this document (xml2js, the signature check's XPath scans) cost
 * several times one parse, so it is held to what an unencrypted response may carry. The parse worker runs it, so the
 * decrypted assertion never leaves the worker.
 */
export const checkDecryptedSamlResponseBounds = (decryptedXml: string): SamlDecryptedRefusal | null => {
  const xml = Buffer.from(decryptedXml);
  const refusal = markupRefusal(measureMarkup(xml));
  return refusal && { ...refusal, decryptedBytes: xml.length };
};
