"server only";

import { SURVEY_URL, WEBAPP_URL } from "./constants";

/**
 * Returns the base URL for public surveys
 * Uses SURVEY_URL if set, otherwise falls back to WEBAPP_URL
 */
export const getSurveyDomain = (): string => {
  return SURVEY_URL || WEBAPP_URL;
};
