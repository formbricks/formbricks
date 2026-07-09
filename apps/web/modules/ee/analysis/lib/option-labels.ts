import "server-only";
import { prisma } from "@formbricks/database";
import type { TChartQuery } from "@formbricks/types/analysis";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { getElementsFromBlocks } from "@/lib/survey/utils";

export const VALUE_ID_DIMENSION = "FeedbackRecords.valueId";

/**
 * Resolves value_id (the stable id of a survey choice / matrix column, ENG-1673) to its
 * default-language label, for every survey feeding the given feedback directory.
 *
 * FeedbackRecords store the label as submitted (localized to the response language) and
 * carry value_id as the cross-language identity, so anything user-facing that groups or
 * filters by value_id needs this map — raw ids are meaningless to users.
 *
 * Ids that resolve to no label (survey or choice deleted since ingestion) are simply
 * absent from the map; callers should fall back to showing the raw id.
 */
export const getOptionLabelMap = async (
  feedbackDirectoryId: string,
  workspaceId: string
): Promise<Map<string, string>> => {
  const mappings = await prisma.feedbackSourceFormbricksMapping.findMany({
    where: {
      workspaceId,
      feedbackSource: { feedbackDirectoryId, workspaceId },
    },
    select: { surveyId: true },
  });

  const surveyIds = [...new Set(mappings.map((m) => m.surveyId))];
  if (surveyIds.length === 0) return new Map();

  const surveys = await prisma.survey.findMany({
    where: { id: { in: surveyIds }, workspaceId },
    select: { blocks: true },
  });

  const labelById = new Map<string, string>();
  // Picture-choice options carry an imageUrl instead of a label — skip anything label-less.
  const addChoices = (choices: { id: string; label?: unknown }[]): void => {
    for (const choice of choices) {
      if (!choice.label) continue;
      const label = getTextContent(getLocalizedValue(choice.label as never, "default"));
      if (label) labelById.set(choice.id, label);
    }
  };

  for (const survey of surveys) {
    const elements = getElementsFromBlocks(survey.blocks as never);
    for (const element of elements) {
      if ("choices" in element && Array.isArray(element.choices)) {
        addChoices(element.choices as { id: string; label?: unknown }[]);
      }
      if ("columns" in element && Array.isArray(element.columns)) {
        addChoices(element.columns as { id: string; label?: unknown }[]);
      }
    }
  }

  return labelById;
};

/**
 * Replaces raw value_id values in query result rows with their default-language option
 * labels, so users never see opaque ids on chart axes, legends, or tables. Grouping has
 * already happened in Cube by the time rows arrive, so this is display-only: filters
 * keep operating on the stable ids. Ids with no resolvable label (deleted survey or
 * choice) are left as-is.
 */
export const mapValueIdRowsToLabels = async <T extends Record<string, unknown>>(
  rows: T[],
  query: TChartQuery,
  feedbackDirectoryId: string,
  workspaceId: string
): Promise<T[]> => {
  if (!query.dimensions?.includes(VALUE_ID_DIMENSION)) return rows;
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  const labelById = await getOptionLabelMap(feedbackDirectoryId, workspaceId);
  if (labelById.size === 0) return rows;

  return rows.map((row) => {
    const id = row[VALUE_ID_DIMENSION];
    const label = typeof id === "string" ? labelById.get(id) : undefined;
    return label ? { ...row, [VALUE_ID_DIMENSION]: label } : row;
  });
};
