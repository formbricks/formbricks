/** The formats a survey exports to, as `GET /api/internal/surveys/{id}/export?format=` takes them. */
export const SURVEY_EXPORT_FORMATS = ["json", "xlsx"] as const;

export type TSurveyExportFormat = (typeof SURVEY_EXPORT_FORMATS)[number];
