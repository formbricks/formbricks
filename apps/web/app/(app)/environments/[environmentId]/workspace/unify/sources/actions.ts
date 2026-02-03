"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getSurveys } from "@/lib/survey/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromEnvironmentId, getProjectIdFromEnvironmentId } from "@/lib/utils/helper";
import { TUnifySurvey, TUnifySurveyElement } from "./components/types";

// Helper to extract elements from a survey (from blocks or legacy questions)
function extractElementsFromSurvey(survey: TSurvey): TUnifySurveyElement[] {
  const elements: TUnifySurveyElement[] = [];

  // Try to get elements from blocks first (new structure)
  if (survey.blocks && survey.blocks.length > 0) {
    for (const block of survey.blocks) {
      if (block.elements) {
        for (const element of block.elements) {
          // Skip non-question elements (like CTA)
          if (element.type === TSurveyElementTypeEnum.CTA) continue;

          elements.push({
            id: element.id,
            type: element.type,
            headline: getElementHeadline(element),
            required: element.required ?? false,
          });
        }
      }
    }
  }

  // Fallback to legacy questions if no blocks
  if (elements.length === 0 && survey.questions && Array.isArray(survey.questions)) {
    for (const question of survey.questions as Array<{
      id: string;
      type: string;
      headline?: string | { default?: string };
      required?: boolean;
    }>) {
      elements.push({
        id: question.id,
        type: question.type,
        headline: getQuestionHeadline(question),
        required: question.required ?? false,
      });
    }
  }

  return elements;
}

// Helper to strip HTML tags from a string
function stripHtmlTags(html: string): string {
  // Remove HTML tags and decode common entities
  return html
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/&nbsp;/g, " ") // Replace non-breaking spaces
    .replace(/&amp;/g, "&") // Replace ampersands
    .replace(/&lt;/g, "<") // Replace less than
    .replace(/&gt;/g, ">") // Replace greater than
    .replace(/&quot;/g, '"') // Replace quotes
    .replace(/&#39;/g, "'") // Replace apostrophes
    .trim();
}

// Helper to get element headline (handles i18n structure)
function getElementHeadline(element: { headline?: string | { default?: string } }): string {
  if (!element.headline) return "Untitled";
  let headline: string;
  if (typeof element.headline === "string") {
    headline = element.headline;
  } else if (typeof element.headline === "object" && element.headline.default) {
    headline = element.headline.default;
  } else {
    return "Untitled";
  }
  // Strip HTML tags if present
  return stripHtmlTags(headline);
}

// Helper to get question headline (handles i18n structure)
function getQuestionHeadline(question: { headline?: string | { default?: string } }): string {
  if (!question.headline) return "Untitled";
  let headline: string;
  if (typeof question.headline === "string") {
    headline = question.headline;
  } else if (typeof question.headline === "object" && question.headline.default) {
    headline = question.headline.default;
  } else {
    return "Untitled";
  }
  // Strip HTML tags if present
  return stripHtmlTags(headline);
}

// Map survey status
function mapSurveyStatus(status: string): TUnifySurvey["status"] {
  switch (status) {
    case "inProgress":
      return "active";
    case "paused":
      return "paused";
    case "draft":
      return "draft";
    case "completed":
      return "completed";
    default:
      return "draft";
  }
}

// Transform TSurvey to TUnifySurvey for the UI
function transformToUnifySurvey(survey: TSurvey, responseCount: number): TUnifySurvey {
  return {
    id: survey.id,
    name: survey.name,
    status: mapSurveyStatus(survey.status),
    responseCount,
    elements: extractElementsFromSurvey(survey),
    createdAt: survey.createdAt,
  };
}

// Get surveys for environment action
const ZGetSurveysForUnifyAction = z.object({
  environmentId: ZId,
});

export const getSurveysForUnifyAction = authenticatedActionClient
  .schema(ZGetSurveysForUnifyAction)
  .action(async ({ ctx, parsedInput }): Promise<TUnifySurvey[]> => {
    const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager", "member"],
        },
        {
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
        },
      ],
    });

    // Get surveys from the database
    const surveys = await getSurveys(parsedInput.environmentId);

    // Transform to TUnifySurvey format
    // Note: We don't have response counts readily available, so using 0 for now
    // In a production implementation, we'd fetch response counts separately
    return surveys.map((survey) => transformToUnifySurvey(survey, 0));
  });
