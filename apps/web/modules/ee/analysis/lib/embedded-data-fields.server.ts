import "server-only";
import { cache } from "react";
import { prisma } from "@formbricks/database";
import {
  getComputedEmbeddedFields,
  getIngestedEmbeddedFields,
} from "@formbricks/types/embedded-data-resolver";
import { inlineSurveyEmbeddedFields, selectSurveyEmbeddedDataLinks } from "@/lib/embedded-data/survey-fields";
import { type TEmbeddedChartField, collectEmbeddedChartFields } from "./embedded-data-fields";

/**
 * The Embedded Data fields a dataset's charts may use: every ingested and computed field — the two
 * sources the Feedback Record writer publishes — declared by a survey mapped into the dataset from this
 * workspace. Two queries whatever the number of surveys, deduplicated per request, because one chart
 * query reads the list twice (labels and the Cube token) and a dashboard runs many.
 */
export const getEmbeddedChartFields = cache(
  async (workspaceId: string, feedbackDirectoryId: string): Promise<TEmbeddedChartField[]> => {
    const mappings = await prisma.feedbackSourceFormbricksMapping.findMany({
      where: { workspaceId, feedbackSource: { workspaceId, feedbackDirectoryId } },
      select: { surveyId: true },
      distinct: ["surveyId"],
    });
    if (mappings.length === 0) return [];

    const surveys = await prisma.survey.findMany({
      where: { id: { in: mappings.map((mapping) => mapping.surveyId) }, workspaceId },
      select: { name: true, embeddedDataLinks: selectSurveyEmbeddedDataLinks },
    });

    return collectEmbeddedChartFields(
      surveys.map((survey) => {
        const embeddedFields = inlineSurveyEmbeddedFields(survey) ?? [];
        return {
          name: survey.name,
          fields: [
            ...getIngestedEmbeddedFields({ embeddedFields }),
            ...getComputedEmbeddedFields({ embeddedFields }),
          ].map(({ field }) => ({ name: field.name, dataType: field.dataType })),
        };
      })
    );
  }
);
