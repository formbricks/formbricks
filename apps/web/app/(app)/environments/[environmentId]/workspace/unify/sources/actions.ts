"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { getSurveys } from "@/lib/survey/service";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromEnvironmentId, getProjectIdFromEnvironmentId } from "@/lib/utils/helper";
import { recallToHeadline } from "@/lib/utils/recall";
import { TUnifySurvey, TUnifySurveyElement } from "./types";

const getElementHeadline = (element: TSurveyElement, survey: TSurvey): string => {
  return (
    getTextContent(
      getLocalizedValue(recallToHeadline(element.headline, survey, false, "default"), "default")
    ) || "Untitled"
  );
};

const mapSurveyStatus = (status: string): TUnifySurvey["status"] => {
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
};

const transformToUnifySurvey = (survey: TSurvey): TUnifySurvey => {
  const elements = getElementsFromBlocks(survey.blocks);

  const unifySurveyElements: TUnifySurveyElement[] = elements
    .filter((el) => el.type !== TSurveyElementTypeEnum.CTA)
    .map((el) => ({
      id: el.id,
      type: el.type,
      headline: getElementHeadline(el, survey),
      required: el.required ?? false,
    }));

  return {
    id: survey.id,
    name: survey.name,
    status: mapSurveyStatus(survey.status),
    elements: unifySurveyElements,
    createdAt: survey.createdAt,
  };
};

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

    const surveys = await getSurveys(parsedInput.environmentId);
    return surveys.map((survey) => transformToUnifySurvey(survey));
  });
