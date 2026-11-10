/** A survey's pretty URL slug, as the share modal's Pretty URL tab edits it. */
export type TSurveySlugResource = {
  surveyId: string;
  slug: string | null;
};

export const serializeSurveySlug = (survey: { id: string; slug: string | null }): TSurveySlugResource => ({
  surveyId: survey.id,
  slug: survey.slug,
});
