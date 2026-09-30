import "server-only";
import { prisma } from "@formbricks/database";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { getElementsFromBlocks } from "@/lib/survey/utils";

/** A matrix question the directory holds records for, as the matrix chart's setup offers it. */
export interface TMatrixQuestion {
  /**
   * The value records carry as `field_group_label` — the mapping's custom label, else the headline.
   * The matrix recipe filters on exactly this string, so it must match ingestion (transform.ts).
   */
  label: string;
  rowCount: number;
  columnCount: number;
  /** Names of the surveys asking it. Several surveys can share one label; the chart merges them. */
  surveyNames: string[];
}

interface TMappingRef {
  surveyId: string;
  elementId: string;
  customFieldLabel: string | null;
}

interface TSurveyRef {
  id: string;
  name: string;
  blocks: unknown;
}

/** Mirrors `getHeadlineFromElement` in transform.ts, which writes the stored group label. */
const getDefaultHeadline = (headline: unknown): string => {
  if (!headline) return "Untitled";
  return getTextContent(getLocalizedValue(headline as Record<string, string>, "default")) || "Untitled";
};

/**
 * The matrix questions behind a set of mappings, one entry per group label, sorted by label. Pure,
 * so it is tested without a database.
 */
export const collectMatrixQuestions = (mappings: TMappingRef[], surveys: TSurveyRef[]): TMatrixQuestion[] => {
  const surveysById = new Map(surveys.map((survey) => [survey.id, survey]));
  const byLabel = new Map<string, TMatrixQuestion>();

  for (const mapping of mappings) {
    const survey = surveysById.get(mapping.surveyId);
    if (!survey || !Array.isArray(survey.blocks)) continue;
    const element = getElementsFromBlocks(survey.blocks as TSurveyBlock[]).find(
      (el) => el.id === mapping.elementId
    );
    if (element?.type !== TSurveyElementTypeEnum.Matrix) continue;

    const label = mapping.customFieldLabel || getDefaultHeadline(element.headline);
    const existing = byLabel.get(label);
    const rowCount = element.rows?.length ?? 0;
    const columnCount = element.columns?.length ?? 0;
    if (existing) {
      existing.rowCount = Math.max(existing.rowCount, rowCount);
      existing.columnCount = Math.max(existing.columnCount, columnCount);
      if (!existing.surveyNames.includes(survey.name)) existing.surveyNames.push(survey.name);
    } else {
      byLabel.set(label, { label, rowCount, columnCount, surveyNames: [survey.name] });
    }
  }

  return [...byLabel.values()].sort((a, b) => a.label.localeCompare(b.label));
};

/**
 * Matrix questions mapped into one feedback directory from this workspace's feedback sources.
 * Two queries whatever the number of mappings: the mappings, then every survey they name at once.
 */
export const getMatrixQuestions = async (
  workspaceId: string,
  feedbackDirectoryId: string
): Promise<TMatrixQuestion[]> => {
  const mappings = await prisma.feedbackSourceFormbricksMapping.findMany({
    where: { workspaceId, feedbackSource: { workspaceId, feedbackDirectoryId } },
    select: { surveyId: true, elementId: true, customFieldLabel: true },
  });
  if (mappings.length === 0) return [];

  const surveyIds = [...new Set(mappings.map((mapping) => mapping.surveyId))];
  const surveys = await prisma.survey.findMany({
    where: { id: { in: surveyIds }, workspaceId },
    select: { id: true, name: true, blocks: true },
  });

  return collectMatrixQuestions(mappings, surveys);
};
