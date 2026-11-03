import type { TCardArrangementOptions } from "@formbricks/types/styling";

/**
 * Where the stacked cards send the survey when the card arrangement changes (the editor's Styling
 * tab): back to the welcome card or the first block. Nothing on the first render: the survey opens
 * where its start put it, and that includes the rules before the first question (ENG-6932) — a
 * screen-out ending or a jump. Resetting there too sent the editor preview and app surveys to the
 * first question over a screen-out.
 */
export const getArrangementResetBlockId = (
  previous: TCardArrangementOptions | undefined,
  arrangement: TCardArrangementOptions,
  survey: { welcomeCard: { enabled: boolean }; blocks: { id: string }[] }
): string | null => {
  if (previous === undefined || previous === arrangement) return null;
  return survey.welcomeCard.enabled ? "start" : (survey.blocks[0]?.id ?? null);
};
