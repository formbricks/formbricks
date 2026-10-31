/** The formats a survey exports to, as `GET /api/internal/surveys/{id}/export?format=` takes them. */
export const SURVEY_EXPORT_FORMATS = ["json", "xlsx"] as const;

export type TSurveyExportFormat = (typeof SURVEY_EXPORT_FORMATS)[number];

/** What each format's file name ends in: `<survey name>.formbricks.json`, `<survey name>.xlsx`. */
export const SURVEY_EXPORT_FILE_EXTENSIONS: Readonly<Record<TSurveyExportFormat, string>> = {
  json: ".formbricks.json",
  xlsx: ".xlsx",
};
