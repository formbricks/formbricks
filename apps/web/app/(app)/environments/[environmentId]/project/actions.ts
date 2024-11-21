"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromProjectId } from "@/lib/utils/helper";
import { z } from "zod";
import { updateProject } from "@formbricks/lib/project/service";
import { ZId } from "@formbricks/types/common";
import { ZProjectUpdateInput } from "@formbricks/types/project";

const ZUpdateProjectAction = z.object({
  projectId: ZId,
  data: ZProjectUpdateInput,
});

export const updateProjectAction = authenticatedActionClient
  .schema(ZUpdateProjectAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromProjectId(parsedInput.projectId),
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

    return await updateProject(parsedInput.projectId, parsedInput.data);
  });
