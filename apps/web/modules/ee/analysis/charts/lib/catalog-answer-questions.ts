import type { TV3ChartFieldCatalog } from "@/app/api/v3/charts/lib/resources";
import { type TAnswerQuestion, parseAnswerValue } from "@/modules/ee/analysis/lib/answer-filter";

/**
 * The chart builder's answer questions from the public field catalog (`GET /api/v3/charts/fields`): the
 * catalog writes each option as the rule value to send, `"<questionId>:<valueKey>"`, and the builder
 * offers the value key, so the question id is taken off again. An option naming another question is
 * dropped rather than shown under the wrong one.
 */
export const toBuilderAnswerQuestions = (
  answerQuestions: TV3ChartFieldCatalog["answerQuestions"] | undefined
): TAnswerQuestion[] =>
  (answerQuestions ?? []).map(({ id, label, kind, options }) => ({
    id,
    label,
    kind,
    options: options.flatMap((option) => {
      const parsed = parseAnswerValue(option.value);
      return parsed?.questionId === id ? [{ value: parsed.valueKey, label: option.label }] : [];
    }),
  }));
