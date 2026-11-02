import type { TFeedbackSourceWithMappings } from "@formbricks/types/feedback-source";

type TSourceLike = Pick<TFeedbackSourceWithMappings, "type" | "formbricksMappings" | "fieldMappings">;

/** The surveys the workspace's survey connectors read from — the ids whose names records carry. */
export const getConnectedSurveyIds = (sources: readonly TSourceLike[]): string[] => [
  ...new Set(
    sources
      .filter((source) => source.type === "formbricks_survey")
      .flatMap((source) => source.formbricksMappings.map((mapping) => mapping.surveyId))
  ),
];

/**
 * The `source_name` values the workspace's records actually carry, for the Source quick filter. That is
 * not the feedback source's own name: a survey connector stamps each record with its survey's name
 * (`lib/feedback-source/transform.ts`), and a CSV import with its `source_name` mapping's static value.
 * A CSV `source_name` mapped to a column varies per row and cannot be listed without reading records,
 * so it adds no option.
 */
export const getRecordSourceNames = (
  sources: readonly TSourceLike[],
  surveyNamesById: ReadonlyMap<string, string>
): string[] => {
  const names = new Set<string>();
  for (const source of sources) {
    if (source.type === "formbricks_survey") {
      for (const { surveyId } of source.formbricksMappings) {
        const name = surveyNamesById.get(surveyId);
        if (name) names.add(name);
      }
      continue;
    }
    const staticName = source.fieldMappings
      .find((mapping) => mapping.targetFieldId === "source_name")
      ?.staticValue?.trim();
    if (staticName) names.add(staticName);
  }
  return [...names];
};
