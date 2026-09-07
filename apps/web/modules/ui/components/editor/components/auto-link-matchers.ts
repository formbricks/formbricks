import type { LinkMatcher } from "@lexical/link";

// `{1,256}` already keeps this one linear (measured 27ms on 200k characters), so it is unchanged.
const URL_MATCHER =
  /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/;

// Unbounded, the engine rescans a long run of local-part characters from every start position
// looking for an `@` that never comes — O(N^2), measured 17s on 200k characters of `%_-`.
//
// The lookbehind is what makes this safe, and the cap alone is NOT enough. `\b` also sits between a
// word character and `+`, `-`, `%` or `.`, so with only a cap the engine can restart *inside* an
// overlong local part and match its last 64 characters: `("a+".repeat(32) + "a@example.com")` linked
// `+a+a…@example.com`, a DIFFERENT address from the one written. Refusing to start where a
// local-part character precedes means an overlong local part matches nowhere at all, so the worst
// case is no link rather than a link to somewhere else.
//
// Together they are also linear (0.5ms on the same 200k input), because the lookbehind lets the
// engine skip every start position inside a run instead of retrying each one.
//
// Bounding the domain and TLD as well measured no faster on any pump tried, so those stay unbounded.
const EMAIL_MATCHER = /\b(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

// Auto-linked URLs must behave like links inserted through the link toolbar, which
// sets the same attributes: a survey opened in the same tab navigates the respondent
// away from an in-progress response.
export const LINK_ATTRIBUTES = {
  target: "_blank",
  rel: "noopener noreferrer",
};

const matchUrl: LinkMatcher = (text) => {
  const match = URL_MATCHER.exec(text);
  if (!match) return null;

  return {
    index: match.index,
    length: match[0].length,
    text: match[0],
    url: match[0],
    attributes: LINK_ATTRIBUTES,
  };
};

// mailto: links deliberately keep the current tab — handing off to the mail client
// does not navigate the respondent away from their in-progress response.
const matchEmail: LinkMatcher = (text) => {
  const match = EMAIL_MATCHER.exec(text);
  if (!match) return null;

  return {
    index: match.index,
    length: match[0].length,
    text: match[0],
    url: `mailto:${match[0]}`,
  };
};

export const MATCHERS: LinkMatcher[] = [matchUrl, matchEmail];
