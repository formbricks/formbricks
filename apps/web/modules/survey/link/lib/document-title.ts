/**
 * Builds the document title for a public survey page (WCAG 2.4.2).
 *
 * The base title is whatever `generateMetadata` already produced server-side — link metadata title,
 * else the welcome-card headline, else the survey name, plus the root layout's `"| Formbricks"`
 * template. It is read back off `document.title` rather than recomputed, so the author's custom link
 * title and the cloud/self-hosted suffix are respected without duplicating
 * `getBasicSurveyMetadata`'s priority chain on the client.
 *
 * `step` is the position label the survey renderer emits, already localized in the SURVEY's active
 * language (the host's own i18n runs in the viewer's UI locale, so assembling it here would mix the
 * two).
 *
 * Returns the base unchanged when there is no step to add, or nothing meaningful to add it to, so a
 * missing label can never produce a title ending in a dangling separator.
 */
export const buildSurveyDocumentTitle = (baseTitle: string, step?: string): string => {
  const base = baseTitle.trim();
  const suffix = step?.trim();
  if (!suffix) return base;
  if (!base) return suffix;
  // Em dash rather than a pipe: the base title may already end in "| Formbricks", and two pipes read
  // as one breadcrumb rather than a title plus a position.
  return `${base} — ${suffix}`;
};
