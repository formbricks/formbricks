"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { getSurveys } from "@/lib/survey/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromEnvironmentId, getProjectIdFromEnvironmentId } from "@/lib/utils/helper";
import { transformToUnifySurvey } from "./lib";
import { TUnifySurvey } from "./types";

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
