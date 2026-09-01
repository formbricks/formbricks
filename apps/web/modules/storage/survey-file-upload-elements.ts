/**
 * Client-safe helpers for a survey's file-upload elements.
 *
 * Split out of `./utils` — which is `server-only` because it reaches for `WEBAPP_URL` and the public
 * domain — so a client component can ask "does this survey collect files?" without dragging server
 * config into the bundle. Same arrangement as `./url-helpers`, and `./utils` re-exports from here so
 * existing server-side imports keep working.
 */
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyElementTypeEnum, TSurveyFileUploadElement } from "@formbricks/types/surveys/elements";
import { TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

/**
 * Every file-upload element in a survey.
 *
 * A survey holds its elements in `blocks` or in legacy `questions`, so both shapes are read: keying off
 * one alone silently misses the other.
 */
export const getSurveyFileUploadConfigs = ({
  blocks,
  questions,
}: {
  blocks?: TSurveyBlock[] | null;
  questions?: TSurveyQuestion[] | null;
}): TSurveyFileUploadElement[] => {
  return [
    ...(blocks ?? [])
      .flatMap((block) => block.elements)
      .filter((element) => element.type === TSurveyElementTypeEnum.FileUpload),
    ...(questions ?? []).filter((question) => question.type === TSurveyQuestionTypeEnum.FileUpload),
  ] as TSurveyFileUploadElement[];
};
