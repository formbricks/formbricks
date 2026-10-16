import type { TCreativeView } from "./types";

export type TCreativeClick =
  | { kind: "none" }
  /** Close `close` (each counts as closed), then open `surveyId` right away. */
  | { kind: "openSurvey"; surveyId: string; close: string[] }
  | { kind: "openTab"; url: string };

/**
 * What pressing a creative does, given the surveys on screen (ADR 0004, decided 16 Oct). The click wins
 * over every rule of the survey it opens, except one: pressing it while its own survey is open does
 * nothing, so a second press can't stack the survey on itself (and is not a Click).
 */
export const resolveClick = (view: TCreativeView, openSurveyIds: readonly string[]): TCreativeClick => {
  const { destination } = view;
  if (!destination) return { kind: "none" };
  if (destination.type === "link") return { kind: "openTab", url: destination.url };

  if (destination.opensAs === "newTab") {
    // The link page reads it to record which creative opened the survey (ENG-4001).
    const url = new URL(destination.url);
    url.searchParams.set("creativeId", view.id);
    return { kind: "openTab", url: url.toString() };
  }

  if (openSurveyIds.includes(destination.surveyId)) return { kind: "none" };
  return { kind: "openSurvey", surveyId: destination.surveyId, close: [...openSurveyIds] };
};
