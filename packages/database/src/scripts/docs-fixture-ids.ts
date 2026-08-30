/**
 * Ids for the docs fixture, kept apart from the seed script that writes them.
 *
 * `seed-docs-fixtures.ts` constructs a `PrismaClient` and runs the production guard while the module
 * evaluates, so anything that only needs the ids — `scripts/docs-capture/capture.ts` does — cannot
 * import it without connecting to a database. Splitting the constants out lets both sides share one
 * definition, so a renamed id breaks the capture script at compile time instead of at the first
 * screenshot that silently photographs a 404.
 *
 * Values are fixed rather than generated because screenshots address surveys by URL: a shot must not
 * depend on the order rows happened to be inserted in.
 */
export const DOCS_IDS = {
  ORGANIZATION: "cldocsacmeorg00000000001",
  WORKSPACE: "cldocsacmeworkspace000001",
  SURVEY_ALL_ELEMENTS: "cldocsallelements00000001",
  /** An app survey. Several settings — Visibility & Recontact, targeting — only exist for this type. */
  SURVEY_APP: "cldocsappsurvey000000001",
  /**
   * Two link surveys that exist only to be photographed from the respondent's side: the PIN screen
   * and the email gate come before the survey and cannot be shown from the editor.
   */
  SURVEY_PIN: "cldocspinsurvey000000001",
  SURVEY_VERIFY_EMAIL: "cldocsverifyemail00000001",
} as const;
