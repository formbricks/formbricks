import {
  type TDeclaredFieldSource,
  collectDeclaredFieldNames,
} from "@formbricks/types/surveys/declared-field-guard";
import { fillMissingCodes } from "@formbricks/types/surveys/fill-missing-codes";

/**
 * `fillMissingCodes` for a survey-shaped payload: the names a question code must not take are the
 * Embedded Data names the survey declares. The one call every server write path makes.
 */
export const fillSurveyBlockCodes = <TBlock>(
  blocks: readonly TBlock[],
  declared: TDeclaredFieldSource
): TBlock[] => fillMissingCodes(blocks, collectDeclaredFieldNames(declared));
