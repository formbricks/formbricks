// Free text that someone other than the recipient chose, shown in an email Formbricks sends from its own
// domain: an inviter's profile name, a survey's name in the verify-email link. Spam put into fields like
// these rides the sender's reputation, so the email bounds and de-links what it shows instead of trusting
// the stored value. Names from SSO or older accounts are not guaranteed to satisfy `ZUserName`, and
// survey names have no length limit at all.
export const MAX_EMAIL_DISPLAY_TEXT_LENGTH = 60;

// Control characters, line/paragraph separators and bidi controls that can reorder or hide text.
const HIDDEN_CHARACTERS = /[\p{Cc}\p{Zl}\p{Zp}\p{Bidi_Control}]/gu;
// Invisible format characters (zero-width space, word joiner, joiners, soft hyphen, BOM). They are removed
// rather than spaced so `https:<U+200B>//host` becomes a contiguous URL again before the link check runs,
// and a name that reads as one word still does.
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
  return atIndex > 0 && lastDotIndex > atIndex + 1 && lastDotIndex < token.length - 1;
};

export const toEmailDisplayText = (text: string, fallback: string): string => {
  const cleaned = text
    .replaceAll(HIDDEN_CHARACTERS, " ")
    .replaceAll(INVISIBLE_FORMAT_CHARACTERS, "")
    .split(/\s+/u)
    .filter((token) => token && !isLinkLike(token))
    .join(" ");

  if (!cleaned) {
    return fallback;
  }

  const characters = Array.from(cleaned);
  if (characters.length <= MAX_EMAIL_DISPLAY_TEXT_LENGTH) {
    return cleaned;
  }

  // The ellipsis counts toward the cap, so the result never exceeds MAX_EMAIL_DISPLAY_TEXT_LENGTH.
  return `${characters
    .slice(0, MAX_EMAIL_DISPLAY_TEXT_LENGTH - 1)
    .join("")
    .trimEnd()}…`;
};
