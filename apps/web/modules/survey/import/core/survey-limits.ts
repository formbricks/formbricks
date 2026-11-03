import type { InvalidParam } from "@/app/api/v3/lib/response";
import { isPlainObject } from "@/app/api/v3/surveys/guards";
import {
  SURVEY_IMPORT_MAX_DRAFT_BYTES,
  SURVEY_IMPORT_MAX_OPTIONS_PER_QUESTION,
  SURVEY_IMPORT_MAX_TEXT_CHARS,
} from "../limits";
import { SurveyImportFileTooLargeError } from "./errors";

/*
 * The caps every import holds a survey to when it is created, whichever lane it came from: what a draft
 * may weigh, how many options a question may have, how long a text may be. The v3 survey document caps
 * none of these, and the create takes the survey back from the client, so they are checked again there.
 */

const at = (prefix: string | null, path: string): string => (prefix ? `${prefix}.${path}` : path);

/**
 * Refuse a survey heavier than a draft may be, with a 413 naming it, before anything parses it: the
 * parse is where a large survey costs.
 */
export const assertSurveyWithinDraftSize = (survey: unknown, prefix: string | null): void => {
  if (Buffer.byteLength(JSON.stringify(survey ?? null)) > SURVEY_IMPORT_MAX_DRAFT_BYTES) {
    throw new SurveyImportFileTooLargeError(
      "survey_size",
      `The survey must not exceed ${SURVEY_IMPORT_MAX_DRAFT_BYTES} bytes as JSON`,
      at(prefix, "survey")
    );
  }
};

/** The lists of a question that hold its options. */
const OPTION_LISTS = ["choices", "rows", "columns"] as const;

const pastLimit = (name: string, reason: string): InvalidParam => ({ name, reason, code: "limit_exceeded" });

/**
 * What the survey document allows but no import may bring in: a question with more options than any
 * lane takes, a text longer than any lane takes, each named at `<prefix>.survey…`. Reads the survey as
 * sent; the v3 request budget has already bounded its depth and arrays, so the walk is bounded too.
 */
export const findSurveyContentPastLimits = (survey: unknown, prefix: string | null): InvalidParam[] => {
  const invalidParams: InvalidParam[] = [];

  const blocks = isPlainObject(survey) && Array.isArray(survey.blocks) ? survey.blocks : [];
  blocks.forEach((block, blockIndex) => {
    const elements = isPlainObject(block) && Array.isArray(block.elements) ? block.elements : [];
    elements.forEach((element, elementIndex) => {
      if (!isPlainObject(element)) return;
      for (const list of OPTION_LISTS) {
        const options = element[list];
        if (Array.isArray(options) && options.length > SURVEY_IMPORT_MAX_OPTIONS_PER_QUESTION) {
          invalidParams.push(
            pastLimit(
              at(prefix, `survey.blocks.${blockIndex}.elements.${elementIndex}.${list}`),
              `A question takes at most ${SURVEY_IMPORT_MAX_OPTIONS_PER_QUESTION} ${list}`
            )
          );
        }
      }
    });
  });

  const visit = (value: unknown, path: string): void => {
    if (typeof value === "string") {
      if (value.length > SURVEY_IMPORT_MAX_TEXT_CHARS) {
        invalidParams.push(
          pastLimit(path, `A text must not exceed ${SURVEY_IMPORT_MAX_TEXT_CHARS} characters`)
        );
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}.${index}`));
    } else if (isPlainObject(value)) {
      Object.entries(value).forEach(([key, item]) => visit(item, `${path}.${key}`));
    }
  };
  visit(survey, at(prefix, "survey"));

  return invalidParams;
};
