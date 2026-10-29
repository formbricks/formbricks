/**
 * Whether the search box and the search value in the URL say the same thing. The URL value is
 * trimmed when it is written, so the box keeps a trailing space the user is still typing past
 * (`user1 ` then `x`) instead of being reset to `user1`.
 */
export const isSameSearch = (boxText: string, urlValue: string): boolean =>
  boxText.trim() === urlValue.trim();
