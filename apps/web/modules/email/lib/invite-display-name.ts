import { parse } from "tldts";

// The inviter's profile name is the one piece of free text a stranger controls in an invite email
// that Formbricks sends from its own domain. Names from SSO or older accounts are not guaranteed to
// satisfy `ZUserName`, so the email bounds what it shows instead of trusting the stored value.
export const MAX_INVITE_DISPLAY_NAME_LENGTH = 60;

const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b);
// Control characters, line/paragraph separators and bidi controls that can reorder or hide text.
const HIDDEN_CHARACTERS = /[\p{Cc}\p{Zl}\p{Zp}\p{Bidi_Control}]/gu;
// Remaining invisible format characters (word joiner, joiners, soft hyphen, BOM). They are removed
// rather than spaced so `https:<U+2060>//host` becomes a contiguous URL again before the link check runs.
const INVISIBLE_FORMAT_CHARACTERS = /\p{Cf}/gu;
// Scheme URLs, `www.` hosts and email addresses. Checked per whitespace-delimited token with plain
// string searches: a single regex for all three backtracks quadratically on a long name that has no
// `@` or `://`, and the stored name is not length-bounded.
const isLinkLike = (token: string): boolean => {
  const lowerCased = token.toLowerCase();
  if (lowerCased.includes("://") || lowerCased.includes("www.")) {
    return true;
  }

  const atIndex = token.indexOf("@");
  const lastDotIndex = token.lastIndexOf(".");
  if (atIndex > 0 && lastDotIndex > atIndex + 1 && lastDotIndex < token.length - 1) {
    return true;
  }
  return isBareDomain(token);
};

const DOMAIN_LABEL = /^[\p{L}\p{N}-]+$/u;
const NON_HOST_CHARACTERS = /[^\p{L}\p{N}.-]+/u;

// RFC 2606 reserves these for documentation and tests. Mail clients still linkify them, so they are stripped
// like a real top-level domain even though the public suffix list does not carry them.
const RESERVED_TOP_LEVEL_DOMAINS: Record<string, true> = {
  example: true,
  invalid: true,
  localhost: true,
  test: true,
};

const isDomainLike = (piece: string): boolean => {
  // Trailing dots trimmed by hand: `/\.+$/` retries from every dot and is quadratic on a run of them.
  let end = piece.length;
  while (end > 0 && piece[end - 1] === ".") end--;
  const candidate = piece.slice(0, end);
  const labels = candidate.split(".");
  if (labels.length < 2 || !labels.every((label) => DOMAIN_LABEL.test(label))) {
    return false;
  }
  // A delegated top-level domain is what a mail client turns into a link. Testing against the public suffix
  // list keeps ordinary dotted names — `john.doe`, `J.Smith`, `Anna.Müller`, `Dr.Smith` — out of the
  // stripper, while `spam.example`, `evil.com` and `win.spam.co.uk` still go. Lower-cased first: `tldts` does
  // not fold case for a non-ASCII suffix, so `foo.РФ` would miss the lookup that `foo.рф` hits.
  if (parse(candidate.toLowerCase(), { allowPrivateDomains: false }).isIcann) {
    return true;
  }
  return RESERVED_TOP_LEVEL_DOMAINS[(labels.at(-1) ?? "").toLowerCase()] === true;
};

// Bare domains such as `spam.example`, `(spam.example)` or `Anna,spam.example/offer`, which most mail clients
// turn into links. The token is cut at every character a host cannot contain and each piece is checked,
// all with linear scans.
const isBareDomain = (token: string): boolean => token.split(NON_HOST_CHARACTERS).some(isDomainLike);

export const toInviteDisplayName = (name: string, fallback: string): string => {
  const cleaned = name
    .replaceAll(ZERO_WIDTH_SPACE, " ")
    .replaceAll(HIDDEN_CHARACTERS, " ")
    .replaceAll(INVISIBLE_FORMAT_CHARACTERS, "")
    .split(/\s+/u)
    .filter((token) => token && !isLinkLike(token))
    .join(" ");

  if (!cleaned) {
    return fallback;
  }

  const characters = Array.from(cleaned);
  if (characters.length <= MAX_INVITE_DISPLAY_NAME_LENGTH) {
    return cleaned;
  }

  // The ellipsis counts toward the cap, so the result never exceeds MAX_INVITE_DISPLAY_NAME_LENGTH.
  return `${characters
    .slice(0, MAX_INVITE_DISPLAY_NAME_LENGTH - 1)
    .join("")
    .trimEnd()}…`;
};
