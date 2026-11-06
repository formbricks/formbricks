import { ConcurrencyLimiter } from "@/app/lib/api/concurrency-limiter";
import {
  SURVEY_IMPORT_MAX_IN_FLIGHT,
  SURVEY_IMPORT_MAX_IN_FLIGHT_PER_USER,
} from "@/modules/survey/import/limits";

/**
 * One per server process, shared by every import route (the workspace's, and a survey's own, ENG-6809):
 * the limit bounds what a pod spends on imports, and the per-user share keeps one user from taking every
 * slot, whichever route they come through.
 */
export const surveyImportConcurrency = new ConcurrencyLimiter(SURVEY_IMPORT_MAX_IN_FLIGHT, {
  maxPerKey: SURVEY_IMPORT_MAX_IN_FLIGHT_PER_USER,
});
