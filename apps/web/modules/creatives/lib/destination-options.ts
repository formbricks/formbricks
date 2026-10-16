import type { TSurveyVisibility } from "@formbricks/types/surveys/types";
import { getEffectiveVisibility } from "@/lib/survey/visibility/policy";
import type { TLanguageCheckSurvey } from "./languages-form";
import { isSingleUseEnabled } from "./record";
import type { TDestinationSurveyFacts } from "./repository";

/**
 * The surveys the On click picker offers (ENG-3868, T6). Single-use and PIN-protected surveys can never
 * be a Destination, so they are left out; Restricted ones are listed so the author sees why a survey is
 * missing, and the picker shows them disabled with their badge. Archived surveys are left out too: they
 * never run again unless restored. The survey a creative already opens always stays, so the picker can
 * show it whatever happened to it since.
 */

/** `languages` is absent for a survey read without them (the linked one, when not among the candidates). */
export type TDestinationSurveyCandidate = TDestinationSurveyFacts & {
  languages?: TLanguageCheckSurvey["languages"];
};

export type TDestinationSurveyOption = {
  id: string;
  name: string;
  type: TDestinationSurveyFacts["type"];
  status: TDestinationSurveyFacts["status"];
  /** Effective visibility: a pending change counts as Restricted, as the server counts it. */
  visibility: TSurveyVisibility;
  /** Its languages, for the warning on creative languages it lacks (ENG-4003); absent when unknown. */
  languages?: TLanguageCheckSurvey["languages"];
};

const isOffered = (candidate: TDestinationSurveyCandidate): boolean =>
  !candidate.archivedAt && !isSingleUseEnabled(candidate.singleUse) && !candidate.pin;

export const toDestinationSurveyOptions = (
  candidates: TDestinationSurveyCandidate[],
  linkedSurveyId: string | null
): TDestinationSurveyOption[] => {
  const seen = new Set<string>();
  return candidates.flatMap((candidate) => {
    if (seen.has(candidate.id)) return [];
    seen.add(candidate.id);
    if (candidate.id !== linkedSurveyId && !isOffered(candidate)) return [];
    return [
      {
        id: candidate.id,
        name: candidate.name,
        type: candidate.type,
        status: candidate.status,
        visibility: getEffectiveVisibility(candidate),
        ...(candidate.languages && { languages: candidate.languages }),
      },
    ];
  });
};
