import "server-only";
import { prisma } from "@formbricks/database";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import type { TV3DestructiveChange } from "@/app/api/v3/documents/lib/envelope";
import type { TV3SurveyPatchGuard } from "../patch";

/** A document push that would remove answered questions, and was not confirmed. Mapped to a 409. */
export class V3SurveyDestructiveChangeError extends Error {
  constructor(readonly changes: TV3DestructiveChange[]) {
    super("The push would remove survey blocks or elements that have responses");
    this.name = "V3SurveyDestructiveChangeError";
  }
}

type TBlocks = Pick<TSurveyBlock, "id" | "elements">[];

/**
 * The blocks and elements `current` has and `next` has not, by id. An element that moved to another block
 * is not removed; one whose block went away with it is.
 */
export function findRemovedBlocksAndElements(
  current: TBlocks,
  next: TBlocks
): { blockIds: string[]; elementIds: string[] } {
  const nextBlockIds = new Set(next.map((block) => block.id));
  const nextElementIds = new Set(next.flatMap((block) => block.elements.map((element) => element.id)));

  return {
    blockIds: current.filter((block) => !nextBlockIds.has(block.id)).map((block) => block.id),
    elementIds: current
      .flatMap((block) => block.elements.map((element) => element.id))
      .filter((id) => !nextElementIds.has(id)),
  };
}

/**
 * Holds a push back when it removes a block or an element and the survey has responses: the answers
 * stay in the database keyed by an element id the survey no longer has, so they no longer show in any
 * result view. A survey with no responses loses nothing, so the count is only asked when something is
 * removed, and as one count, not one per element.
 *
 * The count is every response of the survey, without a visibility clause. The caller was authorized to
 * write this very survey before the guard runs, and the survey's visibility is what the response
 * predicate would apply, so the clause could only hide responses from the check and let it pass.
 *
 * The rule that an element id of a non-draft survey cannot be changed in place stays with the patch
 * pipeline (`immutable_identifier`, 422): it is not something `confirmDestructive` can lift.
 */
export const surveyDestructiveGuard: TV3SurveyPatchGuard = async ({ currentSurvey, document }) => {
  const removed = findRemovedBlocksAndElements(currentSurvey.blocks, document.blocks);
  if (removed.blockIds.length === 0 && removed.elementIds.length === 0) {
    return;
  }

  const responseCount = await prisma.response.count({ where: { surveyId: currentSurvey.id } });
  if (responseCount === 0) {
    return;
  }

  const changes: TV3DestructiveChange[] = [];
  if (removed.blockIds.length > 0) {
    changes.push({ type: "blocks_removed", ids: removed.blockIds, responseCount });
  }
  if (removed.elementIds.length > 0) {
    changes.push({ type: "elements_removed", ids: removed.elementIds, responseCount });
  }
  throw new V3SurveyDestructiveChangeError(changes);
};
