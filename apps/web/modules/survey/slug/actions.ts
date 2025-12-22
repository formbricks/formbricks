"use server";

import { z } from "zod";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZSurveySlug } from "@formbricks/types/surveys/types";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromSurveyId, getProjectIdFromSurveyId } from "@/lib/utils/helper";
import { updateSurveySlug } from "@/modules/survey/lib/slug";

const ZUpdateSurveySlugAction = z.object({
  surveyId: z.string().cuid2(),
  slug: ZSurveySlug,
});

export const updateSurveySlugAction = authenticatedActionClient
  .schema(ZUpdateSurveySlugAction)
  .action(async ({ ctx, parsedInput }) => {
    if (IS_FORMBRICKS_CLOUD) {
      throw new OperationNotAllowedError("Pretty URLs are only available on self-hosted instances");
    }

    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        { type: "organization", roles: ["owner", "manager"] },
        {
          type: "projectTeam",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
          minPermission: "readWrite",
        },
      ],
    });

    return await updateSurveySlug(parsedInput.surveyId, parsedInput.slug);
  });

const ZRemoveSurveySlugAction = z.object({
  surveyId: z.string().cuid2(),
});

export const removeSurveySlugAction = authenticatedActionClient
  .schema(ZRemoveSurveySlugAction)
  .action(async ({ ctx, parsedInput }) => {
    if (IS_FORMBRICKS_CLOUD) {
      throw new OperationNotAllowedError("Pretty URLs are only available on self-hosted instances");
    }

    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        { type: "organization", roles: ["owner", "manager"] },
        {
          type: "projectTeam",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
          minPermission: "readWrite",
        },
      ],
    });

    return await updateSurveySlug(parsedInput.surveyId, null);
  });
