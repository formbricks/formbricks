import type { LinkMatcher } from "@lexical/link";

// Every run below is length-bounded, which is what keeps these linear: an unbounded `+` lets the
// engine rescan a long non-matching run from every start position (O(N^2) — the email matcher
// measured 18.2s on 200k characters of `%_-`). The caps follow the RFC 5321/1035 limits already
// used by `EMAIL_IN_MESSAGE` in better-auth-observability.ts: 64 for a local part, 253 for a
// domain, 63 for a label. Anything longer is not a deliverable address or a resolvable host, so
// no autolinkable text loses its link.
const URL_MATCHER =
  /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]{0,2048})/;

const EMAIL_MATCHER = /\b[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,63}\b/;

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
