"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { AuthorizationError, OperationNotAllowedError } from "@formbricks/types/errors";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getSurveys } from "@/lib/survey/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { assertCanViewDirectory } from "@/modules/ee/feedback-directory/lib/access";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import { getAccessibleWorkspaceIds, getWorkspacePermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { transformToUnifySurvey } from "./lib";
import { TUnifySurvey } from "./types";

const ZGetSurveysForUnifyAction = z.object({
  organizationId: ZId,
  directoryId: ZId,
  workspaceId: ZId,
});

/**
 * Lists a workspace's surveys for the org-scoped "create feedback source" flow, where the user first
 * picks a dataset and then a workspace. Authorizes the dataset with the org-context VIEW guard, then
 * hardens the chosen workspace: it must be BOTH assigned to that dataset and reachable by the user,
 * and the user must hold readWrite on it (creating a source is a write). This mirrors the create
 * action's own checks so the survey dropdown can never surface surveys the user could not turn into a
 * source.
 */
export const getSurveysForUnifyAction = authenticatedActionClient
  .schema(ZGetSurveysForUnifyAction)
  .action(async ({ ctx, parsedInput }): Promise<TUnifySurvey[]> => {
    const { organizationId, directoryId, workspaceId } = parsedInput;

    const isFeedbackDirectoriesAllowed = await getIsFeedbackDirectoriesEnabled(organizationId);
    if (!isFeedbackDirectoriesAllowed) {
      throw new OperationNotAllowedError("Unify Feedback is not enabled for this organization");
    }

    // VIEW guard returns the dataset's assigned workspaces (owner/manager => all its workspaces).
    const { workspaceIds } = await assertCanViewDirectory(ctx.user.id, organizationId, directoryId);
    if (!workspaceIds.includes(workspaceId)) {
      throw new AuthorizationError("Workspace is not assigned to this dataset");
    }

    // Creating a source is a write. Mirror the create action's OR rule: org owner/manager may create in
    // any workspace of their org; a member needs the workspace to be reachable AND grant readWrite.
    const membership = await getMembershipByUserIdOrganizationId(ctx.user.id, organizationId);
    const { isOwner, isManager } = getAccessFlags(membership?.role);
    if (!isOwner && !isManager) {
      const accessibleWorkspaceIds = new Set(await getAccessibleWorkspaceIds(ctx.user.id, organizationId));
      if (!accessibleWorkspaceIds.has(workspaceId)) {
        throw new AuthorizationError("You do not have access to this workspace");
      }

      const permission = await getWorkspacePermissionByUserId(ctx.user.id, workspaceId);
      if (permission !== "readWrite" && permission !== "manage") {
        throw new AuthorizationError("You are not authorized to create a source in this workspace");
      }
    }

    const surveys = await getSurveys(workspaceId);
    return surveys.map((survey) => transformToUnifySurvey(survey));
  });
