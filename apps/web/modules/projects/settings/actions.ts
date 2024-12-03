"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromProjectId } from "@/lib/utils/helper";
import {
  getRemoveInAppBrandingPermission,
  getRemoveLinkBrandingPermission,
} from "@/modules/ee/license-check/lib/utils";
import { updateProject } from "@/modules/projects/settings/lib/project";
import { z } from "zod";
import { getOrganization } from "@formbricks/lib/organization/service";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZProjectUpdateInput } from "@formbricks/types/project";

const ZUpdateProjectAction = z.object({
  projectId: ZId,
  data: ZProjectUpdateInput,
});

export const updateProjectAction = authenticatedActionClient
  .schema(ZUpdateProjectAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromProjectId(parsedInput.projectId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          schema: ZProjectUpdateInput,
          data: parsedInput.data,
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          projectId: parsedInput.projectId,
          minPermission: "manage",
        },
      ],
    });

    if (
      parsedInput.data.inAppSurveyBranding !== undefined ||
      parsedInput.data.linkSurveyBranding !== undefined
    ) {
      const organization = await getOrganization(organizationId);

      if (!organization) {
        throw new Error("Organization not found");
      }

      if (parsedInput.data.inAppSurveyBranding !== undefined) {
        const canRemoveInAppBranding = getRemoveInAppBrandingPermission(organization);
        if (!canRemoveInAppBranding) {
          throw new OperationNotAllowedError("You are not allowed to remove in-app branding");
        }
      }

      if (parsedInput.data.linkSurveyBranding !== undefined) {
        const canRemoveLinkSurveyBranding = getRemoveLinkBrandingPermission(organization);
        if (!canRemoveLinkSurveyBranding) {
          throw new OperationNotAllowedError("You are not allowed to remove link survey branding");
        }
      }
    }

    return await updateProject(parsedInput.projectId, parsedInput.data);
  });
