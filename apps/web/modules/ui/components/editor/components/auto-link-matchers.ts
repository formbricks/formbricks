import type { LinkMatcher } from "@lexical/link";

// `{1,256}` already keeps this one linear (measured 27ms on 200k characters), so it is unchanged.
const URL_MATCHER =
  /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/;

// The local part is capped at RFC 5321's 64, which is the ONE change that matters here: unbounded,
// the engine rescans a long run of local-part characters from every start position looking for an
// `@` that never comes (O(N^2) — measured 18.2s on 200k characters of `%_-`, against 20ms capped).
// Deliberately the only cap added: bounding the domain and TLD as well measured no faster on any
// pump tried, so it would change what matches while buying nothing.
const EMAIL_MATCHER = /\b[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

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
