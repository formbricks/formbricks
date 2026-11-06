import {
  type TDeclaredFieldSource,
  collectDeclaredFieldNames,
} from "@formbricks/types/surveys/declared-field-guard";
import { fillMissingCodes } from "@formbricks/types/surveys/fill-missing-codes";
import { withMatrixConditionIdsInBlocks } from "@formbricks/types/surveys/matrix-conditions";

/**
 * `fillMissingCodes` for a survey-shaped payload: the names a question code must not take are the
 * Embedded Data names the survey declares. The one call every server write path makes.
 *
 * It also keeps every matrix condition's two forms in sync (ENG-6934): the row and column ids are
 * added where a writer (an older client, the v1 API, an AI) sent positions only, and the positions are
 * rewritten from the ids after a reorder, so the previous release's pods, which read positions, keep
 * pointing at the same cell during a rolling upgrade.
 */
export const fillSurveyBlockCodes = <TBlock>(
  blocks: readonly TBlock[],
  declared: TDeclaredFieldSource
): TBlock[] => withMatrixConditionIdsInBlocks(fillMissingCodes(blocks, collectDeclaredFieldNames(declared)));
