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
const TOP_LEVEL_DOMAIN = /^\p{L}{2,}$/u;

// Bare domains such as `spam.example` or `spam.example/offer`, which most mail clients turn into links.
// Split on dots rather than matched with one regex, for the same backtracking reason as above. An
// initial like `J.R.R.` is kept: its last label is one letter.
const TRAILING_PUNCTUATION = new Set([".", ",", ";", "!", "?", ")"]);

const isBareDomain = (token: string): boolean => {
  // Trimmed by hand: `/[.,;!?)]+$/` retries from every dot and is quadratic on a run of dots.
  let end = token.length;
  while (end > 0 && TRAILING_PUNCTUATION.has(token[end - 1])) end--;
  const host = token.slice(0, end).split(/[/?#:]/u, 1)[0];
  const labels = host.split(".");
  return (
    labels.length >= 2 &&
    labels.every((label) => DOMAIN_LABEL.test(label)) &&
    TOP_LEVEL_DOMAIN.test(labels[labels.length - 1])
  );
};

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
