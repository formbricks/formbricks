import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurvey, ZSurveyEndScreenCard, ZSurveyRedirectUrlCard } from "@formbricks/types/surveys/types";

/** The editor-only `isDraft` flag on elements is not part of the survey; it must not reach the server. */
export const removeDraftFlagsFromBlocks = (blocks: TSurveyBlock[]): TSurveyBlock[] =>
  blocks.map((block) => ({
    ...block,
    elements: block.elements.map((element) => {
      const { isDraft: _isDraft, ...rest } = element;
      return rest;
    }),
  }));

/** Parses each ending with the schema of its own type, dropping anything the schema does not know. */
export const parseSurveyEndings = (endings: TSurvey["endings"]): TSurvey["endings"] =>
  endings.map((ending) =>
    ending.type === "redirectToUrl"
      ? ZSurveyRedirectUrlCard.parse(ending)
      : ZSurveyEndScreenCard.parse(ending)
  );

/**
 * The survey as the save action sends it: no draft flags, no legacy questions (blocks replace them),
 * endings parsed. A copy, so the editor's own survey keeps its draft flags if the save fails.
 */
export const buildSurveySavePayload = (survey: TSurvey): TSurvey => ({
  ...survey,
  blocks: survey.blocks ? removeDraftFlagsFromBlocks(survey.blocks) : survey.blocks,
  questions: [],
  endings: parseSurveyEndings(survey.endings),
});
