import "server-only";

/**
 * Most markup a `SAMLResponse` may carry before jackson parses it (ENG-3973, ENG-3248).
 *
 * jackson decodes the response and builds its whole DOM (`saml20.parseIssuer`) before it checks the issuer,
 * the connection or RelayState, so an anonymous caller chooses how much parsing the callback does. Parse cost
 * follows the number of nodes, not the number of bytes: inside the 256 KiB `/api/auth` body limit, a response
 * that is nothing but ~49,000 empty elements holds a ~52 MB DOM and blocks the event loop for 60-200 ms,
 * against ~1 MB and ~5 ms for a real signed assertion carrying 150 groups.
 *
 * The budget counts `<` (one per tag) and `=` (one per attribute), since attributes are nodes too. A real
 * response written as verbosely as Okta writes one (`xmlns:xs`, `xmlns:xsi` and `xsi:type` on every group)
 * reaches about 5,100 only at 1,000 groups, where it already fills the whole 256 KiB body limit, so nothing
 * legitimate that fits can come near 12,000. At the budget, the worst shape costs ~11 MB and ~20 ms.
 */
export const SAML_RESPONSE_MARKUP_BUDGET = 12_000;

const LESS_THAN = 0x3c;
const EQUALS = 0x3d;

/**
 * Counts `<` and `=` in the decoded response. Works on the bytes, so it is one pass over at most the
 * request body (~0.15 ms at the limit) and never builds a string or a tree. Not a parser: anything it
 * miscounts, jackson still parses and rejects exactly as before.
 */
export const countSamlResponseMarkup = (samlResponseBase64: string): number => {
  const xml = Buffer.from(samlResponseBase64, "base64");
  let count = 0;
  // An index loop, not for..of: the iterator is ~7x slower over a 250 KiB buffer.
  for (let i = 0; i < xml.length; i++) {
    const byte = xml[i];
    if (byte === LESS_THAN || byte === EQUALS) count++;
  }
  return count;
};

/** Whether jackson should be allowed to parse this response at all. */
export const isSamlResponseWithinBudget = (samlResponseBase64: string): boolean =>
  countSamlResponseMarkup(samlResponseBase64) <= SAML_RESPONSE_MARKUP_BUDGET;
