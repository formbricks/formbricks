import { TFunction } from "i18next";
import type { z } from "zod";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";

/**
 * The translated message for a jump or fallback whose destination block was deleted, or `null` when
 * the issue is not one. The schema flags these with `params.missingLogicDestination`; the editor
 * names the owning block by its title, because the missing target's id means nothing to a user.
 */
export const getLogicDestinationErrorMessage = (
  issue: z.core.$ZodIssue,
  blocks: readonly TSurveyBlock[],
  t: TFunction
): string | null => {
  if (issue.code !== "custom" || issue.path[0] !== "blocks" || typeof issue.path[1] !== "number") {
    return null;
  }

  const kind = (issue.params as { missingLogicDestination?: unknown } | undefined)?.missingLogicDestination;
  if (kind !== "jump" && kind !== "fallback") return null;

  const blockIndex = issue.path[1];
  const blockTitle = blocks[blockIndex]?.name?.trim();
  const blockName = blockTitle || t("workspace.surveys.edit.block_n", { blockNumber: blockIndex + 1 });

  if (kind === "fallback") {
    return t("workspace.surveys.edit.logic_fallback_destination_missing", { blockName });
  }

  const ruleNumber = typeof issue.path[3] === "number" ? issue.path[3] + 1 : 1;
  return t("workspace.surveys.edit.logic_jump_destination_missing", { ruleNumber, blockName });
};
