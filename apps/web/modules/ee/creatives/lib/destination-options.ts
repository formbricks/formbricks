import type { TSurveyVisibility } from "@formbricks/types/surveys/types";
import { getEffectiveVisibility } from "@/lib/survey/visibility/policy";
import type { TLanguageCheckSurvey } from "./languages-form";
import { getDestinationSurveyIssue } from "./record";
import type { TDestinationSurveyFacts } from "./repository";

/**
 * A survey the On click picker shows (ENG-3868). The picker searches `GET /api/v3/surveys`, which only
 * lists surveys the editor can read and leaves out single-use, PIN-protected and archived ones (none can
 * be a Destination); Restricted ones it can read stay listed, disabled with their badge, so the author
 * sees why. The survey a creative already opens is read with the creative and always shown, whatever
 * happened to it since.
 */
export type TDestinationSurveyOption = {
  id: string;
  name: string;
  type: TDestinationSurveyFacts["type"];
  status: TDestinationSurveyFacts["status"];
  /** Set only on the survey the creative already opens, once archived: it isn't Active, whatever its status. */
  archivedAt?: Date;
  /** Effective visibility: a pending change counts as Restricted, as the server counts it. */
  visibility: TSurveyVisibility;
  /** Its languages, for the warning on creative languages it lacks (ENG-4003); absent when unknown. */
  languages?: TLanguageCheckSurvey["languages"];
  /**
   * The survey the creative already opens, which can no longer be a Destination (it became Restricted,
   * single-use or PIN-protected): kept so the picker shows it, flagged so Publish waits for another.
   */
  notAllowed?: true;
};

/** The survey the stored creative opens, as the picker shows it, from the creative's own record. */
export const toLinkedSurveyOption = (survey: TDestinationSurveyFacts): TDestinationSurveyOption => ({
  id: survey.id,
  name: survey.name,
  type: survey.type,
  status: survey.status,
  ...(survey.archivedAt && { archivedAt: survey.archivedAt }),
  visibility: getEffectiveVisibility(survey),
  ...(getDestinationSurveyIssue(survey) && { notAllowed: true as const }),
});
