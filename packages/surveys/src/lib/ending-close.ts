import type { TSurvey } from "@formbricks/types/surveys/types";

/** How long an app survey stays on the ending card before it closes itself, unless told otherwise. */
export const ENDING_CARD_CLOSE_DELAY_MS = 3000;

interface TGetEndingCloseDelayInput {
  survey: Pick<TSurvey, "endings" | "keepEndingCardOpen">;
  mode: "modal" | "inline";
}

/**
 * Decides whether a finished survey closes itself, and after how long.
 *
 * Returns the delay in milliseconds, or `null` when no close should be scheduled:
 * - inline surveys (link surveys, embeds) are never closed — the host page owns them;
 * - a first ending that redirects navigates away instead, so closing would race the redirect;
 * - a survey with no ending card has nothing to show, so it closes immediately;
 * - otherwise it closes after the ending card has been shown for 3 seconds, unless the creator
 *   chose to keep the ending card open until the respondent closes it (WCAG 2.2.1).
 */
export const getEndingCloseDelay = ({ survey, mode }: TGetEndingCloseDelayInput): number | null => {
  if (mode === "inline") return null;

  const endings = survey.endings ?? [];
  if (endings.length === 0) return 0;
  if (endings[0].type === "redirectToUrl") return null;
  if (survey.keepEndingCardOpen) return null;

  return ENDING_CARD_CLOSE_DELAY_MS;
};
