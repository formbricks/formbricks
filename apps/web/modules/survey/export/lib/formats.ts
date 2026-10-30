/** The formats a survey exports to, as `GET /api/internal/surveys/{id}/export?format=` takes them. ENG-6849 adds `xlsx`. */
export const SURVEY_EXPORT_FORMATS = ["json"] as const;

export type TSurveyExportFormat = (typeof SURVEY_EXPORT_FORMATS)[number];
