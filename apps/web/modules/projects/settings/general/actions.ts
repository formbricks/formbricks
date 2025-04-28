"use server";

import { getUserProjects } from "@/lib/project/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromProjectId } from "@/lib/utils/helper";
import { deleteProject } from "@/modules/projects/settings/lib/project";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";

const ZProjectDeleteAction = z.object({
  projectId: ZId,
});

export const deleteProjectAction = authenticatedActionClient
  .schema(ZProjectDeleteAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromProjectId(parsedInput.projectId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    const availableProjects = (await getUserProjects(ctx.user.id, organizationId)) ?? null;

    if (!!availableProjects && availableProjects?.length <= 1) {
      throw new Error("You can't delete the last project in the environment.");
    }

    // delete project
    return await deleteProject(parsedInput.projectId);
  });
