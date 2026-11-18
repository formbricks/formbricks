import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { type TSurveyElement } from "@formbricks/types/surveys/elements";
import { isValidValue } from "../util";

/**
 * What the response card shows for each question, decided without rendering (lifted out of the card,
 * ENG-6936).
 *
 * - `answer`: the question has an answer.
 * - `skipped` / `aborted`: no answer. A run of unanswered questions is listed once, on its first
 *   question (`elementIds`), and the rest of the run show nothing (`elementIds` undefined). Questions
 *   the respondent passed are `skipped`; the run where an unfinished response stopped is `aborted`.
 * - `notShown`: the response's not-shown record lists the question, so the respondent never saw it.
 *   A run of them is listed once, like a skipped run. It is never counted as skipped, and it breaks
 *   a skipped run in two. A record wins over a stray answer, as in the summary and the Analysis export.
 * - `notReached`: the response ended before the first question (see `hasEndedBeforeFirstQuestion`),
 *   so the respondent passed nothing. Listed once, like a skipped run, in place of one.
 * - `none`: nothing at all (a CTA without an external button and no data).
 */
export type TResponseCardRow =
  | { type: "answer" }
  | { type: "none" }
  | { type: "skipped" | "aborted" | "notReached"; elementIds: string[] | undefined }
  | { type: "notShown"; elementIds: string[] | undefined };

type TCardElement = Pick<TSurveyElement, "id" | "type"> & { buttonExternal?: boolean };

const flushTemp = (temp: string[], result: string[][], shouldReverse = false) => {
  if (temp.length > 0) {
    if (shouldReverse) temp.reverse();
    result.push([...temp]);
    temp.length = 0;
  }
};

/** Runs of unanswered questions. A not-shown question ends a run without joining one. */
const getSkippedGroups = (
  elements: readonly TCardElement[],
  data: TResponseData,
  finished: boolean,
  notShown: ReadonlySet<string>
): string[][] => {
  const result: string[][] = [];
  const temp: string[] = [];

  if (finished) {
    for (const element of elements) {
      if (notShown.has(element.id) || isValidValue(data[element.id])) {
        flushTemp(temp, result);
      } else {
        temp.push(element.id);
      }
    }
    flushTemp(temp, result);
    return result;
  }

  for (let index = elements.length - 1; index >= 0; index--) {
    const element = elements[index];
    if (notShown.has(element.id)) {
      flushTemp(temp, result, true);
      continue;
    }
    const hasNoData = !data[element.id];
    const shouldSkip = hasNoData && (result.length === 0 || !isValidValue(data[element.id]));

    if (shouldSkip) {
      temp.push(element.id);
    } else {
      flushTemp(temp, result, true);
    }
  }
  flushTemp(temp, result);
  return result;
};

/** Runs of consecutive not-shown questions, in survey order. */
const getNotShownGroups = (elements: readonly TCardElement[], notShown: ReadonlySet<string>): string[][] => {
  const result: string[][] = [];
  const temp: string[] = [];
  for (const element of elements) {
    if (notShown.has(element.id)) temp.push(element.id);
    else flushTemp(temp, result);
  }
  flushTemp(temp, result);
  return result;
};

/**
 * True when a finished response never reached its first question (ENG-7030): a screen-out by a rule
 * before the first question, or a survey whose every block was passed over by show-if. Both finish
 * as the survey loads, before the welcome card, and store no answer and an empty `ttc`.
 * In the survey runtime, any submitted page records a time for each of its questions, so a
 * respondent who reached one, even to skip it, leaves one behind. Any time other than the server's
 * `_total` counts, even under an id the survey no longer has (a question deleted since), so editing
 * the survey never turns a reached response into one that ended before it began. A respondent who
 * clicked the welcome card (`welcomeCard: "clicked"`) saw it, so their response does not count.
 */
export const hasEndedBeforeFirstQuestion = ({
  elements,
  data,
  ttc,
  finished,
}: {
  elements: readonly Pick<TSurveyElement, "id">[];
  data: TResponseData;
  ttc: TResponseTtc | undefined;
  finished: boolean;
}): boolean => {
  if (!finished || elements.length === 0) return false;
  if (data.welcomeCard === "clicked") return false;
  if (Object.keys(ttc ?? {}).some((key) => key !== "_total")) return false;
  return elements.every((element) => !isValidValue(data[element.id]));
};

export const getResponseCardRows = ({
  elements,
  data,
  finished,
  notShownElementIds,
  endedBeforeFirstQuestion = false,
}: {
  elements: readonly TCardElement[];
  data: TResponseData;
  finished: boolean;
  /** From the response's not-shown record; empty when the record is unknown (read as today). */
  notShownElementIds: ReadonlySet<string>;
  /** From `hasEndedBeforeFirstQuestion`: unanswered questions are `notReached`, not `skipped`. */
  endedBeforeFirstQuestion?: boolean;
}): TResponseCardRow[] => {
  let skippedGroups = getSkippedGroups(elements, data, finished, notShownElementIds);
  let notShownGroups = getNotShownGroups(elements, notShownElementIds);

  return elements.map((element): TResponseCardRow => {
    if (notShownElementIds.has(element.id)) {
      const group = notShownGroups.find((candidate) => candidate.includes(element.id));
      if (group) notShownGroups = notShownGroups.filter((candidate) => candidate !== group);
      return { type: "notShown", elementIds: group };
    }

    // CTA elements without an external button show only when they hold data, which keeps the history
    // from when `buttonExternal` was true.
    if (element.type === TSurveyElementTypeEnum.CTA && !element.buttonExternal && !data[element.id]) {
      return { type: "none" };
    }

    const skipped = skippedGroups.find((group) => group.includes(element.id));
    // Each run is listed once, on the first of its questions the card reaches.
    if (skipped) skippedGroups = skippedGroups.filter((group) => group !== skipped);

    if (isValidValue(data[element.id])) return { type: "answer" };

    if (endedBeforeFirstQuestion) return { type: "notReached", elementIds: skipped };

    const lastGroup = skippedGroups.at(-1);
    const isSkipped = finished || (lastGroup !== undefined && !lastGroup.includes(element.id));
    return { type: isSkipped ? "skipped" : "aborted", elementIds: skipped };
  });
};
