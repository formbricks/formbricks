import DOMpurify from "isomorphic-dompurify";

/**
 * Save-time allowlist for a follow-up email body, applied before the body is persisted on the survey.
 *
 * Kept in step with `sanitizeBody` in `@/modules/email/lib/survey-response-email`, which sanitizes the
 * same HTML again at send time. The two are independent allowlists over one value, so the narrower one
 * wins: anything dropped here never reaches the email stage, however permissive that stage is.
 *
 * `ul`/`ol`/`li` are on the list because the Body editor offers list buttons. Without them DOMPurify
 * removes the list tags but keeps their contents (`KEEP_CONTENT` defaults to true), so an authored list
 * was persisted as bare `<span>`s and the email rendered its items run together on one line, unnumbered.
 * `start`/`value` keep the numbering of an `<ol>` that doesn't begin at 1 — Lexical writes those
 * explicitly.
 */
const FOLLOW_UP_BODY_SANITIZE_CONFIG = {
  ALLOWED_TAGS: ["p", "span", "b", "strong", "i", "em", "a", "br", "ul", "ol", "li"],
  ALLOWED_ATTR: ["href", "rel", "dir", "class", "start", "value"],
  ALLOWED_URI_REGEXP: /^https?:\/\//, // Only allow safe URLs starting with http or https
  ADD_ATTR: ["target"], // Optional: Allow 'target' attribute for links (e.g., _blank)
  // `ALLOWED_URI_REGEXP` is applied to every attribute DOMPurify does not already consider URI-safe,
  // so a custom one silently drops non-URL attributes too: `rel`, `dir` and `start` were being stripped
  // because their values aren't http(s) URLs. Declaring them URI-safe exempts them from that check
  // while leaving `href` — the only URL-bearing attribute here — fully checked.
  ADD_URI_SAFE_ATTR: ["rel", "dir", "start"],
} as const;

export const sanitizeFollowUpBody = (body: string): string =>
  DOMpurify.sanitize(body, FOLLOW_UP_BODY_SANITIZE_CONFIG);
