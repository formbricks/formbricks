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
        // "member" must not appear here: the access items are OR'd, and every org member satisfies an
        // organization item, which would make the workspaceTeam check below dead and let any member
        // list surveys in workspaces they have no team access to. Members reach this through their
        // team permission instead.
        {
          type: "organization",
          roles: ["owner", "manager"],
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
