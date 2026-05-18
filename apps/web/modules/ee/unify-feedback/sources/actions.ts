"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { getSurveys } from "@/lib/survey/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import { transformToUnifySurvey } from "./lib";
import { TUnifySurvey } from "./types";

const ZGetSurveysForUnifyAction = z.object({
  workspaceId: ZId,
});

export const getSurveysForUnifyAction = authenticatedActionClient
  .schema(ZGetSurveysForUnifyAction)
  .action(async ({ ctx, parsedInput }): Promise<TUnifySurvey[]> => {
    const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);
    const isFeedbackDirectoriesAllowed = await getIsFeedbackDirectoriesEnabled(organizationId);
    if (!isFeedbackDirectoriesAllowed) {
      throw new OperationNotAllowedError("Unify Feedback is not enabled for this organization");
    }
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager", "member"],
        },
        {
          type: "workspaceTeam",
          minPermission: "read",
          workspaceId: parsedInput.workspaceId,
        },
      ],
    });

    const surveys = await getSurveys(parsedInput.workspaceId);
    return surveys.map((survey) => transformToUnifySurvey(survey));
  });
