import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";

/**
 * Whether the card for `blockId` opens with a full-width image or video. The close button sits in the
 * card's top-right corner, beside the question; over media it would cover the picture and could
 * vanish against it, so those cards keep the close button on its own row above the content.
 *
 * The welcome card's `fileUrl` is a logo drawn at a quarter of the card width, on the left, so only
 * its video counts.
 */
export const getCardStartsWithMedia = (survey: TJsWorkspaceStateSurvey, blockId: string): boolean => {
  if (blockId === "start") return Boolean(survey.welcomeCard.videoUrl);

  const ending = survey.endings.find((candidate) => candidate.id === blockId);
  if (ending) return ending.type === "endScreen" && Boolean(ending.imageUrl || ending.videoUrl);

  const firstElement = survey.blocks.find((block) => block.id === blockId)?.elements[0];
  return Boolean(firstElement?.imageUrl || firstElement?.videoUrl);
};
