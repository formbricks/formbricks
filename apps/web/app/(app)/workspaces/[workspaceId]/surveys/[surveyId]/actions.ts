"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZResponseFilterCriteria } from "@formbricks/types/responses";
import { assertCan } from "@/lib/authorization";
import { capturePostHogEvent } from "@/lib/posthog";
import { getResponseDownloadFile } from "@/lib/response/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getOrganizationIdFromSurveyId, getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";

const ZGetResponsesDownloadUrlAction = z.object({
  surveyId: ZId,
  format: z.union([z.literal("csv"), z.literal("xlsx")]),
  filterCriteria: ZResponseFilterCriteria,
});

export const getResponsesDownloadUrlAction = authenticatedActionClient
  .inputSchema(ZGetResponsesDownloadUrlAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
    const workspaceId = await getWorkspaceIdFromSurveyId(parsedInput.surveyId);

    await assertCan({ type: "user", id: ctx.user.id }, "survey.response_export", {
      type: "survey",
      id: parsedInput.surveyId,
    });

    const result = await getResponseDownloadFile(
      parsedInput.surveyId,
      parsedInput.format,
      parsedInput.filterCriteria
    );

    capturePostHogEvent(
      ctx.user.id,
      "responses_exported",
      {
        survey_id: parsedInput.surveyId,
        format: parsedInput.format,
        filter_applied: Object.keys(parsedInput.filterCriteria ?? {}).length > 0,
        organization_id: organizationId,
        workspace_id: workspaceId,
      },
      { organizationId, workspaceId }
    );

    return result;
  });
