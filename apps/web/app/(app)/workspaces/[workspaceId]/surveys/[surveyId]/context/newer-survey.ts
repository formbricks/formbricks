import type { TSurvey } from "@formbricks/types/surveys/types";

/**
 * Which survey the page should hold: a save's answer, or a server render of the page. Saves on this page
 * go through `/api/internal/surveys/{id}`, which answers the stored survey but doesn't re-render the page,
 * so the page keeps the newest copy it has seen. A server render that is older than the last save (a
 * refresh that started before the save landed) must not bring the stale survey back, or the next save
 * built from it would undo the first one.
 */
export const newerSurvey = (current: TSurvey, incoming: TSurvey): TSurvey =>
  incoming.updatedAt.getTime() >= current.updatedAt.getTime() ? incoming : current;
