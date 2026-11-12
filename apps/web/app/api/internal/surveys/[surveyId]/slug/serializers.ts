/**
 * A survey's pretty URL slug, as the share modal's Pretty URL tab edits it. `updatedAt` is the survey's after
 * the write, so the page can hold the slug without a server render older than it bringing the old one back.
 */
export type TSurveySlugResource = {
  surveyId: string;
  slug: string | null;
  updatedAt: Date;
};

export const serializeSurveySlug = (survey: {
  id: string;
  slug: string | null;
  updatedAt: Date;
}): TSurveySlugResource => ({
  surveyId: survey.id,
  slug: survey.slug,
  updatedAt: survey.updatedAt,
});
