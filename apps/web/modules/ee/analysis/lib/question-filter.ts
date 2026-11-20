import type { TAnswerQuestion } from "./answer-filter";

/**
 * Question filters (ENG-7323). Two filters that name a question by its id rather than by its text, so an
 * edited or translated question keeps matching:
 *
 * - **Question**: `FeedbackRecords.fieldId equals <questionId>` — the records of one question. The
 *   builder picks the question from the dataset's list (`TDatasetQuestion`) and shows its label; the
 *   older `FeedbackRecords.fieldLabel` text filter keeps working as it was.
 * - **NPS segment**: an answer rule on an NPS question whose values are one segment's scale points,
 *   e.g. a detractor is `FeedbackRecords.answer equals <questionId>:0 … <questionId>:6`. It is an answer
 *   rule, so it keeps the submissions whose NPS answer falls in the segment and works on a chart of any
 *   other question of the same survey. Nothing new reaches Cube: the builder writes a plain answer rule.
 *
 * Pure, so the builder, the panel and the tests share it.
 */

/** The member a question filter tests: the stable question id each record carries. */
export const QUESTION_ID_MEMBER = "FeedbackRecords.fieldId";

/**
 * A question of the dataset a question filter may name: one whose records carry the question id itself
 * as their field id. Multi-select, matrix and ranking questions are left out — they store one record per
 * option or row under a composed id (`<questionId>__<optionId>`), which an `equals` cannot match.
 */
export type TDatasetQuestion = { id: string; label: string };

export const NPS_SEGMENTS = ["promoter", "passive", "detractor"] as const;
export type TNpsSegment = (typeof NPS_SEGMENTS)[number];

/** Each segment's scale points, inclusive: promoter 9–10, passive 7–8, detractor 0–6. */
export const NPS_SEGMENT_RANGES: Readonly<Record<TNpsSegment, readonly [number, number]>> = {
  promoter: [9, 10],
  passive: [7, 8],
  detractor: [0, 6],
};

/** The builder's operator for "NPS segment is"; the query stores it as an `equals` answer rule. */
export const NPS_SEGMENT_OPERATOR = "npsSegment";

export const isNpsSegment = (value: unknown): value is TNpsSegment =>
  typeof value === "string" && (NPS_SEGMENTS as readonly string[]).includes(value);

/** The answer value keys one segment stands for: its scale points, ascending. */
export const getNpsSegmentValueKeys = (segment: TNpsSegment): string[] => {
  const [from, to] = NPS_SEGMENT_RANGES[segment];
  return Array.from({ length: to - from + 1 }, (_, index) => String(from + index));
};

/**
 * The segment whose scale points are exactly `valueKeys` (in any order), or `null`. A rule picked point by
 * point that happens to cover a segment reads back as that segment — the query is the same either way.
 */
export const findNpsSegment = (valueKeys: readonly (string | number)[]): TNpsSegment | null => {
  const keys = new Set(valueKeys.map(String));
  if (keys.size !== valueKeys.length) return null;
  return (
    NPS_SEGMENTS.find((segment) => {
      const expected = getNpsSegmentValueKeys(segment);
      return expected.length === keys.size && expected.every((key) => keys.has(key));
    }) ?? null
  );
};

const NPS_SCALE = getNpsSegmentValueKeys("detractor").concat(
  getNpsSegmentValueKeys("passive"),
  getNpsSegmentValueKeys("promoter")
);

/**
 * Whether an answer question is an NPS question: a number question on the 0–10 scale. NPS is the only
 * survey scale that starts at 0 — rating, CSAT and CES start at 1 — so the options tell it apart without a
 * separate type on the catalog.
 */
export const isNpsAnswerQuestion = (question: TAnswerQuestion | undefined): boolean =>
  question?.kind === "number" &&
  question.options.length === NPS_SCALE.length &&
  question.options.every((option, index) => option.value === NPS_SCALE[index]);
