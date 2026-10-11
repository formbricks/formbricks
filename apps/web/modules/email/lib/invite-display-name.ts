// The inviter's profile name is the one piece of free text a stranger controls in an invite email
// that Formbricks sends from its own domain. Names from SSO or older accounts are not guaranteed to
// satisfy `ZUserName`, so the email bounds what it shows instead of trusting the stored value.
export const MAX_INVITE_DISPLAY_NAME_LENGTH = 60;

const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b);
// Control characters, line/paragraph separators and bidi controls that can reorder or hide text.
const HIDDEN_CHARACTERS = /[\p{Cc}\p{Zl}\p{Zp}\p{Bidi_Control}]/gu;
// Scheme URLs, `www.` hosts and email addresses.
const LINK_LIKE = /(?:[a-z][a-z0-9+.-]*:\/\/|www\.)\S*|\S+@\S+\.\S+/giu;

export const toInviteDisplayName = (name: string, fallback: string): string => {
  const cleaned = name
    .replaceAll(ZERO_WIDTH_SPACE, " ")
    .replaceAll(HIDDEN_CHARACTERS, " ")
    .replaceAll(LINK_LIKE, " ")
    .replaceAll(/\s+/gu, " ")
    .trim();

  if (!cleaned) {
    return fallback;
  }

  const characters = Array.from(cleaned);
  if (characters.length <= MAX_INVITE_DISPLAY_NAME_LENGTH) {
    return cleaned;
  }

  return `${characters.slice(0, MAX_INVITE_DISPLAY_NAME_LENGTH).join("").trimEnd()}…`;
};
