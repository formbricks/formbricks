/**
 * Query keys shared by the survey analysis pages and the response card. Never inline them: a write in one
 * component invalidates a read in another through these exact tuples.
 */
export const surveyAnalysisKeys = {
  /** The filter panel's options for a survey: its tags, attributes, hidden fields and the rest. */
  filterData: (surveyId: string) => ["surveys", surveyId, "filter-data"] as const,
};
