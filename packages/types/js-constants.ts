/**
 * Constants shared between the public client API and the JS widget that consumes it.
 *
 * This module deliberately imports nothing. Its consumers include `@formbricks/surveys`, whose
 * bundle every respondent of an app survey downloads, and importing a *value* from `./js` instead
 * would drag that module's zod schema graph into the bundle — measured at +94 kB on the UMD build.
 * Keep it dependency-free, and keep constants the widget needs here rather than in `./js`.
 */

/**
 * The string the public client API substitutes for every survey name it returns, so that survey
 * names are not exposed over an unauthenticated endpoint (ENG-808).
 *
 * It is a marker, not text anyone should ever read: it lives here rather than inline at the
 * substitution site so the widget can recognise it and refuse to render it. Change it in one place
 * or the widget stops recognising it — see `getSurveyDisplayName` in `@formbricks/surveys`.
 */
export const PUBLIC_API_SURVEY_NAME_PLACEHOLDER =
  "[deprecated] survey name omitted from public API - will be removed soon";
